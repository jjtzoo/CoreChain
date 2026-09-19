import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { MinTap, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  /** An icon shown before the label. */
  icon?: IconName;
};

/**
 * The app's button. Primary is a solid accent fill (the one main action on a
 * screen); secondary is an outlined button for everything else. Both are big
 * enough to hit with gloves on.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  icon,
}: PrimaryButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const primary = variant === 'primary';
  const labelColor = primary ? theme.onAccent : theme.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: theme.accent }
          : { borderWidth: 1.5, borderColor: theme.accent },
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Icon name={icon} size={22} themeColor={primary ? 'onAccent' : 'accent'} />
          ) : null}
          <ThemedText type="smallBold" style={[styles.label, { color: labelColor }]}>
            {label}
          </ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MinTap,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.control,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    fontSize: 16,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
