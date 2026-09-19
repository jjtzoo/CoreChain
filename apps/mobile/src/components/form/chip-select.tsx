import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';

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
  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.row}>
        {options.map((option) => (
          <Chip
            key={option}
            label={formatOption ? formatOption(option) : option}
            selected={option === value}
            onPress={() => onChange(option)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
