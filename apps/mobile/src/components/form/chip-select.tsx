import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ChipSelectProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  formatOption?: (option: T) => string;
};

/**
 * A row of single-select chips for a short fixed list of options (a
 * coordinate system, a drillhole status). Avoids adding a native picker
 * dependency for a handful of choices.
 */
export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  formatOption,
}: ChipSelectProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected
                    ? SELECTED_COLOR
                    : theme.backgroundElement,
                },
              ]}>
              <ThemedText
                type={selected ? 'smallBold' : 'small'}
                style={selected ? styles.selectedLabel : undefined}>
                {formatOption ? formatOption(option) : option}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// A solid fill with a white bold label, so the selected option stays obvious
// in direct sunlight — the neutral "selected" grey is only a few shades off the
// unselected chip.
const SELECTED_COLOR = '#208AEF';

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  selectedLabel: {
    color: '#ffffff',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
});
