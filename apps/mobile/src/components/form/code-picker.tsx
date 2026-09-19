import {
  CODE_CATEGORY_LABELS,
  visibleCodes,
  type CodeCategory,
  type LibraryCode,
} from '@corechain/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SELECTED_COLOR = '#208AEF';

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
  const theme = useTheme();
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
          {options.map((option) => {
            const selected =
              option.code.toLowerCase() === value.trim().toLowerCase();
            return (
              <Pressable
                key={option.id}
                onPress={() => onChange(selected ? '' : option.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.code}, ${option.description}`}
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
                  {option.code}
                </ThemedText>
              </Pressable>
            );
          })}
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
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  selectedLabel: {
    color: '#ffffff',
  },
});
