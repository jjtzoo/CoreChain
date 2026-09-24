import {
  actualDepthWarning,
  buildHoleLog,
  deepestRecordedDepthM,
  holeAttention,
  loggedLengthM,
  loggingProgress,
  normaliseDateInput,
  overallRecoveryPercent,
  validateActualDates,
  type FieldCoreBox,
  type FieldCoreRun,
  type FieldDrillhole,
  type LogInterval,
} from '@corechain/domain';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContinuityStrip } from '@/components/continuity-strip';
import { HoleLogRibbons } from '@/components/hole-log-ribbons';
import { DateField } from '@/components/form/date-field';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { ActionTile } from '@/components/ui/action-tile';
import { AlertRow } from '@/components/ui/alert-row';
import type { GuideStep } from '@/guide/steps';
import { Card } from '@/components/ui/card';
import { CoachmarkOverlay } from '@/components/guide/coachmark-overlay';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { listBoxes, listRuns } from '@/data/coreRepository';
import { updateDrillholeActuals } from '@/data/drillholesRepository';
import { reconcileDrillholeStatus } from '@/data/drillholeStatus';
import { listIntervals } from '@/data/intervalsRepository';
import { getProject } from '@/data/projectsRepository';
import { listHoleSamples } from '@/data/samplesRepository';
import { useGuideStep } from '@/guide/use-guide-step';
import { statusLabel, statusTone } from '@/utils/status';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { ScreenLoader } from '@/components/screen-loader';

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export default function DrillholeDetailScreen() {
  const { projectId, drillholeId } = useLocalSearchParams<{
    projectId: string;
    drillholeId: string;
  }>();
  const router = useRouter();
  const go = (path: string) =>
    router.push(
      `/projects/${projectId}/drillholes/${drillholeId}${path}` as Href,
    );
  const addBoxGuide = useGuideStep('add-box', projectId ?? null);
  const logIntervalGuide = useGuideStep('log-interval', projectId ?? null);
  const addSampleGuide = useGuideStep('add-sample', projectId ?? null);
  const exportGuide = useGuideStep('export', projectId ?? null);
  // The guide's next tap is elsewhere: point at it, and grey everything else
  // on this screen so it can't be mistaken for the next step.
  const guidingToSamples = 'step' in addSampleGuide;
  const guidingBack: GuideStep | null =
    'step' in exportGuide ? (exportGuide.step ?? null) : null;
  const guiding = guidingToSamples || guidingBack != null;

  const [drillhole, setDrillhole] = useState<FieldDrillhole | null>(null);
  const [projectName, setProjectName] = useState('');
  const [boxes, setBoxes] = useState<FieldCoreBox[]>([]);
  const [runs, setRuns] = useState<FieldCoreRun[]>([]);
  const [intervals, setIntervals] = useState<LogInterval[]>([]);
  const [sampleCount, setSampleCount] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [dateErrors, setDateErrors] = useState<{
    startedAt?: string;
    completedAt?: string;
  }>({});
  const [depthError, setDepthError] = useState<string | null>(null);
  const [actualFinalDepthM, setActualFinalDepthM] = useState('');
  const [depthWarning, setDepthWarning] = useState<string | null>(null);
  const [savingActuals, setSavingActuals] = useState(false);

  // Deepest depth recorded by any core box, run or log interval — what the
  // E2-2 "final depth is shallower than what's recorded" warning compares to.
  const deepestRecordedM = deepestRecordedDepthM([
    ...boxes,
    ...runs,
    ...intervals,
  ]);

  // Loads the hole along with its boxes, runs and intervals, then reconciles
  // its stored status against what they actually show — status is never
  // picked by the geologist.
  const load = useCallback(async () => {
    getProject(projectId).then((project) =>
      setProjectName(project?.name ?? ''),
    );

    const [samples, loadedBoxes, loadedRuns, loadedIntervals, reconciled] =
      await Promise.all([
        listHoleSamples(drillholeId),
        listBoxes(drillholeId),
        listRuns(drillholeId),
        listIntervals(drillholeId),
        reconcileDrillholeStatus(drillholeId),
      ]);

    setSampleCount(samples.length);
    setBoxes(loadedBoxes);
    setRuns(loadedRuns);
    setIntervals(loadedIntervals);

    if (!reconciled) {
      return;
    }

    setDrillhole(reconciled);
    // Tidy any date saved in an older, looser format (e.g. 2026/09/19).
    const started = normaliseDateInput(reconciled.startedAt ?? '', 'Started');
    const completed = normaliseDateInput(
      reconciled.completedAt ?? '',
      'Completed',
    );
    setStartedAt(started.valid ? started.value : null);
    setCompletedAt(completed.valid ? completed.value : null);
    setActualFinalDepthM(
      reconciled.actualFinalDepthM != null
        ? String(reconciled.actualFinalDepthM)
        : '',
    );
  }, [projectId, drillholeId]);

  useFocusReload(load);

  async function handleSaveActuals() {
    const dates = validateActualDates(startedAt ?? '', completedAt ?? '');
    setDateErrors(dates.valid ? {} : dates.errors);

    const depthText = actualFinalDepthM.trim();
    const parsedDepth = depthText.length > 0 ? Number(depthText) : null;
    const depthInvalid =
      parsedDepth != null && !(Number.isFinite(parsedDepth) && parsedDepth > 0);
    setDepthError(
      depthInvalid ? 'Final depth must be a number above 0.' : null,
    );

    if (!dates.valid || depthInvalid) {
      return;
    }

    if (parsedDepth != null) {
      setDepthWarning(actualDepthWarning(parsedDepth, deepestRecordedM));
    } else {
      setDepthWarning(null);
    }

    setSavingActuals(true);
    try {
      const updated = await updateDrillholeActuals(drillholeId, {
        startedAt: dates.startedAt,
        completedAt: dates.completedAt,
        actualFinalDepthM: parsedDepth,
      });
      if (updated) {
        // Actual dates and depth feed deriveDrillholeStatus, so reload to
        // reconcile the hole's status against what was just saved.
        await load();
      }
    } finally {
      setSavingActuals(false);
    }
  }

  if (!drillhole) {
    return <ScreenLoader />;
  }

  const holeDepthM = drillhole.actualFinalDepthM ?? drillhole.plannedDepthM;
  const loggedM = loggedLengthM(intervals);
  const progress = loggingProgress(loggedM, drillhole);
  const attention = holeAttention(boxes, intervals);
  const recovery = overallRecoveryPercent(runs);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FormScrollView contentContainerStyle={styles.content}>
        {guidingBack ? (
          <AlertRow
            tone="info"
            message={guidingBack.body}
            actionLabel="Back"
            onPress={() => router.back()}
          />
        ) : null}

        <View style={styles.header}>
          <View style={styles.headerTop}>
            <ThemedText type="subtitle" style={styles.holeId}>
              {drillhole.holeId}
            </ThemedText>
            <StatusPill
              label={statusLabel(drillhole.status)}
              tone={statusTone(drillhole.status)}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {projectName ? `${projectName} · ` : ''}
            {holeDepthM} m{' '}
            {drillhole.actualFinalDepthM != null ? 'final' : 'planned'}
            {drillhole.plannedAzimuthDeg != null
              ? ` · azimuth ${drillhole.plannedAzimuthDeg}°`
              : ''}
            {drillhole.plannedInclinationDeg != null
              ? ` · dip ${drillhole.plannedInclinationDeg}°`
              : ''}
          </ThemedText>
          <View style={styles.collarRow}>
            <Icon
              name={
                drillhole.collar ? 'map-marker-check' : 'map-marker-off-outline'
              }
              size={18}
              themeColor={drillhole.collar ? 'success' : 'muted'}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {drillhole.collar
                ? `${drillhole.collar.source === 'gps' ? 'GPS collar' : 'Collar'} ${drillhole.collar.latitude.toFixed(4)}, ${drillhole.collar.longitude.toFixed(4)}`
                : 'No collar recorded'}
            </ThemedText>
          </View>
        </View>

        <Card style={styles.progressCard}>
          <View style={styles.progressTop}>
            <ThemedText type="smallBold">Core logged</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {loggedM} of {holeDepthM} m
            </ThemedText>
          </View>
          <ProgressBar value={progress} label="Core logged" />
          {intervals.length > 0 ? (
            <ContinuityStrip ranges={intervals} holeDepthM={holeDepthM} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Nothing logged yet. Your depth strip appears here once you log the
              first interval.
            </ThemedText>
          )}
        </Card>

        {intervals.length > 0 ? (
          <Card
            style={[styles.progressCard, guiding && styles.disabled]}
            onPress={guiding ? undefined : () => go('/graphic')}
            accessibilityLabel="Open the graphic hole log">
            <View style={styles.progressTop}>
              <ThemedText type="heading">Hole log</ThemedText>
              <View style={styles.openRow}>
                <ThemedText type="smallBold" themeColor="brand">
                  Open
                </ThemedText>
                <Icon name="chevron-right" size={20} themeColor="brand" />
              </View>
            </View>
            <HoleLogRibbons
              log={buildHoleLog({ intervals, runs, depthM: holeDepthM })}
            />
          </Card>
        ) : null}

        {attention.map((item) => (
          <AlertRow
            key={`${item.kind}-${item.message}`}
            message={item.message}
            actionLabel={guiding ? undefined : 'Fix'}
            onPress={guiding ? undefined : () => go(`/${item.target}`)}
          />
        ))}

        <PrimaryButton
          label={
            intervals.length === 0 && boxes.length === 0
              ? 'Add first core box'
              : 'Log next interval'
          }
          icon="plus"
          disabled={guiding}
          onPress={() =>
            go(
              intervals.length === 0 && boxes.length === 0
                ? '/boxes/new'
                : '/log/new',
            )
          }
        />

        <View style={styles.tiles}>
          <ActionTile
            icon="package-variant-closed"
            title="Core boxes"
            detail={count(boxes.length, 'box', 'boxes')}
            disabled={guiding}
            onPress={() => go('/boxes')}
          />
          <ActionTile
            icon="ruler"
            title="Core runs"
            detail={
              runs.length === 0
                ? 'No runs yet'
                : `${count(runs.length, 'run', 'runs')}${recovery != null ? ` · ${recovery}% recovery` : ''}`
            }
            disabled={guiding}
            onPress={() => go('/runs')}
          />
          <ActionTile
            icon="text-box-outline"
            title="Core log"
            detail={count(intervals.length, 'interval', 'intervals')}
            disabled={guiding}
            onPress={() => go('/log')}
          />
          <ActionTile
            icon="flask-outline"
            title="Samples"
            detail={count(sampleCount, 'sample', 'samples')}
            disabled={guidingBack != null}
            highlighted={guidingToSamples}
            onPress={() =>
              router.push(
                `/projects/${projectId}/samples?drillholeId=${drillholeId}`,
              )
            }
          />
        </View>

        <Card style={styles.formCard}>
          <ThemedText type="heading">Actual details</ThemedText>
          <DateField
            label="Started"
            optional
            value={startedAt}
            onChange={setStartedAt}
            error={dateErrors.startedAt}
          />
          <DateField
            label="Completed"
            optional
            value={completedAt}
            onChange={setCompletedAt}
            minimumDate={startedAt}
            error={dateErrors.completedAt}
          />
          <TextField
            label="Actual final depth (m)"
            optional
            value={actualFinalDepthM}
            onChangeText={setActualFinalDepthM}
            keyboardType="decimal-pad"
            error={depthError ?? undefined}
          />
          {depthWarning ? <AlertRow message={depthWarning} /> : null}
          <PrimaryButton
            label="Save actual details"
            variant="secondary"
            disabled={guiding}
            onPress={handleSaveActuals}
            loading={savingActuals}
          />
        </Card>
      </FormScrollView>
      {'step' in addBoxGuide && addBoxGuide.visible ? (
        <CoachmarkOverlay
          step={addBoxGuide.step}
          stepNumber={addBoxGuide.stepNumber}
          totalSteps={addBoxGuide.totalSteps}
          onNext={addBoxGuide.hide}
          onSkip={() => void addBoxGuide.skip()}
        />
      ) : null}
      {'step' in logIntervalGuide && logIntervalGuide.visible ? (
        <CoachmarkOverlay
          step={logIntervalGuide.step}
          stepNumber={logIntervalGuide.stepNumber}
          totalSteps={logIntervalGuide.totalSteps}
          onNext={logIntervalGuide.hide}
          onSkip={() => void logIntervalGuide.skip()}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  header: {
    gap: Spacing.one + 2,
    paddingTop: Spacing.two,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  holeId: {
    flex: 1,
  },
  collarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  progressCard: {
    gap: Spacing.three,
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two + 2,
  },
  formCard: {
    gap: Spacing.three,
  },
  disabled: {
    opacity: 0.4,
  },
});
