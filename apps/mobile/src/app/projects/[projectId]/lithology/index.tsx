import {
  formatShare,
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

import { PrimaryButton } from '@/components/form/primary-button';
import { codeNamer, CompositionBar, metres, Swatch } from '@/components/lithology';
import { ScreenLoader } from '@/components/screen-loader';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { StatusPill } from '@/components/ui/status-pill';
import { Fonts, MinTap, Spacing } from '@/constants/theme';
import { listCodes } from '@/data/codesRepository';
import { listDrillholes } from '@/data/drillholesRepository';
import { listIntervalsByProject } from '@/data/intervalsRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { useTheme } from '@/hooks/use-theme';

// The project's lithology dictionary: every rock type logged, how much of it,
// in how many holes and at what depths. Calculated from the phone's own log.

export default function LithologyDictionaryScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
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

  const dictionary = useMemo(() => lithologyDictionary(intervals ?? []), [intervals]);
  const name = codeNamer(codes);

  if (intervals === null) return <ScreenLoader />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.title}>
          <ThemedText type="subtitle">Rock types in this project</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`${holes.length} ${holes.length === 1 ? 'hole' : 'holes'} · ${metres(dictionary.loggedM)} m logged`}
          </ThemedText>
        </View>

        {dictionary.entries.length === 0 ? (
          <Card style={styles.empty}>
            <Icon name="layers-outline" size={32} themeColor="accent" />
            <ThemedText type="heading">Nothing logged yet</ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              Each rock type appears here once an interval with its lithology is
              logged, with how much there is and where it sits in every hole.
            </ThemedText>
          </Card>
        ) : (
          <>
            <View style={styles.composition}>
              <CompositionBar entries={dictionary.entries} />
              <ThemedText type="caption" themeColor="textSecondary">
                SHARE OF LOGGED CORE
              </ThemedText>
            </View>

            <View>
              {dictionary.entries.map((entry, index) => {
                const reference = lithologyReference(entry.code);
                return (
                  <Pressable
                    key={entry.code}
                    onPress={() =>
                      router.push(
                        `/projects/${projectId}/lithology/${encodeURIComponent(entry.code)}`,
                      )
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${name('lithology', entry.code)}, ${metres(entry.lengthM)} metres, ${formatShare(entry.share)} of logged core`}
                    style={({ pressed }) => [
                      styles.row,
                      index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
                      pressed && { backgroundColor: theme.backgroundSelected },
                    ]}>
                    <Swatch code={entry.code} />
                    <View style={styles.rowMain}>
                      <View style={styles.rowTitle}>
                        <ThemedText type="smallBold" style={styles.mono}>
                          {entry.code}
                        </ThemedText>
                        <ThemedText type="small" numberOfLines={1} style={styles.shrink}>
                          {name('lithology', entry.code)}
                        </ThemedText>
                        {reference ? (
                          <StatusPill label={ROCK_GROUP_LABELS[reference.group]} />
                        ) : null}
                      </View>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {`${entry.holeCount} of ${holes.length} holes · ${entry.unitCount} ${entry.unitCount === 1 ? 'unit' : 'units'} · ${metres(entry.topM)} to ${metres(entry.bottomM)} m`}
                      </ThemedText>
                    </View>
                    <View style={styles.rowNumbers}>
                      <ThemedText type="smallBold">{`${metres(entry.lengthM)} m`}</ThemedText>
                      <ThemedText type="caption" themeColor="textSecondary">
                        {formatShare(entry.share)}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <View style={styles.codes}>
          <ThemedText type="small" themeColor="textSecondary">
            The rock codes, their names and which ones appear when logging are
            the project&apos;s own. Add your team&apos;s codes or rename these.
          </ThemedText>
          <PrimaryButton
            label="Code library"
            variant="secondary"
            onPress={() => router.push(`/projects/${projectId}/codes`)}
          />
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
  title: {
    gap: Spacing.half,
    paddingTop: Spacing.two,
  },
  empty: {
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  composition: {
    gap: Spacing.one + 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    minHeight: MinTap + 12,
    paddingVertical: Spacing.two,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  shrink: {
    flexShrink: 1,
  },
  mono: {
    fontFamily: Fonts.mono,
  },
  codes: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  rowNumbers: {
    alignItems: 'flex-end',
  },
});
