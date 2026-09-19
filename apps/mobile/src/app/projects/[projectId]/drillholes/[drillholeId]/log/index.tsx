import type { FieldDrillhole, LogInterval } from '@corechain/domain';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContinuityStrip } from '@/components/continuity-strip';
import { ContinuitySummary } from '@/components/continuity-summary';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { getDrillhole } from '@/data/drillholesRepository';
import { deleteInterval, listIntervals } from '@/data/intervalsRepository';
import { countPhotosBySubject } from '@/data/photosRepository';

function describeInterval(interval: LogInterval): string {
  const parts: string[] = [];
  if (interval.lithology) {
    parts.push(interval.lithology);
  }
  if (interval.alterationType) {
    parts.push(
      interval.alterationIntensity
        ? `${interval.alterationType}${interval.alterationIntensity}`
        : interval.alterationType,
    );
  }
  if (interval.mineral) {
    parts.push(
      interval.mineralPercent != null
        ? `${interval.mineral} ${interval.mineralPercent}%`
        : interval.mineral,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : 'No codes yet';
}

/** E4-3 / E4-4: the hole's geological log, with a continuity strip. */
export default function LogScreen() {
  const { projectId, drillholeId } = useLocalSearchParams<{
    projectId: string;
    drillholeId: string;
  }>();
  const router = useRouter();
  const [drillhole, setDrillhole] = useState<FieldDrillhole | null>(null);
  const [intervals, setIntervals] = useState<LogInterval[] | null>(null);
  const [photoCounts, setPhotoCounts] = useState<Map<string, number>>(new Map());

  const reload = useCallback(() => {
    getDrillhole(drillholeId).then(setDrillhole);
    listIntervals(drillholeId).then(setIntervals);
    countPhotosBySubject(drillholeId, 'interval').then(setPhotoCounts);
  }, [drillholeId]);

  useFocusEffect(reload);

  function confirmDelete(interval: LogInterval) {
    Alert.alert(
      'Delete this interval?',
      `${interval.fromM}–${interval.toM} m will be removed from the log.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteInterval(interval.id).then(reload),
        },
      ],
    );
  }

  const holeDepthM = drillhole
    ? (drillhole.actualFinalDepthM ?? drillhole.plannedDepthM)
    : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <PrimaryButton
          label="Add interval"
          onPress={() =>
            router.push(`/projects/${projectId}/drillholes/${drillholeId}/log/new`)
          }
        />
        <PrimaryButton
          label="Code library"
          variant="secondary"
          onPress={() => router.push(`/projects/${projectId}/codes`)}
        />

        <ContinuityStrip ranges={intervals ?? []} holeDepthM={holeDepthM} />
        <ContinuitySummary ranges={intervals ?? []} />

        {intervals && intervals.length === 0 ? (
          <Card style={styles.card}>
            <ThemedText type="default">Nothing logged yet.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Add an interval with its from/to depth and codes. Each new one
              starts where the last ended.
            </ThemedText>
          </Card>
        ) : (
          (intervals ?? []).map((interval) => (
            <Card key={interval.id} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <ThemedText type="default">
                    {interval.fromM}–{interval.toM} m
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {describeInterval(interval)}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() =>
                    router.push(
                      `/projects/${projectId}/samples/new?drillholeId=${drillholeId}&fromM=${interval.fromM}&toM=${interval.toM}`,
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Sample interval ${interval.fromM} to ${interval.toM} metres`}
                  hitSlop={Spacing.two}>
                  <ThemedText type="link">Sample</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() =>
                    router.push(
                      `/projects/${projectId}/drillholes/${drillholeId}/photos?subjectType=interval&subjectId=${interval.id}`,
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Photos of interval ${interval.fromM} to ${interval.toM} metres`}
                  hitSlop={Spacing.two}>
                  <ThemedText type="link">
                    Photos ({photoCounts.get(interval.id) ?? 0})
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(interval)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete interval ${interval.fromM} to ${interval.toM} metres`}
                  hitSlop={Spacing.two}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Delete
                  </ThemedText>
                </Pressable>
              </View>
            </Card>
          ))
        )}
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
  },
  card: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
});
