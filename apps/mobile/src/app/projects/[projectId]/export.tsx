import type { ExportTable } from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { CoachmarkOverlay } from '@/components/guide/coachmark-overlay';
import { Spacing } from '@/constants/theme';
import { loadExportTables, shareTable } from '@/data/exportRepository';
import { useGuideStep } from '@/guide/use-guide-step';
import { useFocusReload } from '@/hooks/use-focus-reload';

/**
 * E9-1: export the project's data as CSV — one file per table — through the
 * Android share sheet. Reads only the local database, so it works offline.
 */
export default function ExportScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const guide = useGuideStep('export', projectId ?? null);
  const [tables, setTables] = useState<ExportTable[] | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Overrides the project name in each file's name, for this visit only —
  // nothing is saved, so it resets to the project name next time.
  const [filenamePrefix, setFilenamePrefix] = useState('');

  async function finishGuide() {
    if (!('step' in guide)) return;
    await guide.advance();
    router.push('/account');
  }

  const load = useCallback(() => {
    loadExportTables(projectId, filenamePrefix.trim() || undefined)
      .then(setTables)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : String(err)),
      );
  }, [projectId, filenamePrefix]);

  useFocusReload(load);
  useEffect(load, [load]);

  async function handleShare(table: ExportTable) {
    setError(null);
    setSharing(table.name);
    try {
      await shareTable(table);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSharing(null);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="small" themeColor="textSecondary">
          One CSV file per table. Hole and depth columns are named HOLEID, FROM
          and TO, the names most drillhole importers expect. Pick an app from
          the share sheet to save or send each file. This works without a
          signal.
        </ThemedText>

        <TextField
          label="File name prefix"
          optional
          placeholder="Defaults to the project name"
          value={filenamePrefix}
          onChangeText={setFilenamePrefix}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {error ? (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        ) : null}

        {(tables ?? []).map((table) => (
          <Card key={table.name} style={styles.card}>
            <View style={styles.cardText}>
              <ThemedText type="default">{table.label}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {table.filename} · {table.rowCount}{' '}
                {table.rowCount === 1 ? 'row' : 'rows'}
              </ThemedText>
            </View>
            <PrimaryButton
              label="Share"
              variant="secondary"
              loading={sharing === table.name}
              onPress={() => handleShare(table)}
            />
          </Card>
        ))}

        <ThemedText type="small" themeColor="textSecondary">
          Dispatch sheets will be added when custody and dispatch land.
        </ThemedText>
      </ScrollView>
      {'step' in guide && guide.visible ? (
        <CoachmarkOverlay
          step={guide.step}
          stepNumber={guide.stepNumber}
          totalSteps={guide.totalSteps}
          nextLabel="Finish guide"
          onNext={() => void finishGuide()}
          onSkip={() => void guide.skip()}
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
  },
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardText: {
    gap: Spacing.half,
  },
});
