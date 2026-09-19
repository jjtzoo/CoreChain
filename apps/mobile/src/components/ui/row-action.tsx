import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A small action on a list row ("Photos (2)", "Sample", delete). At least 44
 * px tall and wide so it can be hit with gloves on; icon-only when `label` is
 * left out.
 */
export function RowAction({
  icon,
  label,
  onPress,
  accessibilityLabel,
  tone = 'accent',
}: {
  icon: IconName;
  label?: string;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'accent' | 'danger';
}) {
  const theme = useTheme();
  const color: ThemeColor = tone === 'danger' ? 'danger' : 'accent';
  const softColor: ThemeColor = tone === 'danger' ? 'dangerSoft' : 'accentSoft';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: theme[softColor] },
        pressed && styles.pressed,
      ]}>
      <Icon name={icon} size={20} themeColor={color} />
      {label ? (
        <ThemedText type="smallBold" themeColor={color}>
          {label}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: Spacing.two + 4,
    borderRadius: Radius.control,
  },
  pressed: {
    opacity: 0.8,
  },
});
