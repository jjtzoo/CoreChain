import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Warnings that don't block saving but must be acknowledged: the form shows
 * them and turns its save button into "Save anyway".
 */
export function WarningList({ warnings }: { warnings: readonly string[] }) {
  const theme = useTheme();
  if (warnings.length === 0) {
    return null;
  }
  return (
    <View style={[styles.box, { backgroundColor: theme.warningSoft }]}>
      {warnings.map((warning) => (
        <ThemedText key={warning} type="small" themeColor="warning">
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
    borderRadius: Radius.control,
  },
});
