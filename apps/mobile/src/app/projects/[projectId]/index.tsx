import {
  loggedLengthM,
  loggingProgress,
  matchesDrillholeSearch,
  type FieldDrillhole,
  type Project,
} from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { CoachmarkOverlay } from '@/components/guide/coachmark-overlay';
import { Icon, type IconName } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SyncBadge } from '@/components/sync-badge';
import { StatusPill } from '@/components/ui/status-pill';
import { Radius, Spacing } from '@/constants/theme';
import { listDrillholes } from '@/data/drillholesRepository';
import { useGuideStep } from '@/guide/use-guide-step';
import { listIntervalRangesByProject } from '@/data/intervalsRepository';
import { getProject } from '@/data/projectsRepository';
import { useTheme } from '@/hooks/use-theme';
import { statusLabel, statusTone } from '@/utils/status';
import { useFocusReload } from '@/hooks/use-focus-reload';

/** Only show the search box once there are enough holes to need it. */
const SEARCH_FROM_HOLES = 5;

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
  const [query, setQuery] = useState('');
  const guide = useGuideStep('open-hole-list', projectId ?? null);

  const reload = useCallback(() => {
    getProject(projectId).then(setProject);
    listDrillholes(projectId).then(setDrillholes);
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
  }, [projectId]);

  useFocusReload(reload);

  const visibleDrillholes = useMemo(
    () => drillholes.filter((d) => matchesDrillholeSearch(d, query)),
    [drillholes, query],
  );

  if (!project) {
    return null;
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
          {shortcuts.map((shortcut) => (
            <Pressable
              key={shortcut.path}
              onPress={() =>
                router.push(`/projects/${projectId}/${shortcut.path}`)
              }
              accessibilityRole="button"
              accessibilityLabel={shortcut.label}
              style={({ pressed }) => [
                styles.shortcut,
                {
                  backgroundColor: pressed
                    ? theme.backgroundSelected
                    : theme.backgroundElement,
                  borderColor: theme.border,
                },
              ]}
            >
              <Icon name={shortcut.icon} size={24} themeColor="accent" />
              <ThemedText type="small">{shortcut.label}</ThemedText>
            </Pressable>
          ))}
        </View>

        <PrimaryButton
          label="New drillhole"
          icon="plus"
          onPress={() => {
            void (async () => {
              if ('step' in guide) await guide.advance();
              router.push(`/projects/${projectId}/drillholes/new`);
            })();
          }}
        />

        <View style={styles.section}>
          <ThemedText type="caption" themeColor="textSecondary">
            DRILLHOLES · {drillholes.length}
          </ThemedText>

          {drillholes.length >= SEARCH_FROM_HOLES ? (
            <TextField
              label="Search holes"
              value={query}
              onChangeText={setQuery}
              placeholder="Search by hole ID"
            />
          ) : null}

          {drillholes.length === 0 ? (
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
                  onPress={() =>
                    router.push(`/projects/${projectId}/drillholes/${hole.id}`)
                  }
                  accessibilityLabel={`Open hole ${hole.holeId}`}
                  style={styles.holeCard}
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
                    <StatusPill
                      label={statusLabel(hole.status)}
                      tone={statusTone(hole.status)}
                    />
                  </View>
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
  section: {
    gap: Spacing.two + 2,
    paddingTop: Spacing.two,
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
  empty: {
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
});
