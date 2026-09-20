import {
  actualDepthWarning,
  deepestRecordedDepthM,
  DRILLHOLE_STATUSES,
  holeAttention,
  loggedLengthM,
  loggingProgress,
  normaliseDateInput,
  overallRecoveryPercent,
  validateActualDates,
  type DrillholeStatus,
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
import { ChipSelect } from '@/components/form/chip-select';
import { DateField } from '@/components/form/date-field';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { ActionTile } from '@/components/ui/action-tile';
import { AlertRow } from '@/components/ui/alert-row';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { listBoxes, listRuns } from '@/data/coreRepository';
import {
  getDrillhole,
  updateDrillholeActuals,
  updateDrillholeStatus,
} from '@/data/drillholesRepository';
import { listIntervals } from '@/data/intervalsRepository';
import { getProject } from '@/data/projectsRepository';
import { listHoleSamples } from '@/data/samplesRepository';
import { statusLabel, statusTone } from '@/utils/status';
import { useFocusReload } from '@/hooks/use-focus-reload';

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
  const [statusSaving, setStatusSaving] = useState(false);

  // Deepest depth recorded by any core box, run or log interval — what the
  // E2-2 "final depth is shallower than what's recorded" warning compares to.
  const deepestRecordedM = deepestRecordedDepthM([
    ...boxes,
    ...runs,
    ...intervals,
  ]);

  const load = useCallback(() => {
    getProject(projectId).then((project) =>
      setProjectName(project?.name ?? ''),
    );
    getDrillhole(drillholeId).then((loaded) => {
      if (!loaded) {
        return;
      }
      setDrillhole(loaded);
      // Tidy any date saved in an older, looser format (e.g. 2026/09/19).
      const started = normaliseDateInput(loaded.startedAt ?? '', 'Started');
      const completed = normaliseDateInput(
        loaded.completedAt ?? '',
        'Completed',
      );
      setStartedAt(started.valid ? started.value : null);
      setCompletedAt(completed.valid ? completed.value : null);
      setActualFinalDepthM(
        loaded.actualFinalDepthM != null
          ? String(loaded.actualFinalDepthM)
          : '',
      );
    });
    listHoleSamples(drillholeId).then((samples) =>
      setSampleCount(samples.length),
    );
    listBoxes(drillholeId).then(setBoxes);
    listRuns(drillholeId).then(setRuns);
    listIntervals(drillholeId).then(setIntervals);
  }, [projectId, drillholeId]);

  useFocusReload(load);

  async function handleStatusChange(status: DrillholeStatus) {
    setStatusSaving(true);
    try {
      const updated = await updateDrillholeStatus(drillholeId, status);
      if (updated) {
        setDrillhole(updated);
      }
    } finally {
      setStatusSaving(false);
    }
  }

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
        setDrillhole(updated);
      }
    } finally {
      setSavingActuals(false);
    }
  }

  if (!drillhole) {
    return null;
  }

  const holeDepthM = drillhole.actualFinalDepthM ?? drillhole.plannedDepthM;
  const loggedM = loggedLengthM(intervals);
  const progress = loggingProgress(loggedM, drillhole);
  const attention = holeAttention(boxes, intervals);
  const recovery = overallRecoveryPercent(runs);

  return (
    <SafeAreaView style={styles.safeArea}>
      <FormScrollView contentContainerStyle={styles.content}>
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

        {attention.map((item) => (
          <AlertRow
            key={`${item.kind}-${item.message}`}
            message={item.message}
            actionLabel="Fix"
            onPress={() => go(`/${item.target}`)}
          />
        ))}

        <PrimaryButton
          label={
            intervals.length === 0 && boxes.length === 0
              ? 'Add first core box'
              : 'Log next interval'
          }
          icon="plus"
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
            onPress={() => go('/runs')}
          />
          <ActionTile
            icon="text-box-outline"
            title="Core log"
            detail={count(intervals.length, 'interval', 'intervals')}
            onPress={() => go('/log')}
          />
          <ActionTile
            icon="flask-outline"
            title="Samples"
            detail={count(sampleCount, 'sample', 'samples')}
            onPress={() =>
              router.push(
                `/projects/${projectId}/samples?drillholeId=${drillholeId}`,
              )
            }
          />
        </View>

        <Card style={styles.formCard}>
          <ChipSelect
            label="Status"
            options={DRILLHOLE_STATUSES}
            value={drillhole.status}
            onChange={handleStatusChange}
            formatOption={statusLabel}
          />
          {statusSaving ? (
            <ThemedText type="small" themeColor="textSecondary">
              Saving…
            </ThemedText>
          ) : null}
        </Card>

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
            onPress={handleSaveActuals}
            loading={savingActuals}
          />
        </Card>
      </FormScrollView>
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
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two + 2,
  },
  formCard: {
    gap: Spacing.three,
  },
});
