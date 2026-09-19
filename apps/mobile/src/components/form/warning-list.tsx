import { StyleSheet, View } from 'react-native';

import { WARNING_COLOR } from '@/components/continuity-summary';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * Warnings that don't block saving but must be acknowledged: the form shows
 * them and turns its save button into "Save anyway".
 */
export function WarningList({ warnings }: { warnings: readonly string[] }) {
  if (warnings.length === 0) {
    return null;
  }
  return (
    <View style={styles.box}>
      {warnings.map((warning) => (
        <ThemedText key={warning} type="small" style={styles.text}>
          {warning}
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1.5,
    borderColor: WARNING_COLOR,
  },
  text: {
    color: WARNING_COLOR,
  },
});
