import {
  buildSampleTrace,
  CUSTODY_LABELS,
  canCorrectEvent,
  canRecordEvent,
  custodyTimeline,
  effectiveEvents,
  type FieldCoreBox,
  type FieldDrillhole,
  type FieldCustodyEvent,
  type FieldSample,
  type LogInterval,
  type RecordableEventType,
} from '@corechain/domain';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { CustodyTimeline } from '@/components/custody-timeline';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { AlertRow } from '@/components/ui/alert-row';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { TraceChain } from '@/components/ui/trace-chain';
import { Spacing } from '@/constants/theme';
import { listBoxes } from '@/data/coreRepository';
import { listCustodyEvents } from '@/data/custodyRepository';
import { getDrillhole } from '@/data/drillholesRepository';
import { listIntervals } from '@/data/intervalsRepository';
import { countPhotosBySubject } from '@/data/photosRepository';
import { loadRosterNames, refreshRoster } from '@/data/rosterRepository';
import {
  deleteSample,
  getSample,
  listHoleSamples,
} from '@/data/samplesRepository';
import { sampleStatusTone, statusLabel } from '@/utils/status';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { ScreenLoader } from '@/components/screen-loader';

/**
 * Where one sample has been, from the hole it came from to its assay: the
 * screen that makes the chain of custody visible.
 */
export default function SampleTraceScreen() {
  const { projectId, sampleId } = useLocalSearchParams<{
    projectId: string;
    sampleId: string;
  }>();
  const router = useRouter();
  const { cookie } = useSession();

  const [sample, setSample] = useState<FieldSample | null>(null);
  const [hole, setHole] = useState<FieldDrillhole | null>(null);
  const [boxes, setBoxes] = useState<(FieldCoreBox & { photoCount: number })[]>(
    [],
  );
  const [intervals, setIntervals] = useState<LogInterval[]>([]);
  const [parent, setParent] = useState<FieldSample | null>(null);
  const [events, setEvents] = useState<FieldCustodyEvent[]>([]);
  const [asOf, setAsOf] = useState(0);
  const [roster, setRoster] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    (async () => {
      const loaded = await getSample(sampleId);
      setSample(loaded);
      if (!loaded) {
        return;
      }
      const loadedEvents = await listCustodyEvents(loaded.id);
      setAsOf(Date.now());
      setEvents(loadedEvents);
      const [
        loadedHole,
        loadedBoxes,
        loadedIntervals,
        photoCounts,
        holeSamples,
      ] = await Promise.all([
        getDrillhole(loaded.drillholeId),
        listBoxes(loaded.drillholeId),
        listIntervals(loaded.drillholeId),
        countPhotosBySubject(loaded.drillholeId, 'box'),
        listHoleSamples(loaded.drillholeId),
      ]);
      setHole(loadedHole);
      setBoxes(
        loadedBoxes.map((b) => ({
          ...b,
          photoCount: photoCounts.get(b.id) ?? 0,
        })),
      );
      setIntervals(loadedIntervals);
      setParent(
        holeSamples.find((s) => s.id === loaded.parentSampleId) ?? null,
      );
      // "Logged by" on the custody timeline: use whatever is cached
      // immediately, and refresh from the server in the background so a
      // teammate's name isn't stuck blank forever on an offline phone.
      setRoster(await loadRosterNames());
      if (cookie) {
        refreshRoster(cookie)
          .then(() => loadRosterNames())
          .then(setRoster);
      }
    })();
  }, [sampleId, cookie]);

  useFocusReload(load);

  const steps = useMemo(
    () =>
      sample && hole
        ? buildSampleTrace({
            sample,
            hole: { holeId: hole.holeId, collar: hole.collar },
            boxes,
            intervals,
          })
        : [],
    [sample, hole, boxes, intervals],
  );

  function confirmDelete() {
    if (!sample) {
      return;
    }
    Alert.alert(
      `Delete ${sample.sampleNumber}?`,
      'The sample is removed, but its number stays reserved so it is never reused.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteSample(sample.id);
            if (result.outcome === 'has-custody') {
              Alert.alert(
                'Has a custody record',
                'This sample has been bagged or handed over. Correct its custody steps first, so the record is never left without its sample.',
              );
              return;
            }
            if (result.outcome === 'has-duplicates') {
              Alert.alert(
                'Has a duplicate',
                'A field duplicate points at this sample. Delete the duplicate first.',
              );
              return;
            }
            router.back();
          },
        },
      ],
    );
  }

  if (!sample || !hole) {
    return <ScreenLoader />;
  }

  const missing = steps.filter((s) => s.state === 'missing');
  const custodyLines = custodyTimeline(events);
  const counting = effectiveEvents(events);
  const lastStep = counting[counting.length - 1];
  const correctable =
    lastStep && canCorrectEvent(events, lastStep.id).ok ? lastStep : null;
  const nextSteps = (
    ['bagged', 'sealed', 'handed_over'] as RecordableEventType[]
  ).filter((type) => canRecordEvent(type, events).ok);
  const STEP_LABELS: Record<RecordableEventType, string> = {
    bagged: 'Bag sample',
    sealed: 'Seal sample',
    handed_over: counting.some((event) => event.type === 'handed_over')
      ? 'Record another handover'
      : 'Hand over sample',
  };
  const recordStep = (type: RecordableEventType) =>
    router.push(
      `/projects/${projectId}/custody/record?type=${type}&sampleIds=${sample.id}` as Href,
    );
  const goToHole = (path: string) =>
    router.push(`/projects/${projectId}/drillholes/${hole.id}${path}` as Href);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <ThemedText type="subtitle" style={styles.number}>
              {sample.sampleNumber}
            </ThemedText>
            <StatusPill
              label={statusLabel(sample.status)}
              tone={sampleStatusTone(sample.status)}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {statusLabel(sample.type)}
            {sample.type !== 'primary' ? ' (QC)' : ''} · {hole.holeId}
            {sample.fromM != null && sample.toM != null
              ? ` · ${sample.fromM}–${sample.toM} m`
              : ''}
            {sample.type === 'duplicate' && parent
              ? ` · duplicate of ${parent.sampleNumber}`
              : ''}
          </ThemedText>
        </View>

        {missing.map((step) => (
          <AlertRow
            key={step.key}
            message={step.detail ?? `${step.title} is missing`}
            actionLabel={step.key === 'box' ? 'Add box' : 'Log it'}
            onPress={() =>
              goToHole(step.key === 'box' ? '/boxes/new' : '/log/new')
            }
          />
        ))}

        <Card style={styles.chainCard}>
          <ThemedText type="heading">Where this sample has been</ThemedText>
          <TraceChain steps={steps} />
        </Card>

        <Card style={styles.chainCard}>
          <ThemedText type="heading">Chain of custody</ThemedText>
          <CustodyTimeline lines={custodyLines} asOf={asOf} roster={roster} />
          {nextSteps.map((type, index) => (
            <PrimaryButton
              key={type}
              label={STEP_LABELS[type]}
              variant={index === 0 ? 'primary' : 'secondary'}
              onPress={() => recordStep(type)}
            />
          ))}
          {correctable ? (
            <Pressable
              onPress={() =>
                router.push(
                  `/projects/${projectId}/custody/correct?eventId=${correctable.id}&label=${encodeURIComponent(CUSTODY_LABELS[correctable.type])}` as Href,
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`Correct the last step: ${CUSTODY_LABELS[correctable.type]}`}
              style={styles.correct}
            >
              <ThemedText type="smallBold" themeColor="textSecondary">
                Correct the last step
              </ThemedText>
            </Pressable>
          ) : null}
        </Card>

        {sample.note ? (
          <Card style={styles.noteCard}>
            <ThemedText type="caption" themeColor="textSecondary">
              NOTE
            </ThemedText>
            <ThemedText type="default">{sample.note}</ThemedText>
          </Card>
        ) : null}

        <Pressable
          onPress={confirmDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete sample ${sample.sampleNumber}`}
          style={styles.delete}
        >
          <ThemedText type="smallBold" themeColor="danger">
            Delete sample
          </ThemedText>
        </Pressable>
      </ScrollView>
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
  number: {
    flex: 1,
  },
  chainCard: {
    gap: Spacing.three,
  },
  noteCard: {
    gap: Spacing.one,
  },
  correct: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  delete: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
});
