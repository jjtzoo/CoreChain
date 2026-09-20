import { isoToLocalDate, type DayWork } from '@corechain/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const BAR_HEIGHT = 56;

/**
 * A row of days with a bar under each one that has work, so the rhythm of the
 * week shows at a glance. Tap a day to look at just that day.
 */
export function WorkWeekStrip({
  days,
  selectedFrom,
  selectedTo,
  onSelectDay,
}: {
  days: readonly DayWork[];
  selectedFrom: string;
  selectedTo: string;
  onSelectDay: (day: string) => void;
}) {
  const theme = useTheme();
  const busiest = Math.max(1, ...days.map((d) => d.activity));
  // One chosen day is a solid block; several days are only outlined.
  const single = selectedFrom === selectedTo;

  return (
    <View style={styles.row}>
      {days.map((day) => {
        const date = isoToLocalDate(day.day);
        const selected = day.day >= selectedFrom && day.day <= selectedTo;
        const solid = selected && single;
        return (
          <Pressable
            key={day.day}
            onPress={() => onSelectDay(day.day)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${day.day}: ${day.metres} metres logged, ${day.activity} records`}
            style={[
              styles.day,
              {
                backgroundColor: solid
                  ? theme.accent
                  : selected
                    ? theme.backgroundSelected
                    : theme.backgroundElement,
                borderColor: selected ? theme.accent : theme.border,
              },
            ]}>
            <ThemedText
              type="caption"
              style={{
                color: solid ? theme.onAccent : theme.textSecondary,
              }}>
              {date ? WEEKDAY_LETTERS[date.getDay()] : ''}
            </ThemedText>
            <ThemedText
              type="smallBold"
              style={{ color: solid ? theme.onAccent : theme.text }}>
              {date ? date.getDate() : ''}
            </ThemedText>
            <View style={styles.barTrack}>
              {day.activity > 0 ? (
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(
                        6,
                        (day.activity / busiest) * BAR_HEIGHT,
                      ),
                      backgroundColor: solid ? theme.onAccent : theme.brand,
                    },
                  ]}
                />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.one + 1,
  },
  day: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.control,
  },
  barTrack: {
    height: BAR_HEIGHT,
    justifyContent: 'flex-end',
  },
  bar: {
    width: 10,
    borderRadius: 4,
  },
});
