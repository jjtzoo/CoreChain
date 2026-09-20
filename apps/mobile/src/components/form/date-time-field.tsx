import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MinTap, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type DateTimeFieldProps = {
  label: string;
  /** The moment as an ISO string. */
  value: string;
  onChange: (iso: string) => void;
  error?: string;
};

export function describeMoment(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * A date and time chosen from the phone's own pickers, never typed, so it can
 * never be entered in the wrong format. It starts at the moment the form
 * opened; tap to change it (a bagging recorded later than it happened).
 */
export function DateTimeField({
  label,
  value,
  onChange,
  error,
}: DateTimeFieldProps) {
  const theme = useTheme();

  function choose() {
    const start = new Date(value);
    const base = Number.isNaN(start.getTime()) ? new Date() : start;
    DateTimePickerAndroid.open({
      value: base,
      mode: 'date',
      maximumDate: new Date(),
      onValueChange: (_event, day) => {
        DateTimePickerAndroid.open({
          value: day,
          mode: 'time',
          is24Hour: true,
          onValueChange: (_timeEvent, time) => {
            const chosen = new Date(day);
            chosen.setHours(time.getHours(), time.getMinutes(), 0, 0);
            onChange(chosen.toISOString());
          },
        });
      },
    });
  }

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Pressable
        onPress={choose}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${describeMoment(value)}. Change the date and time`}
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.danger : theme.border,
          },
        ]}
      >
        <ThemedText type="default">{describeMoment(value)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Change
        </ThemedText>
      </Pressable>
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one + 2,
  },
  input: {
    minHeight: MinTap,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.control,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
  },
});
