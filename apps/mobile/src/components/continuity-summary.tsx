import { analyseContinuity, type DepthRange } from '@corechain/domain';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export const WARNING_COLOR = '#b54708';

/**
 * Lists the gaps and overlaps between a hole's depth ranges (boxes, runs, and
 * later log intervals) using the shared `analyseContinuity` rule.
 */
export function ContinuitySummary({
  ranges,
}: {
  ranges: readonly DepthRange[];
}) {
  if (ranges.length < 2) {
    return null;
  }
  const { gaps, overlaps } = analyseContinuity(ranges);

  if (gaps.length === 0 && overlaps.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        No gaps or overlaps.
      </ThemedText>
    );
  }

  return (
    <View style={styles.list}>
      {gaps.map((gap) => (
        <ThemedText
          key={`gap-${gap.fromM}-${gap.toM}`}
          type="small"
          style={styles.warning}>
          Gap: {gap.fromM}–{gap.toM} m
        </ThemedText>
      ))}
      {overlaps.map((overlap) => (
        <ThemedText
          key={`overlap-${overlap.fromM}-${overlap.toM}`}
          type="small"
          style={styles.warning}>
          Overlap: {overlap.fromM}–{overlap.toM} m
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.one,
  },
  warning: {
    color: WARNING_COLOR,
  },
});
