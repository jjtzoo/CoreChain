import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';

/**
 * One-tap lengths for the common case: "this box / run / sample is 3 m long".
 * Tapping a chip sets the "to" depth to "from" plus that length. Ignored
 * until "from" holds a number.
 *
 * `landmarks` are depths already known further down the hole (the end of a
 * run or box, the planned depth): one tap sets the "to" depth to exactly that,
 * so it never has to be typed twice.
 */
export function LengthChips({
  fromText,
  lengths,
  onPick,
  label = 'Quick length',
  landmarks = [],
}: {
  fromText: string;
  lengths: readonly number[];
  /** Receives the new "to" depth as text. */
  onPick: (toText: string) => void;
  label?: string;
  /** Known depths the record could end at, nearest first. */
  landmarks?: readonly { depthM: number; label: string }[];
}) {
  const from = Number(fromText);
  const ready = fromText.trim().length > 0 && Number.isFinite(from);

  return (
    <View style={styles.wrapper}>
      {landmarks.length > 0 ? (
        <View style={styles.container}>
          <ThemedText type="caption" themeColor="textSecondary">
            KNOWN DEPTHS
          </ThemedText>
          <View style={styles.row}>
            {landmarks.map((landmark) => (
              <Chip
                key={landmark.depthM}
                label={landmark.label}
                selected={false}
                accessibilityLabel={`End at ${landmark.depthM} metres: ${landmark.label}`}
                onPress={() =>
                  onPick(String(Math.round(landmark.depthM * 1000) / 1000))
                }
              />
            ))}
          </View>
        </View>
      ) : null}
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.three,
  },
  container: {
    gap: Spacing.one + 2,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
