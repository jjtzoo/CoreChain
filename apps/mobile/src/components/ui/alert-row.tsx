import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AlertTone = 'warning' | 'danger' | 'info';

const TONES: Record<
  AlertTone,
  { fg: ThemeColor; bg: ThemeColor; icon: IconName }
> = {
  warning: { fg: 'warning', bg: 'warningSoft', icon: 'alert-outline' },
  danger: { fg: 'danger', bg: 'dangerSoft', icon: 'alert-octagon-outline' },
  info: { fg: 'accent', bg: 'accentSoft', icon: 'information-outline' },
};

/**
 * A one-line problem or heads-up, with an optional action ("Fix") that jumps
 * to where it can be dealt with.
 */
export function AlertRow({
  message,
  tone = 'warning',
  actionLabel,
  onPress,
}: {
  message: string;
  tone?: AlertTone;
  actionLabel?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const colors = TONES[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[styles.row, { backgroundColor: theme[colors.bg] }]}>
      <Icon name={colors.icon} size={22} themeColor={colors.fg} />
      <View style={styles.message}>
        <ThemedText type="small" themeColor={colors.fg}>
          {message}
        </ThemedText>
      </View>
      {actionLabel ? (
        <ThemedText type="smallBold" themeColor={colors.fg}>
          {actionLabel}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    minHeight: 48,
  },
  message: {
    flex: 1,
  },
});
