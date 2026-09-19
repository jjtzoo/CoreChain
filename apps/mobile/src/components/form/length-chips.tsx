import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';

/**
 * One-tap lengths for the common case: "this box / run / sample is 3 m long".
 * Tapping a chip sets the "to" depth to "from" plus that length. Ignored
 * until "from" holds a number.
 */
export function LengthChips({
  fromText,
  lengths,
  onPick,
  label = 'Quick length',
}: {
  fromText: string;
  lengths: readonly number[];
  /** Receives the new "to" depth as text. */
  onPick: (toText: string) => void;
  label?: string;
}) {
  const from = Number(fromText);
  const ready = fromText.trim().length > 0 && Number.isFinite(from);

  return (
    <View style={styles.container}>
      <ThemedText type="caption" themeColor="textSecondary">
        {label.toUpperCase()}
      </ThemedText>
      <View style={styles.row}>
        {lengths.map((length) => (
          <Chip
            key={length}
            label={`${length} m`}
            selected={false}
            accessibilityLabel={`Make it ${length} metres long`}
            onPress={() => {
              if (ready) {
                onPick(String(Math.round((from + length) * 1000) / 1000));
              }
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one + 2,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
