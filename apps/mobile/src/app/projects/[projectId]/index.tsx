import {
  formatShare,
  lithologyDictionary,
  loggedLengthM,
  loggingProgress,
  matchesDrillholeSearch,
  type FieldDrillhole,
  type LogInterval,
  type Project,
} from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollarMap } from '@/components/collar-map';
import { CompositionBar } from '@/components/lithology';
import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { CoachmarkOverlay } from '@/components/guide/coachmark-overlay';
import { Icon, type IconName } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SyncBadge } from '@/components/sync-badge';
import { StatusPill } from '@/components/ui/status-pill';
import { MinTap, Radius, Spacing } from '@/constants/theme';
import { listDrillholes } from '@/data/drillholesRepository';
import { useGuideStep } from '@/guide/use-guide-step';
import {
  listIntervalRangesByProject,
  listIntervalsByProject,
} from '@/data/intervalsRepository';
import { getProject } from '@/data/projectsRepository';
import {
  downloadTerrain,
  keptTerrain,
  terrainCovers,
  type Terrain,
} from '@/data/terrainFiles';
import { useSession } from '@/auth/session-context';
import { useTheme } from '@/hooks/use-theme';
import { statusLabel, statusTone } from '@/utils/status';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { ScreenLoader } from '@/components/screen-loader';

/** Only show the search box once there are enough holes to need it. */
const SEARCH_FROM_HOLES = 5;

type HoleView = 'list' | 'map';
/** Projects whose terrain was already fetched this session, so a failure isn't retried on every visit. */
const terrainTried = new Set<string>();
/** List or Map per project, remembered while the app is open (E15-1). */
const holeViewByProject = new Map<string, HoleView>();

export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const theme = useTheme();

  const [project, setProject] = useState<Project | null>(null);
  const [drillholes, setDrillholes] = useState<FieldDrillhole[]>([]);
  // Metres logged per drillhole id (overlapping intervals counted once).
  const [loggedMetres, setLoggedMetres] = useState<Map<string, number>>(
    new Map(),
  );
  const [intervals, setIntervals] = useState<LogInterval[]>([]);
  const [terrain, setTerrain] = useState<Terrain | null>(null);
  const { cookie } = useSession();
  const [query, setQuery] = useState('');
  const [holeView, setHoleView] = useState<HoleView>(
    () => holeViewByProject.get(projectId ?? '') ?? 'list',
  );
  // Off while a finger is on the map, so dragging the map doesn't scroll the screen.
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const chooseView = (next: HoleView) => {
    holeViewByProject.set(projectId ?? '', next);
    setHoleView(next);
  };
  const guide = useGuideStep('open-hole-list', projectId ?? null);
  const exportGuide = useGuideStep('export', projectId ?? null);
  // The guide's next tap is Export, elsewhere on this same screen: highlight
  // it and grey everything else so it can't be mistaken for the next step.
  const guidingToExport = 'step' in exportGuide;
  // The first-run guide walks through the list, so the map waits until it's done.
  const guiding = guidingToExport || 'step' in guide;
  const showMap = holeView === 'map' && !guiding && drillholes.length > 0;

  const reload = useCallback(() => {
    getProject(projectId).then(setProject);
    listDrillholes(projectId).then((holes) => {
      setDrillholes(holes);
      // The map's terrain: the kept copy, and a new one when there is none or
      // the collars have moved outside it (E15-2).
      const collars = holes.flatMap((h) => (h.collar ? [h.collar] : []));
      const kept = keptTerrain(projectId);
      setTerrain(kept);
      const stale = !kept || !terrainCovers(kept, collars);
      if (collars.length > 0 && cookie && stale && !terrainTried.has(projectId)) {
        terrainTried.add(projectId);
        void downloadTerrain(projectId, cookie).then((fresh) => {
          if (fresh) setTerrain(fresh);
        });
      }
    });
    listIntervalsByProject(projectId).then(setIntervals);
    listIntervalRangesByProject(projectId).then((byHole) => {
      setLoggedMetres(
        new Map(
          [...byHole].map(([holeId, ranges]) => [
            holeId,
            loggedLengthM(ranges),
          ]),
        ),
      );
    });
  }, [projectId, cookie]);

  useFocusReload(reload);

  const lithology = useMemo(() => lithologyDictionary(intervals), [intervals]);

  const visibleDrillholes = useMemo(
    () => drillholes.filter((d) => matchesDrillholeSearch(d, query)),
    [drillholes, query],
  );

  if (!project) {
    return <ScreenLoader />;
  }

  const shortcuts: { icon: IconName; label: string; path: string }[] = [
    { icon: 'flask-outline', label: 'Samples', path: 'samples' },
    {
      icon: 'truck-delivery-outline',
      label: 'Dispatches',
      path: 'dispatches',
    },
    { icon: 'file-export-outline', label: 'Export', path: 'export' },
    { icon: 'cog-outline', label: 'Settings', path: 'settings' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={scrollEnabled}
      >
        <View style={styles.title}>
          <ThemedText type="subtitle">{project.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {project.coordinateSystem}
            {project.commodity ? ` · ${project.commodity}` : ''}
            {project.location ? ` · ${project.location}` : ''}
          </ThemedText>
        </View>

        <View style={styles.shortcuts}>
          {shortcuts.map((shortcut) => {
            const isExport = shortcut.path === 'export';
            const disabled = guidingToExport && !isExport;
            return (
              <Pressable
                key={shortcut.path}
                onPress={
                  disabled
                    ? undefined
                    : () => router.push(`/projects/${projectId}/${shortcut.path}`)
                }
                accessibilityRole="button"
                accessibilityLabel={shortcut.label}
                accessibilityState={{ disabled }}
                style={({ pressed }) => [
                  styles.shortcut,
                  {
                    backgroundColor: pressed
                      ? theme.backgroundSelected
                      : theme.backgroundElement,
                    borderColor:
                      guidingToExport && isExport ? theme.accent : theme.border,
                    borderWidth: guidingToExport && isExport ? 2 : 1,
                  },
                  disabled && styles.disabled,
                ]}
              >
                <Icon name={shortcut.icon} size={24} themeColor="accent" />
                <ThemedText type="small">{shortcut.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>

        <PrimaryButton
          label="New drillhole"
          icon="plus"
          disabled={guidingToExport}
          onPress={() => {
            void (async () => {
              if ('step' in guide) await guide.advance();
              router.push(`/projects/${projectId}/drillholes/new`);
            })();
          }}
        />

        {lithology.entries.length > 0 ? (
          <Card
            style={[styles.lithologyCard, guiding && styles.disabled]}
            onPress={guiding ? undefined : () => router.push(`/projects/${projectId}/lithology`)}
            accessibilityLabel="Open the project's lithology">
            <View style={styles.lithologyTop}>
              <ThemedText type="heading">Lithology</ThemedText>
              <View style={styles.lithologyOpen}>
                <ThemedText type="smallBold" themeColor="brand">
                  Open
                </ThemedText>
                <Icon name="chevron-right" size={20} themeColor="brand" />
              </View>
            </View>
            <CompositionBar entries={lithology.entries} />
            <ThemedText type="small" themeColor="textSecondary">
              {lithology.entries
                .slice(0, 3)
                .map((entry) => `${entry.code} ${formatShare(entry.share)}`)
                .join(' · ')}
              {lithology.entries.length > 3
                ? ` · ${lithology.entries.length - 3} more`
                : ''}
            </ThemedText>
          </Card>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <ThemedText type="caption" themeColor="textSecondary">
              DRILLHOLES · {drillholes.length}
            </ThemedText>
            {drillholes.length > 0 && !guiding ? (
              <View
                style={[styles.segmented, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
                accessibilityRole="tablist"
              >
                {(['list', 'map'] as const).map((option) => {
                  const active = holeView === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => chooseView(option)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={option === 'list' ? 'Show holes as a list' : 'Show holes on a map'}
                      style={[styles.segment, active && { backgroundColor: theme.accent }]}
                    >
                      <Icon
                        name={option === 'list' ? 'format-list-bulleted' : 'map-marker-radius-outline'}
                        size={18}
                        themeColor={active ? 'onAccent' : 'textSecondary'}
                      />
                      <ThemedText type="smallBold" themeColor={active ? 'onAccent' : 'textSecondary'}>
                        {option === 'list' ? 'List' : 'Map'}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>

          {showMap ? (
            <CollarMap
              terrain={terrain}
              drillholes={drillholes}
              loggedMetres={loggedMetres}
              onOpenHole={(id) => router.push(`/projects/${projectId}/drillholes/${id}`)}
              onGestureActive={(active) => setScrollEnabled(!active)}
            />
          ) : null}

          {!showMap && drillholes.length >= SEARCH_FROM_HOLES ? (
            <TextField
              label="Search holes"
              value={query}
              onChangeText={setQuery}
              placeholder="Search by hole ID"
            />
          ) : null}

          {showMap ? null : drillholes.length === 0 ? (
            <Card style={styles.empty}>
              <Icon name="target" size={32} themeColor="accent" />
              <ThemedText type="heading">Add your first hole</ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                Record the collar, then log core box by box. Everything is saved
                on this phone.
              </ThemedText>
            </Card>
          ) : visibleDrillholes.length === 0 ? (
            <Card>
              <ThemedText type="default" themeColor="textSecondary">
                No holes match &ldquo;{query.trim()}&rdquo;.
              </ThemedText>
            </Card>
          ) : (
            visibleDrillholes.map((hole) => {
              const progress = loggingProgress(
                loggedMetres.get(hole.id) ?? 0,
                hole,
              );
              return (
                <Card
                  key={hole.id}
                  onPress={
                    guidingToExport
                      ? undefined
                      : () =>
                          router.push(
                            `/projects/${projectId}/drillholes/${hole.id}`,
                          )
                  }
                  accessibilityLabel={`Open hole ${hole.holeId}`}
                  style={[
                    styles.holeCard,
                    guidingToExport && styles.disabled,
                  ]}
                >
                  <View style={styles.holeTop}>
                    <View style={styles.holeTitle}>
                      <ThemedText type="heading">{hole.holeId}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {hole.actualFinalDepthM ?? hole.plannedDepthM} m
                        {hole.actualFinalDepthM == null ? ' planned' : ' final'}
                        {' · '}
                        {Math.round(progress * 100)}% logged
                      </ThemedText>
                      <SyncBadge kind="drillhole" id={hole.id} />
                    </View>
                    <View style={styles.holePills}>
                      {hole.priority === 'urgent' ? (
                        <StatusPill label="Urgent" tone="danger" />
                      ) : null}
                      <StatusPill
                        label={statusLabel(hole.status)}
                        tone={statusTone(hole.status)}
                      />
                    </View>
                  </View>
                  {hole.priority === 'urgent' && hole.priorityNote ? (
                    <ThemedText type="small" themeColor="danger">
                      {hole.priorityNote}
                    </ThemedText>
                  ) : null}
                  <ProgressBar
                    value={progress}
                    label={`${hole.holeId} logging progress`}
                  />
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>
      {'step' in guide && guide.visible ? (
        <CoachmarkOverlay
          step={guide.step}
          stepNumber={guide.stepNumber}
          totalSteps={guide.totalSteps}
          onNext={guide.hide}
          onSkip={() => void guide.skip()}
        />
      ) : null}
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
  shortcuts: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingVertical: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.card,
  },
  lithologyCard: {
    gap: Spacing.two + 2,
  },
  lithologyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lithologyOpen: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
    gap: Spacing.two + 2,
    paddingTop: Spacing.two,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.control,
    overflow: 'hidden',
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one + 2,
    minHeight: MinTap,
    minWidth: 84,
    paddingHorizontal: Spacing.three,
  },
  holeCard: {
    gap: Spacing.three,
  },
  holeTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  holeTitle: {
    flex: 1,
    gap: Spacing.half,
  },
  holePills: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  empty: {
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  disabled: {
    opacity: 0.4,
  },
});
