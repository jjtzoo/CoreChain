import {
  continuityStrip,
  type DepthRange,
  type StripSegment,
} from '@corechain/domain';
import { StyleSheet, View } from 'react-native';

import { WARNING_COLOR } from '@/components/continuity-summary';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const LOGGED_COLOR = '#2e9e6b';
const OVERLAP_COLOR = '#d92d20';

const SEGMENT_COLORS: Record<StripSegment['kind'], string> = {
  logged: LOGGED_COLOR,
  gap: WARNING_COLOR,
  overlap: OVERLAP_COLOR,
};

/**
 * E4-4: a bar of the hole from 0 m to its final (or planned) depth, showing
 * logged stretches, gaps and overlaps at a glance.
 */
export function ContinuityStrip({
  ranges,
  holeDepthM,
}: {
  ranges: readonly DepthRange[];
  holeDepthM: number;
}) {
  const theme = useTheme();
  const deepestM = ranges.reduce((deepest, r) => Math.max(deepest, r.toM), 0);
  const scaleM = Math.max(holeDepthM, deepestM);

  if (scaleM <= 0) {
    return null;
  }

  const segments = continuityStrip(ranges);
  const hasGap = segments.some((s) => s.kind === 'gap');
  const hasOverlap = segments.some((s) => s.kind === 'overlap');

  return (
    <View style={styles.container}>
      <View
        style={[styles.bar, { backgroundColor: theme.backgroundElement }]}
        accessibilityLabel="Continuity strip of the logged hole">
        {segments.map((segment) => (
          <View
            key={`${segment.kind}-${segment.fromM}-${segment.toM}`}
            style={[
              styles.segment,
              {
                left: `${(Math.max(0, segment.fromM) / scaleM) * 100}%`,
                width: `${((segment.toM - segment.fromM) / scaleM) * 100}%`,
                backgroundColor: SEGMENT_COLORS[segment.kind],
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.scale}>
        <ThemedText type="small" themeColor="textSecondary">
          0 m
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {scaleM} m
        </ThemedText>
      </View>
      <View style={styles.legend}>
        <LegendItem color={LOGGED_COLOR} label="Logged" />
        {hasGap ? <LegendItem color={WARNING_COLOR} label="Gap" /> : null}
        {hasOverlap ? (
          <LegendItem color={OVERLAP_COLOR} label="Overlap" />
        ) : null}
      </View>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  bar: {
    height: 20,
    borderRadius: Spacing.one,
    overflow: 'hidden',
  },
  segment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  scale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legend: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
