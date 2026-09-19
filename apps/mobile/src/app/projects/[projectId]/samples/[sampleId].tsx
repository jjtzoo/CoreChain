import {
  buildSampleTrace,
  type FieldCoreBox,
  type FieldDrillhole,
  type FieldSample,
  type LogInterval,
} from '@corechain/domain';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
  type Href,
} from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AlertRow } from '@/components/ui/alert-row';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { TraceChain } from '@/components/ui/trace-chain';
import { Spacing } from '@/constants/theme';
import { listBoxes } from '@/data/coreRepository';
import { getDrillhole } from '@/data/drillholesRepository';
import { listIntervals } from '@/data/intervalsRepository';
import { countPhotosBySubject } from '@/data/photosRepository';
import { deleteSample, getSample, listHoleSamples } from '@/data/samplesRepository';
import { sampleStatusTone, statusLabel } from '@/utils/status';

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

  const [sample, setSample] = useState<FieldSample | null>(null);
  const [hole, setHole] = useState<FieldDrillhole | null>(null);
  const [boxes, setBoxes] = useState<(FieldCoreBox & { photoCount: number })[]>([]);
  const [intervals, setIntervals] = useState<LogInterval[]>([]);
  const [parent, setParent] = useState<FieldSample | null>(null);

  const load = useCallback(() => {
    (async () => {
      const loaded = await getSample(sampleId);
      setSample(loaded);
      if (!loaded) {
        return;
      }
      const [loadedHole, loadedBoxes, loadedIntervals, photoCounts, holeSamples] =
        await Promise.all([
          getDrillhole(loaded.drillholeId),
          listBoxes(loaded.drillholeId),
          listIntervals(loaded.drillholeId),
          countPhotosBySubject(loaded.drillholeId, 'box'),
          listHoleSamples(loaded.drillholeId),
        ]);
      setHole(loadedHole);
      setBoxes(loadedBoxes.map((b) => ({ ...b, photoCount: photoCounts.get(b.id) ?? 0 })));
      setIntervals(loadedIntervals);
      setParent(holeSamples.find((s) => s.id === loaded.parentSampleId) ?? null);
    })();
  }, [sampleId]);

  useFocusEffect(load);

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
    return null;
  }

  const missing = steps.filter((s) => s.state === 'missing');
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
            onPress={() => goToHole(step.key === 'box' ? '/boxes/new' : '/log/new')}
          />
        ))}

        <Card style={styles.chainCard}>
          <ThemedText type="heading">Where this sample has been</ThemedText>
          <TraceChain steps={steps} />
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
          style={styles.delete}>
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
  delete: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
});
