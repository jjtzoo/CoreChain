import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The basic surface of the app: a bordered white (or dark) card. Give it
 * `onPress` and it becomes a tappable card with pressed feedback.
 */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  accessibilityState,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityState?: { disabled?: boolean };
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const surface = {
    backgroundColor: theme.backgroundElement,
    borderColor: theme.border,
  };

  if (!onPress) {
    return <View style={[styles.card, surface, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      style={({ pressed }) => [
        styles.card,
        surface,
        pressed && { backgroundColor: theme.backgroundSelected },
        style,
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.three,
  },
});
