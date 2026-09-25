import {
  formatShare,
  intensityWord,
  rockUnits,
  type FieldDrillhole,
  type LibraryCode,
  type LogInterval,
  type RockUnit,
  type UnitMode,
} from '@corechain/domain';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { codeNamer, metres, Swatch, UnitStrip } from '@/components/lithology';
import { ScreenLoader } from '@/components/screen-loader';
import { ThemedText } from '@/components/themed-text';
import { StatusPill } from '@/components/ui/status-pill';
import { Fonts, MinTap, Radius, Spacing } from '@/constants/theme';
import { listCodes } from '@/data/codesRepository';
import { getDrillhole } from '@/data/drillholesRepository';
import { listIntervals } from '@/data/intervalsRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { useTheme } from '@/hooks/use-theme';

// A hole read as rock units: touching intervals of the same rock merged, or
// split again where the alteration changes. The log itself is unchanged.

const MODES: { mode: UnitMode; label: string }[] = [
  { mode: 'lithology', label: 'Lithology' },
  { mode: 'lithology_alteration', label: 'Lithology + alteration' },
];

export default function RockUnitsScreen() {
  const { projectId, drillholeId } = useLocalSearchParams<{
    projectId: string;
    drillholeId: string;
  }>();
  const theme = useTheme();
  const [drillhole, setDrillhole] = useState<FieldDrillhole | null>(null);
  const [intervals, setIntervals] = useState<LogInterval[] | null>(null);
  const [codes, setCodes] = useState<LibraryCode[]>([]);
  const [mode, setMode] = useState<UnitMode>('lithology');

  const load = useCallback(() => {
    getDrillhole(drillholeId).then(setDrillhole);
    listIntervals(drillholeId).then(setIntervals);
    listCodes(projectId).then(setCodes);
  }, [projectId, drillholeId]);
  useFocusReload(load);

  const units = useMemo(() => rockUnits(intervals ?? [], mode), [intervals, mode]);
  const name = codeNamer(codes);

  if (!drillhole || intervals === null) return <ScreenLoader />;

  const describe = (unit: RockUnit) => {
    const parts: string[] = [];
    if (mode === 'lithology' && unit.alteration.length > 0) {
      parts.push(
        unit.alteration.length === 1
          ? name('alteration_type', unit.alteration[0]!.code)
          : unit.alteration
              .map(
                (a, i) =>
                  `${i === 0 ? name('alteration_type', a.code) : name('alteration_type', a.code).toLowerCase()} ${formatShare(a.share)}`,
              )
              .join(' · '),
      );
    }
    const intensity = intensityWord(unit.meanIntensity);
    if (intensity && intensity !== 'none') parts.push(`${intensity} alteration`);
    const minerals = unit.minerals
      .filter((m) => m.meanPercent != null)
      .map((m) => `${m.code} ${metres(m.meanPercent!)}%`);
    if (minerals.length > 0) parts.push(minerals.join(', '));
    return parts.join(' · ');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.title}>
          <ThemedText type="subtitle">{`${drillhole.holeId} rock units`}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`${units.length} ${units.length === 1 ? 'unit' : 'units'} from ${intervals.length} logged ${intervals.length === 1 ? 'interval' : 'intervals'}`}
          </ThemedText>
        </View>

        <View
          style={[
            styles.segmented,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ]}>
          {MODES.map((option) => {
            const active = option.mode === mode;
            return (
              <Pressable
                key={option.mode}
                onPress={() => setMode(option.mode)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.segment, active && { backgroundColor: theme.accent }]}>
                <ThemedText
                  type="smallBold"
                  style={{ color: active ? theme.background : theme.textSecondary }}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {units.length === 0 ? (
          <ThemedText type="default" themeColor="textSecondary">
            Units appear once intervals are logged with a lithology.
          </ThemedText>
        ) : (
          <>
            <UnitStrip units={units} />
            <View>
              {units.map((unit, index) => {
                const detail = describe(unit);
                return (
                  <View
                    key={`${unit.fromM}-${unit.intervalIds[0]}`}
                    style={[
                      styles.row,
                      index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                    ]}>
                    <View style={styles.swatch}>
                      <Swatch code={unit.lithology} size={20} />
                    </View>
                    <View style={styles.rowMain}>
                      <ThemedText type="smallBold" style={styles.mono}>
                        {`${metres(unit.fromM)} to ${metres(unit.toM)} m`}
                        <ThemedText type="small" themeColor="textSecondary">
                          {`  ${metres(unit.lengthM)} m`}
                        </ThemedText>
                      </ThemedText>
                      <View style={styles.nameRow}>
                        <ThemedText type="default" style={styles.shrink}>
                          {`${name('lithology', unit.lithology)}${
                            unit.alterationType
                              ? `, ${name('alteration_type', unit.alterationType).toLowerCase()}`
                              : ''
                          }`}
                        </ThemedText>
                        {unit.intervalIds.length > 1 ? (
                          <StatusPill label={`${unit.intervalIds.length} intervals`} />
                        ) : null}
                      </View>
                      {detail ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {detail}
                        </ThemedText>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  title: {
    gap: Spacing.half,
    paddingTop: Spacing.two,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.control,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minHeight: MinTap,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two + 2,
    paddingVertical: Spacing.two + 2,
  },
  swatch: {
    paddingTop: 2,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  shrink: {
    flexShrink: 1,
  },
  mono: {
    fontFamily: Fonts.mono,
  },
});
