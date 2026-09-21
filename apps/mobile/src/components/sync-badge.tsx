import { recordSyncLabel } from '@corechain/domain';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import type { MarkerKind } from '@/data/syncMarkersRepository';
import { useSync } from '@/sync/sync-context';

/**
 * E8-4: a small line under a record in a list when it has not reached the
 * server yet. A record that is sent shows nothing, so the list stays calm.
 * "Waiting" is quiet grey (no signal is normal at a rig); only a change the
 * server refused is drawn in the warning colour.
 */
export function SyncBadge({ kind, id }: { kind: MarkerKind; id: string }) {
  const { recordSync } = useSync();
  const state = recordSync(kind, id);
  const label = recordSyncLabel(state);
  if (!label) return null;
  const attention = state === 'attention';
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <Icon
        name={attention ? 'cloud-alert-outline' : 'cloud-upload-outline'}
        size={16}
        themeColor={attention ? 'warning' : 'textSecondary'}
      />
      <ThemedText
        type="caption"
        themeColor={attention ? 'warning' : 'textSecondary'}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
