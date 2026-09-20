import type { SyncSummary, SyncTone } from '@corechain/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useSync } from '@/sync/sync-context';

const TONES: Record<SyncTone, { icon: IconName; color: ThemeColor }> = {
  ok: { icon: 'cloud-check-outline', color: 'success' },
  busy: { icon: 'cloud-sync-outline', color: 'accent' },
  waiting: { icon: 'cloud-off-outline', color: 'textSecondary' },
  attention: { icon: 'cloud-alert-outline', color: 'warning' },
  off: { icon: 'cloud-off-outline', color: 'danger' },
};

export function syncTone(summary: SyncSummary) {
  return TONES[summary.tone];
}

/**
 * One line under the greeting: is my work safe, and is it on the server? Tapping
 * it opens the account screen, where the detail is.
 */
export function SyncStatusLine({ onPress }: { onPress?: () => void }) {
  const { summary } = useSync();
  if (!summary) {
    return (
      <View style={styles.row}>
        <Icon name="cellphone-check" size={18} themeColor="success" />
        <ThemedText type="small" themeColor="textSecondary">
          Saved on this phone. Works without signal.
        </ThemedText>
      </View>
    );
  }
  const tone = TONES[summary.tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${summary.title}. ${summary.detail}`}
      style={styles.row}
    >
      <Icon name={tone.icon} size={18} themeColor={tone.color} />
      <ThemedText type="small" themeColor="textSecondary">
        {summary.title}
        {summary.tone === 'ok' || summary.tone === 'waiting'
          ? ' · saved on this phone'
          : ''}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
