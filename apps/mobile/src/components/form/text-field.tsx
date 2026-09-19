import { StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = TextInputProps & {
  label: string;
  error?: string;
  optional?: boolean;
};

/**
 * A labelled text input shared by every create/edit form in Sprint 1
 * (E1-1, E1-2, E2-1, E2-2), so validation errors always render the same way.
 */
export function TextField({
  label,
  error,
  optional,
  style,
  ...inputProps
}: TextFieldProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">
        {label}
        {optional ? (
          <ThemedText type="small" themeColor="textSecondary">
            {' '}
            (optional)
          </ThemedText>
        ) : null}
      </ThemedText>
      <TextInput
        style={[
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.backgroundElement,
            borderColor: error ? '#d92d20' : 'transparent',
          },
          style,
        ]}
        placeholderTextColor={theme.textSecondary}
        {...inputProps}
      />
      {error ? (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  input: {
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  error: {
    color: '#d92d20',
  },
});
