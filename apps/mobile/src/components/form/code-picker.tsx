import {
  CODE_CATEGORY_LABELS,
  visibleCodes,
  type CodeCategory,
  type LibraryCode,
} from '@corechain/domain';
import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';

/**
 * E4-3: a pick-list of the project's visible codes with free text always
 * allowed — tap a chip to fill the field, or just type anything.
 */
export function CodePicker({
  category,
  codes,
  value,
  onChange,
  label,
}: {
  category: CodeCategory;
  codes: readonly LibraryCode[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const options = visibleCodes(codes, category);
  const matched = codes.find(
    (c) =>
      c.category === category &&
      c.code.toLowerCase() === value.trim().toLowerCase(),
  );

  return (
    <View style={styles.container}>
      <TextField
        label={label ?? CODE_CATEGORY_LABELS[category]}
        optional
        value={value}
        onChangeText={onChange}
        autoCapitalize="characters"
      />
      {matched ? (
        <ThemedText type="small" themeColor="textSecondary">
          {matched.code} — {matched.description}
        </ThemedText>
      ) : null}
      {options.length > 0 ? (
        <View style={styles.chips}>
          {options.map((option) => (
            <Chip
              key={option.id}
              label={option.code}
              selected={option.code.toLowerCase() === value.trim().toLowerCase()}
              accessibilityLabel={`${option.code}, ${option.description}`}
              onPress={() =>
                onChange(
                  option.code.toLowerCase() === value.trim().toLowerCase()
                    ? ''
                    : option.code,
                )
              }
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
