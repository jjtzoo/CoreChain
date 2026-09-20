import {
  HOLE_LOG_COLUMN_LABELS,
  HOLE_LOG_COLUMNS,
  holeLogColour,
  readableTextOn,
  type HoleLog,
  type HoleLogColumn,
  type HoleLogRun,
  type HoleLogSegment,
} from '@corechain/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// E4-6: the hole drawn the way a geologist reads a strip log. Depth runs down;
// side by side are lithology, alteration and mineralisation, then recovery and
// RQD. In the alteration and mineral columns a wider bar means stronger
// alteration or more mineral, so the zoning of the system shows at a glance.

const AXIS_WIDTH = 46;
const RUN_WIDTH = 62;
const COLUMN_GAP = 3;
const TICK_STEPS = [1, 2, 5, 10, 20, 50, 100];

/** The smallest depth step whose labels sit at least 44 dp apart. */
function tickStep(pxPerM: number): number {
  return TICK_STEPS.find((step) => step * pxPerM >= 44) ?? 100;
}

/** How much of the column a bar fills (0.25 to 1). */
function barFraction(column: HoleLogColumn, segment: HoleLogSegment): number {
  if (segment.detail === null) return 0.55;
  if (column === 'alteration') return 0.25 + (segment.detail / 4) * 0.75;
  return Math.min(1, 0.3 + segment.detail * 0.25);
}

function label(column: HoleLogColumn, segment: HoleLogSegment): string {
  if (segment.code === null) return '';
  if (segment.detail === null || column === 'lithology') return segment.code;
  return column === 'alteration'
    ? `${segment.code} ${segment.detail}`
    : `${segment.code} ${segment.detail}%`;
}

export function HoleLogHeader() {
  return (
    <View style={styles.headerRow}>
      <View style={{ width: AXIS_WIDTH }} />
      {HOLE_LOG_COLUMNS.map((column) => (
        <View key={column} style={styles.column}>
          <ThemedText
            type="caption"
            themeColor="textSecondary"
            numberOfLines={1}>
            {HOLE_LOG_COLUMN_LABELS[column]}
          </ThemedText>
        </View>
      ))}
      <View style={{ width: RUN_WIDTH }}>
        <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
          Rec · RQD
        </ThemedText>
      </View>
    </View>
  );
}

export function HoleLogBody({
  log,
  pxPerM,
  selectedIntervalId,
  onSelect,
}: {
  log: HoleLog;
  pxPerM: number;
  selectedIntervalId: string | null;
  onSelect: (intervalId: string) => void;
}) {
  const theme = useTheme();
  const height = log.depthM * pxPerM;
  const step = tickStep(pxPerM);
  const ticks: number[] = [];
  for (let m = 0; m <= log.depthM; m += step) ticks.push(m);

  const selected = selectedIntervalId
    ? log.columns.lithology.find((s) => s.intervalId === selectedIntervalId)
    : undefined;

  return (
    <View style={[styles.body, { height }]}>
      <View style={{ width: AXIS_WIDTH }}>
        {ticks.map((m) => (
          <ThemedText
            key={m}
            type="caption"
            themeColor="textSecondary"
            style={[styles.tick, { top: m * pxPerM - 7 }]}>
            {m} m
          </ThemedText>
        ))}
      </View>

      {HOLE_LOG_COLUMNS.map((column) => (
        <View
          key={column}
          style={[
            styles.column,
            { backgroundColor: theme.backgroundSelected },
          ]}>
          {log.columns[column].map((segment) => {
            const top = segment.fromM * pxPerM;
            const segmentHeight = Math.max(
              2,
              (segment.toM - segment.fromM) * pxPerM,
            );
            const colour = holeLogColour(column, segment.code);
            const text = label(column, segment);
            const showText = text !== '' && segmentHeight >= 16;
            return (
              <Pressable
                key={`${column}-${segment.intervalId}`}
                onPress={() => onSelect(segment.intervalId)}
                accessibilityRole="button"
                accessibilityLabel={`${HOLE_LOG_COLUMN_LABELS[column]} ${segment.code ?? 'not logged'}, ${segment.fromM} to ${segment.toM} metres`}
                style={[styles.cell, { top, height: segmentHeight }]}>
                {segment.code !== null ? (
                  <View
                    style={[
                      styles.bar,
                      {
                        backgroundColor: colour,
                        width: `${(column === 'lithology' ? 1 : barFraction(column, segment)) * 100}%`,
                        borderTopColor: theme.backgroundSelected,
                      },
                    ]}>
                    {showText ? (
                      <ThemedText
                        type="caption"
                        numberOfLines={1}
                        style={{ color: readableTextOn(colour) }}>
                        {text}
                      </ThemedText>
                    ) : null}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={{ width: RUN_WIDTH, flexDirection: 'row', gap: COLUMN_GAP }}>
        <RunTrack log={log} pxPerM={pxPerM} kind="recovery" />
        <RunTrack log={log} pxPerM={pxPerM} kind="rqd" />
      </View>

      {selected ? (
        <View
          pointerEvents="none"
          style={[
            styles.selection,
            {
              top: selected.fromM * pxPerM,
              height: Math.max(4, (selected.toM - selected.fromM) * pxPerM),
              borderColor: theme.brand,
              left: AXIS_WIDTH - 2,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

/** One thin vertical track of recovery or RQD per run: fuller bar, better core. */
function RunTrack({
  log,
  pxPerM,
  kind,
}: {
  log: HoleLog;
  pxPerM: number;
  kind: 'recovery' | 'rqd';
}) {
  const theme = useTheme();
  const tone = (percent: number) =>
    percent >= 90
      ? theme.success
      : percent >= 70
        ? theme.warning
        : theme.danger;
  const value = (run: HoleLogRun) =>
    kind === 'recovery' ? run.recoveryPercent : run.rqdPercent;

  return (
    <View
      style={[styles.runTrack, { backgroundColor: theme.backgroundSelected }]}
      accessibilityLabel={
        kind === 'recovery' ? 'Recovery by run' : 'RQD by run'
      }>
      {log.runs.map((run) => {
        const percent = value(run);
        if (percent === null) return null;
        return (
          <View
            key={`${kind}-${run.fromM}`}
            style={{
              position: 'absolute',
              top: run.fromM * pxPerM,
              height: Math.max(2, (run.toM - run.fromM) * pxPerM - 1),
              left: 0,
              width: `${Math.min(100, Math.max(6, percent))}%`,
              backgroundColor: tone(percent),
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    gap: COLUMN_GAP,
    paddingVertical: Spacing.two,
  },
  body: {
    flexDirection: 'row',
    gap: COLUMN_GAP,
  },
  column: {
    flex: 1,
    overflow: 'hidden',
  },
  tick: {
    position: 'absolute',
    left: 0,
    right: 4,
    textAlign: 'right',
  },
  cell: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  bar: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderTopWidth: 1,
  },
  runTrack: {
    flex: 1,
    overflow: 'hidden',
  },
  selection: {
    position: 'absolute',
    right: -3,
    borderWidth: 2,
    borderRadius: 3,
  },
});
