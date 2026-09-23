import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One option in a row of single-select chips. Selected = solid accent fill
 * with inverted text, which stays obvious in direct sunlight.
 *
 * The label keeps the same weight whether or not the chip is selected. Android
 * measured a bold label as if it were regular, so a chip that turned bold when
 * chosen cut its own text short ("Wi-Fi only" showed as "Wi-Fi").
 */
export function Chip({
  label,
  selected,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.backgroundElement,
          borderColor: selected ? theme.accent : theme.border,
        },
        disabled && styles.disabled,
      ]}>
      <ThemedText
        type="small"
        style={selected ? { color: theme.onAccent } : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three - 4,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  disabled: {
    opacity: 0.4,
  },
});
