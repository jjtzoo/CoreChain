import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';

/** A big number with a label and an optional line of detail (My work). */
export function StatTile({
  value,
  label,
  detail,
}: {
  value: number | string;
  label: string;
  detail?: string;
}) {
  return (
    <Card style={styles.tile} accessibilityLabel={`${label}: ${value}`}>
      <View style={styles.inner}>
        <ThemedText type="title" style={styles.value}>
          {value}
        </ThemedText>
        <ThemedText type="smallBold">{label}</ThemedText>
        {detail ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {detail}
          </ThemedText>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  inner: {
    gap: Spacing.half,
  },
  value: {
    fontSize: 30,
    lineHeight: 36,
  },
});
