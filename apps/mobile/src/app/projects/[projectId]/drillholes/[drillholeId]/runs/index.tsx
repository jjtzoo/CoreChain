import {
  drilledLengthM,
  recoveryPercent,
  rqdPercent,
  type FieldCoreRun,
} from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContinuitySummary } from '@/components/continuity-summary';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { RowAction } from '@/components/ui/row-action';
import { Spacing } from '@/constants/theme';
import { deleteRun, listRuns } from '@/data/coreRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';

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

  useFocusReload(reload);

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
          <Card style={styles.card}>
            <ThemedText type="default">No runs yet.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Enter each run&apos;s from/to depth and recovered length —
              recovery % is worked out for you.
            </ThemedText>
          </Card>
        ) : (
          (runs ?? []).map((run) => (
            <Card key={run.id} style={styles.card}>
              <View style={styles.rowText}>
                <ThemedText type="heading">
                  {run.fromM}–{run.toM} m
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {describeRun(run)}
                </ThemedText>
              </View>
              <View style={styles.actions}>
                <RowAction
                  icon="trash-can-outline"
                  tone="danger"
                  onPress={() => confirmDelete(run)}
                  accessibilityLabel={`Delete run ${run.fromM} to ${run.toM} metres`}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
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
