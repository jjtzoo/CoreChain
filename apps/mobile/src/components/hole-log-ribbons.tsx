import {
  HOLE_LOG_COLUMN_LABELS,
  HOLE_LOG_COLUMNS,
  holeLogColour,
  type HoleLog,
} from '@corechain/domain';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * E4-6: the whole hole in three thin ribbons (lithology, alteration,
 * mineralisation) from 0 m to the bottom, for the hole screen. It shows how
 * the geology changes with depth without opening anything.
 */
export function HoleLogRibbons({ log }: { log: HoleLog }) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {HOLE_LOG_COLUMNS.map((column) => (
        <View key={column} style={styles.row}>
          <ThemedText
            type="caption"
            themeColor="textSecondary"
            style={styles.label}
            numberOfLines={1}>
            {HOLE_LOG_COLUMN_LABELS[column]}
          </ThemedText>
          <View
            style={[
              styles.track,
              { backgroundColor: theme.backgroundSelected },
            ]}>
            {log.columns[column].map((segment) =>
              segment.code === null ? null : (
                <View
                  key={segment.intervalId}
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${(segment.fromM / log.depthM) * 100}%`,
                    width: `${((segment.toM - segment.fromM) / log.depthM) * 100}%`,
                    backgroundColor: holeLogColour(column, segment.code),
                  }}
                />
              ),
            )}
          </View>
        </View>
      ))}
      <View style={styles.scale}>
        <ThemedText type="caption" themeColor="textSecondary">
          0 m
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {log.depthM} m
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  label: {
    width: 92,
  },
  track: {
    flex: 1,
    height: 16,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 92 + Spacing.two,
  },
});
