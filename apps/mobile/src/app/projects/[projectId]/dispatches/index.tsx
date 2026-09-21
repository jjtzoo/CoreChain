import { type DispatchStatus } from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { SyncBadge } from '@/components/sync-badge';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import {
  listDispatches,
  type DispatchSummary,
} from '@/data/dispatchRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { describeDay } from '@/utils/dates';

const STATUS_LABEL: Record<DispatchStatus, string> = {
  open: 'Open',
  dispatched: 'Dispatched',
};

/** E7-2: the project's lab dispatches, newest first. */
export default function DispatchesScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const [dispatches, setDispatches] = useState<DispatchSummary[] | null>(null);

  const load = useCallback(() => {
    listDispatches(projectId)
      .then(setDispatches)
      .catch(() => setDispatches([]));
  }, [projectId]);
  useFocusReload(load);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <PrimaryButton
          label="New dispatch"
          icon="plus"
          onPress={() => router.push(`/projects/${projectId}/dispatches/new`)}
        />

        {dispatches && dispatches.length === 0 ? (
          <Card style={styles.empty}>
            <Icon name="truck-delivery-outline" size={32} themeColor="accent" />
            <ThemedText type="heading">No dispatches yet</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              Bag your samples, then group them into a dispatch for the
              laboratory. Handing it over records every sample as dispatched and
              gives you a sheet to share.
            </ThemedText>
          </Card>
        ) : (
          (dispatches ?? []).map((dispatch) => (
            <Card
              key={dispatch.id}
              onPress={() =>
                router.push(`/projects/${projectId}/dispatches/${dispatch.id}`)
              }
              accessibilityLabel={`Open dispatch ${dispatch.dispatchNumber}`}
            >
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <ThemedText type="heading">
                    {dispatch.dispatchNumber}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {dispatch.laboratory} · {dispatch.sampleCount}{' '}
                    {dispatch.sampleCount === 1 ? 'sample' : 'samples'}
                    {dispatch.handoverAt
                      ? ` · ${describeDay(dispatch.handoverAt)}`
                      : ''}
                  </ThemedText>
                  <SyncBadge kind="dispatch" id={dispatch.id} />
                </View>
                <StatusPill
                  label={STATUS_LABEL[dispatch.status]}
                  tone={dispatch.status === 'open' ? 'warning' : 'success'}
                />
                <Icon name="chevron-right" size={24} themeColor="muted" />
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
    paddingBottom: Spacing.five,
  },
  empty: {
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  rowText: {
    flex: 1,
    gap: Spacing.one,
  },
});
