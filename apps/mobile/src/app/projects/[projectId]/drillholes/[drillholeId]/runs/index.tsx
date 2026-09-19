import {
  drilledLengthM,
  recoveryPercent,
  rqdPercent,
  type FieldCoreRun,
} from '@corechain/domain';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContinuitySummary } from '@/components/continuity-summary';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { deleteRun, listRuns } from '@/data/coreRepository';

function describeRun(run: FieldCoreRun): string {
  const drilled = drilledLengthM(run);
  const recovery = recoveryPercent(drilled, run.recoveredM);
  const rqd =
    run.rqdPiecesM != null ? rqdPercent(drilled, run.rqdPiecesM) : null;
  const parts = [`recovered ${run.recoveredM} m`];
  if (recovery != null) {
    parts[0] += ` (${recovery}%)`;
  }
  if (rqd != null) {
    parts.push(`RQD ${rqd}%`);
  }
  return parts.join(' · ');
}

/** E3-2 / E3-3: the hole's drilling runs with recovery % and RQD %. */
export default function CoreRunsScreen() {
  const { projectId, drillholeId } = useLocalSearchParams<{
    projectId: string;
    drillholeId: string;
  }>();
  const router = useRouter();
  const [runs, setRuns] = useState<FieldCoreRun[] | null>(null);

  const reload = useCallback(() => {
    listRuns(drillholeId).then(setRuns);
  }, [drillholeId]);

  useFocusEffect(reload);

  function confirmDelete(run: FieldCoreRun) {
    Alert.alert(
      'Delete this run?',
      `${run.fromM}–${run.toM} m will be removed from this hole.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteRun(run.id).then(reload),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <PrimaryButton
          label="Add run"
          onPress={() =>
            router.push(
              `/projects/${projectId}/drillholes/${drillholeId}/runs/new`,
            )
          }
        />

        <ContinuitySummary ranges={runs ?? []} />

        {runs && runs.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="default">No runs yet.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Enter each run&apos;s from/to depth and recovered length —
              recovery % is worked out for you.
            </ThemedText>
          </ThemedView>
        ) : (
          (runs ?? []).map((run) => (
            <ThemedView
              key={run.id}
              type="backgroundElement"
              style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <ThemedText type="default">
                    {run.fromM}–{run.toM} m
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {describeRun(run)}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => confirmDelete(run)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete run ${run.fromM} to ${run.toM} metres`}
                  hitSlop={Spacing.two}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Delete
                  </ThemedText>
                </Pressable>
              </View>
            </ThemedView>
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
    borderRadius: Spacing.two,
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
