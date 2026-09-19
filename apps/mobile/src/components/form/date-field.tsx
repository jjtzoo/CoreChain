import { isoToLocalDate, localDateToIso } from '@corechain/domain';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type DateFieldProps = {
  label: string;
  /** The chosen date as `YYYY-MM-DD`, or null when none is set. */
  value: string | null;
  onChange: (isoDate: string | null) => void;
  /** Earliest date the calendar allows, as `YYYY-MM-DD`. */
  minimumDate?: string | null;
  optional?: boolean;
  error?: string;
};

function describe(isoDate: string): string {
  const date = isoToLocalDate(isoDate);
  return date
    ? date.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : isoDate;
}

/**
 * A date the geologist picks from the phone's calendar instead of typing, so
 * a date can never be entered in the wrong format. The calendar opens on the
 * chosen date, or on today when nothing is set yet.
 */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  optional,
  error,
}: DateFieldProps) {
  const theme = useTheme();

  function openCalendar() {
    DateTimePickerAndroid.open({
      value: isoToLocalDate(value) ?? new Date(),
      mode: 'date',
      minimumDate: isoToLocalDate(minimumDate ?? null) ?? undefined,
      onValueChange: (_event, date) => onChange(localDateToIso(date)),
    });
  }

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
      <View style={styles.row}>
        <Pressable
          onPress={openCalendar}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value ? describe(value) : 'not set'}. Choose a date`}
          style={[
            styles.input,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: error ? '#d92d20' : 'transparent',
            },
          ]}>
          <ThemedText
            type="default"
            themeColor={value ? 'text' : 'textSecondary'}>
            {value ? describe(value) : 'Not set — tap to choose'}
          </ThemedText>
        </Pressable>
        {value ? (
          <Pressable
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            hitSlop={Spacing.two}>
            <ThemedText type="small" themeColor="textSecondary">
              Clear
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  input: {
    flex: 1,
    borderRadius: Spacing.two,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  error: {
    color: '#d92d20',
  },
});
