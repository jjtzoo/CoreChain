import type { ExportTable } from '@corechain/domain';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { loadExportTables, shareTable } from '@/data/exportRepository';

/**
 * E9-1: export the project's data as CSV — one file per table — through the
 * Android share sheet. Reads only the local database, so it works offline.
 */
export default function ExportScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const [tables, setTables] = useState<ExportTable[] | null>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    loadExportTables(projectId)
      .then(setTables)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : String(err)),
      );
  }, [projectId]);

  useFocusEffect(load);

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
          One CSV file per table, with HOLEID / FROM / TO columns that Excel,
          Leapfrog and GEOVIA can import. Pick an app from the share sheet to
          save or send each file. This works without a signal.
        </ThemedText>

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
