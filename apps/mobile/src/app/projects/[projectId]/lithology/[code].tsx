import {
  formatShare,
  holeLogColour,
  intensityWord,
  lithologyDictionary,
  lithologyReference,
  ROCK_GROUP_LABELS,
  type FieldDrillhole,
  type LibraryCode,
  type LogInterval,
} from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { codeNamer, metres, Occurrence, Swatch } from '@/components/lithology';
import { ScreenLoader } from '@/components/screen-loader';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { Fonts, MinTap, Spacing } from '@/constants/theme';
import { listCodes } from '@/data/codesRepository';
import { listDrillholes } from '@/data/drillholesRepository';
import { listIntervalsByProject } from '@/data/intervalsRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { useTheme } from '@/hooks/use-theme';

// One rock type in the project: what it is, how much there is, its usual
// alteration and mineralisation, and where it sits in every hole.

const holeDepth = (hole: FieldDrillhole) => hole.actualFinalDepthM ?? hole.plannedDepthM;

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <Card style={styles.stat}>
      <ThemedText type="heading">{value}</ThemedText>
      <ThemedText type="caption" themeColor="textSecondary">
        {label}
      </ThemedText>
    </Card>
  );
}

export default function LithologyEntryScreen() {
  const { projectId, code } = useLocalSearchParams<{ projectId: string; code: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [intervals, setIntervals] = useState<LogInterval[] | null>(null);
  const [holes, setHoles] = useState<FieldDrillhole[]>([]);
  const [codes, setCodes] = useState<LibraryCode[]>([]);

  const load = useCallback(() => {
    listIntervalsByProject(projectId).then(setIntervals);
    listDrillholes(projectId).then(setHoles);
    listCodes(projectId).then(setCodes);
  }, [projectId]);
  useFocusReload(load);

  const entry = useMemo(
    () =>
      lithologyDictionary(intervals ?? []).entries.find(
        (e) => e.code === decodeURIComponent(code ?? '').toUpperCase(),
      ) ?? null,
    [intervals, code],
  );
  const name = codeNamer(codes);

  if (intervals === null) return <ScreenLoader />;
  if (!entry) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <ThemedText type="default" themeColor="textSecondary">
            This rock type is no longer in the log.
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const reference = lithologyReference(entry.code);
  const holeName = new Map(holes.map((h) => [h.id, h.holeId]));
  const maxDepth = Math.max(0, ...holes.map(holeDepth));
  const thickestHole = holeName.get(entry.thickest.drillholeId) ?? '';
  const intensity = intensityWord(entry.meanIntensity);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Swatch code={entry.code} size={48} />
          <View style={styles.headerText}>
            <ThemedText type="subtitle">
              <ThemedText type="subtitle" style={styles.mono}>
                {entry.code}
              </ThemedText>
              {` ${name('lithology', entry.code)}`}
            </ThemedText>
            {reference ? <StatusPill label={ROCK_GROUP_LABELS[reference.group]} /> : null}
          </View>
        </View>

        {reference ? (
          <View style={styles.note}>
            <ThemedText type="default">{reference.note}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              STARTER DESCRIPTION, GENERIC TO HARD-ROCK EXPLORATION
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.stats}>
          <Stat value={`${metres(entry.lengthM)} m`} label={`${formatShare(entry.share)} of logged core`} />
          <Stat value={`${entry.holeCount} of ${holes.length}`} label="holes" />
          <Stat value={String(entry.unitCount)} label={entry.unitCount === 1 ? 'unit' : 'units'} />
          <Stat
            value={`${metres(entry.thickest.lengthM)} m`}
            label={`thickest: ${thickestHole}, ${metres(entry.thickest.fromM)} to ${metres(entry.thickest.toM)} m`}
          />
        </View>

        {entry.alteration.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="caption" themeColor="textSecondary">
              {`TYPICAL ALTERATION${intensity ? ` · MOSTLY ${intensity.toUpperCase()}` : ''}`}
            </ThemedText>
            {entry.alteration.map((alt) => (
              <View key={alt.code} style={styles.barRow}>
                <ThemedText type="small" style={styles.barLabel} numberOfLines={2}>
                  {name('alteration_type', alt.code)}
                </ThemedText>
                <View style={[styles.barTrack, { backgroundColor: theme.backgroundSelected }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${alt.share * 100}%`,
                        backgroundColor: holeLogColour('alteration', alt.code),
                      },
                    ]}
                  />
                </View>
                <ThemedText type="caption" themeColor="textSecondary" style={styles.barValue}>
                  {formatShare(alt.share)}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {entry.minerals.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="caption" themeColor="textSecondary">
              MINERALISATION WHERE LOGGED
            </ThemedText>
            {entry.minerals.map((mineral) => (
              <ThemedText key={mineral.code} type="small">
                <ThemedText type="smallBold" style={styles.mono}>
                  {mineral.code}
                </ThemedText>
                {` ${name('mineral', mineral.code)} · ${
                  mineral.meanPercent != null
                    ? `${metres(mineral.meanPercent)}% over ${metres(mineral.lengthM)} m`
                    : `over ${metres(mineral.lengthM)} m`
                }`}
              </ThemedText>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="caption" themeColor="textSecondary">
            WHERE IT OCCURS
          </ThemedText>
          <View>
            {holes.map((hole) => (
              <Pressable
                key={hole.id}
                onPress={() =>
                  router.push(`/projects/${projectId}/drillholes/${hole.id}/units`)
                }
                accessibilityRole="button"
                accessibilityLabel={`${hole.holeId} rock units`}
                style={({ pressed }) => [styles.occurrenceRow, pressed && { opacity: 0.6 }]}>
                <ThemedText type="smallBold" style={[styles.mono, styles.occurrenceHole]}>
                  {hole.holeId}
                </ThemedText>
                <View style={styles.occurrenceBar}>
                  <Occurrence
                    units={entry.units.filter((u) => u.drillholeId === hole.id)}
                    code={entry.code}
                    depthM={holeDepth(hole)}
                    maxDepthM={maxDepth}
                  />
                </View>
              </Pressable>
            ))}
          </View>
          <View style={styles.axis}>
            <ThemedText type="caption" themeColor="textSecondary">
              0 m
            </ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">
              {`${metres(maxDepth)} m`}
            </ThemedText>
          </View>
        </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: Spacing.one,
    alignItems: 'flex-start',
  },
  mono: {
    fontFamily: Fonts.mono,
  },
  note: {
    gap: Spacing.one,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '46%',
    gap: 2,
  },
  section: {
    gap: Spacing.two,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  barLabel: {
    width: 128,
  },
  barTrack: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
  },
  barValue: {
    width: 36,
    textAlign: 'right',
  },
  occurrenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: MinTap,
  },
  occurrenceHole: {
    width: 76,
  },
  occurrenceBar: {
    flex: 1,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 76 + Spacing.two,
  },
});
