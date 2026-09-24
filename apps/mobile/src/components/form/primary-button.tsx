import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { LoopingBrandFill } from '@/components/brand-fill';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { MinTap, Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/** Fits inside the button's 52 px height with room around it. */
const LOADER_SIZE = 32;

export type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  /** An icon shown before the label. */
  icon?: IconName;
};

// A second tap this soon after the first is an accident (gloves, a bumpy
// truck), not a second decision. Without this a quick double tap on a save
// button runs the save twice before the screen has time to react.
const DOUBLE_TAP_MS = 1000;

/**
 * The app's button. Primary is a solid accent fill (the one main action on a
 * screen); secondary is an outlined button for everything else. Both are big
 * enough to hit with gloves on. Danger is outlined in red, for actions that
 * remove something. A second tap within a second is ignored.
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
  const dark = useColorScheme() === 'dark';
  const lastPressAt = useRef(0);
  const handlePress = () => {
    const now = Date.now();
    if (now - lastPressAt.current < DOUBLE_TAP_MS) return;
    lastPressAt.current = now;
    onPress();
  };
  const isDisabled = disabled || loading;
  const primary = variant === 'primary';
  const danger = variant === 'danger';
  const labelColor = primary
    ? theme.onAccent
    : danger
      ? theme.danger
      : theme.accent;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: theme.accent }
          : {
              borderWidth: 1.5,
              borderColor: danger ? theme.danger : theme.accent,
            },
        pressed && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        // The solid primary fill is the opposite of the page, so it needs the
        // other symbol; outlined buttons sit on the page itself.
        <LoopingBrandFill
          size={LOADER_SIZE}
          tone={primary === dark ? 'onLight' : 'onDark'}
          accessibilityLabel={label}
        />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Icon
              name={icon}
              size={22}
              themeColor={primary ? 'onAccent' : danger ? 'danger' : 'accent'}
            />
          ) : null}
          <ThemedText
            type="smallBold"
            style={[styles.label, { color: labelColor }]}
          >
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
