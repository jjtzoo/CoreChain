import {
  buildHoleLog,
  HOLE_LOG_COLUMN_LABELS,
  HOLE_LOG_COLUMNS,
  holeLogColour,
  legendCodes,
  STARTER_CODES,
  type CodeCategory,
  type FieldCoreRun,
  type FieldDrillhole,
  type LogInterval,
} from '@corechain/domain';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HoleLogBody, HoleLogHeader } from '@/components/hole-log-chart';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { listCodes } from '@/data/codesRepository';
import { listRuns } from '@/data/coreRepository';
import { getDrillhole } from '@/data/drillholesRepository';
import { listIntervals } from '@/data/intervalsRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { useTheme } from '@/hooks/use-theme';
import { ScreenLoader } from '@/components/screen-loader';

const SCALES = [
  { label: 'Overview', pxPerM: 3 },
  { label: 'Standard', pxPerM: 6 },
  { label: 'Detail', pxPerM: 12 },
] as const;

const COLUMN_CATEGORY: Record<(typeof HOLE_LOG_COLUMNS)[number], CodeCategory> =
  {
    lithology: 'lithology',
    alteration: 'alteration_type',
    mineral: 'mineral',
  };

function metres(value: number): string {
  return String(Math.round(value * 100) / 100);
}

export default function HoleGraphicLogScreen() {
  const { projectId, drillholeId } = useLocalSearchParams<{
    projectId: string;
    drillholeId: string;
  }>();
  const router = useRouter();
  const theme = useTheme();

  const [drillhole, setDrillhole] = useState<FieldDrillhole | null>(null);
  const [intervals, setIntervals] = useState<LogInterval[]>([]);
  const [runs, setRuns] = useState<FieldCoreRun[]>([]);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [scaleIndex, setScaleIndex] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    getDrillhole(drillholeId).then((loaded) => setDrillhole(loaded));
    listIntervals(drillholeId).then(setIntervals);
    listRuns(drillholeId).then(setRuns);
    listCodes(projectId).then((codes) => {
      const map: Record<string, string> = {};
      for (const entry of STARTER_CODES) {
        map[`${entry.category}:${entry.code.toUpperCase()}`] =
          entry.description;
      }
      for (const entry of codes) {
        map[`${entry.category}:${entry.code.toUpperCase()}`] =
          entry.description;
      }
      setDescriptions(map);
    });
  }, [projectId, drillholeId]);
  useFocusReload(load);

  const log = useMemo(
    () =>
      drillhole
        ? buildHoleLog({
            intervals,
            runs,
            depthM: drillhole.actualFinalDepthM ?? drillhole.plannedDepthM,
          })
        : null,
    [drillhole, intervals, runs],
  );

  if (!drillhole || !log) {
    return <ScreenLoader />;
  }

  const describe = (category: CodeCategory, code: string | null) => {
    if (!code) return null;
    const text = descriptions[`${category}:${code.toUpperCase()}`];
    return text ? `${code} · ${text}` : code;
  };

  const selected = intervals.find((i) => i.id === selectedId) ?? null;
  const details: { label: string; value: string }[] = [];
  if (selected) {
    const add = (label: string, value: string | null) => {
      if (value) details.push({ label, value });
    };
    add('Lithology', describe('lithology', selected.lithology));
    add(
      'Alteration',
      selected.alterationType
        ? [
            describe('alteration_type', selected.alterationType),
            selected.alterationIntensity
              ? (describe(
                  'alteration_intensity',
                  selected.alterationIntensity,
                ) ?? selected.alterationIntensity)
              : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : null,
    );
    add(
      'Mineralisation',
      selected.mineral
        ? [
            describe('mineral', selected.mineral),
            selected.mineralStyle
              ? describe('mineral_style', selected.mineralStyle)
              : null,
            selected.mineralPercent != null
              ? `${selected.mineralPercent}%`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : null,
    );
    add('Weathering', describe('weathering', selected.weathering));
    add('Structure', describe('structure_type', selected.structureType));
    add('Notes', selected.notes);
  }

  const openLog = () =>
    router.push(`/projects/${projectId}/drillholes/${drillholeId}/log` as Href);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.top}>
        <View style={styles.scaleRow}>
          {SCALES.map((scale, index) => (
            <Chip
              key={scale.label}
              label={scale.label}
              selected={index === scaleIndex}
              onPress={() => setScaleIndex(index)}
            />
          ))}
        </View>
        {!selected ? (
          <ThemedText type="small" themeColor="textSecondary">
            {intervals.length === 0
              ? 'Nothing logged yet. Once you log an interval, the hole appears here as a picture.'
              : 'Tap any stretch of the hole to see what was logged there.'}
          </ThemedText>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        stickyHeaderIndices={[0]}>
        <View style={{ backgroundColor: theme.background }}>
          <HoleLogHeader />
        </View>
        <HoleLogBody
          log={log}
          pxPerM={SCALES[scaleIndex].pxPerM}
          selectedIntervalId={selectedId}
          onSelect={setSelectedId}
        />

        <Card style={styles.legend}>
          <ThemedText type="heading">Key</ThemedText>
          {HOLE_LOG_COLUMNS.map((column) => {
            const codes = legendCodes(log, column);
            if (codes.length === 0) return null;
            return (
              <View key={column} style={styles.legendGroup}>
                <ThemedText type="smallBold">
                  {HOLE_LOG_COLUMN_LABELS[column]}
                </ThemedText>
                {codes.map((code) => (
                  <View key={code} style={styles.legendItem}>
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: holeLogColour(column, code) },
                      ]}
                    />
                    <ThemedText type="small">
                      {describe(COLUMN_CATEGORY[column], code)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            );
          })}
          <ThemedText type="caption" themeColor="textSecondary">
            In the alteration and mineralisation columns a wider bar means
            stronger alteration or more mineral. Recovery and RQD bars turn
            amber below 90% and red below 70%.
          </ThemedText>
        </Card>
      </ScrollView>

      {selected ? (
        <Card style={styles.panel}>
          <View style={styles.panelTop}>
            <ThemedText type="heading">
              {metres(selected.fromM)}–{metres(selected.toM)} m
            </ThemedText>
            <Pressable
              onPress={() => setSelectedId(null)}
              accessibilityRole="button"
              accessibilityLabel="Close details"
              style={styles.close}>
              <Icon name="close" size={22} themeColor="textSecondary" />
            </Pressable>
          </View>
          <ScrollView style={styles.panelScroll}>
            {details.map((row) => (
              <View key={row.label} style={styles.detailRow}>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={styles.detailLabel}>
                  {row.label}
                </ThemedText>
                <ThemedText type="small" style={styles.detailValue}>
                  {row.value}
                </ThemedText>
              </View>
            ))}
          </ScrollView>
          <PrimaryButton
            label="Open the core log"
            variant="secondary"
            onPress={openLog}
          />
        </Card>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  top: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  panel: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  panelTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelScroll: {
    maxHeight: 190,
  },
  detailRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: 2,
  },
  detailLabel: {
    width: 104,
  },
  detailValue: {
    flex: 1,
  },
  scaleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  legend: {
    gap: Spacing.three,
  },
  legendGroup: {
    gap: Spacing.two,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
  },
});
