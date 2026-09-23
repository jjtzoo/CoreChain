import {
  formatRange,
  loggedLengthM,
  loggingProgress,
  rangeForPreset,
  sessionMessage,
  summariseWork,
  type FieldDrillhole,
  type Project,
  type WorkSummary,
} from '@corechain/domain';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  ToastAndroid,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { toUserRole } from '@corechain/domain';
import { useSession } from '@/auth/session-context';
import { PrimaryButton } from '@/components/form/primary-button';
import { SyncStatusLine } from '@/components/sync-status';
import { ThemedText } from '@/components/themed-text';
import { AlertRow } from '@/components/ui/alert-row';
import { Card } from '@/components/ui/card';
import { BrandSymbol } from '@/components/brand-lockup';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SyncBadge } from '@/components/sync-badge';
import { StatusPill } from '@/components/ui/status-pill';
import { Radius, Spacing } from '@/constants/theme';
import {
  getMostRecentDrillhole,
  listDrillholes,
} from '@/data/drillholesRepository';
import { dismissGuide, startGuide } from '@/data/guideRepository';
import { useGuide } from '@/guide/guide-context';
import { listIntervalRangesByProject } from '@/data/intervalsRepository';
import { createPracticeProject, listProjects } from '@/data/projectsRepository';
import { loadWorkInput } from '@/data/workRepository';
import { useTheme } from '@/hooks/use-theme';
import { statusLabel, statusTone } from '@/utils/status';
import { useFocusReload } from '@/hooks/use-focus-reload';

type ProjectSummary = {
  project: Project;
  holeCount: number;
  /** 0 to 1: metres logged across the project's holes over their depths. */
  progress: number;
};

type Recent = {
  drillhole: FieldDrillhole;
  projectName: string;
  progress: number;
};

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  return hour < 18 ? 'Good afternoon' : 'Good evening';
}

async function summarise(project: Project): Promise<ProjectSummary> {
  const [holes, ranges] = await Promise.all([
    listDrillholes(project.id),
    listIntervalRangesByProject(project.id),
  ]);
  let logged = 0;
  let depth = 0;
  for (const hole of holes) {
    logged += loggedLengthM(ranges.get(hole.id) ?? []);
    depth += hole.actualFinalDepthM ?? hole.plannedDepthM;
  }
  return {
    project,
    holeCount: holes.length,
    progress: depth > 0 ? Math.min(1, logged / depth) : 0,
  };
}

/**
 * E1-1: the app's home screen. Answers "where was I, and what next?" first
 * (continue the last hole), then lists the geologist's own projects.
 */
export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { health, user } = useSession();
  const sessionNote = health ? sessionMessage(health) : null;
  const [summaries, setSummaries] = useState<ProjectSummary[] | null>(null);
  const [recent, setRecent] = useState<Recent | null>(null);
  const [today, setToday] = useState<WorkSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // E10-1: the first-run guide is only offered to the field geologist tier
  // (the only tier with real screens built), and only until it has been
  // started or dismissed once — after that, Account offers to start it again.
  const { progress: guideProgress, loaded: guideLoaded, reload: reloadGuide } =
    useGuide();
  const [startingGuide, setStartingGuide] = useState(false);
  const showGuidePrompt =
    guideLoaded &&
    toUserRole(user?.role) === 'geologist' &&
    guideProgress === null;

  async function startFieldGuide() {
    setStartingGuide(true);
    try {
      const project = await createPracticeProject(
        guideProgress?.practiceProjectId,
      );
      await startGuide(project.id, 'open-hole-list');
      reloadGuide();
      router.push(`/projects/${project.id}`);
    } finally {
      setStartingGuide(false);
    }
  }

  async function dismissFieldGuide() {
    await dismissGuide();
    reloadGuide();
  }

  const reload = useCallback(() => {
    if (!user) return;
    (async () => {
      void loadWorkInput().then((work) =>
        setToday(summariseWork(work, rangeForPreset('today', new Date()))),
      );
      const projects = await listProjects();
      setSummaries(await Promise.all(projects.map(summarise)));

      const latest = await getMostRecentDrillhole(user.id);
      if (latest) {
        const ranges = await listIntervalRangesByProject(
          latest.drillhole.projectId,
        );
        setRecent({
          ...latest,
          progress: loggingProgress(
            loggedLengthM(ranges.get(latest.drillhole.id) ?? []),
            latest.drillhole,
          ),
        });
      } else {
        setRecent(null);
      }
    })().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [user]);

  useFocusReload(reload);

  // Home is the bottom of the stack: one back press here would otherwise
  // exit the app immediately, an easy slip when backing out of a screen. A
  // second press within the window confirms it.
  const exitArmed = useRef(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (exitArmed.current) {
          return false;
        }
        exitArmed.current = true;
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        setTimeout(() => {
          exitArmed.current = false;
        }, 2000);
        return true;
      },
    );
    return () => subscription.remove();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hello}>
          <ThemedText type="subtitle">{greeting(new Date())}</ThemedText>
          <SyncStatusLine onPress={() => router.push('/account')} />
        </View>

        {sessionNote ? (
          <AlertRow
            tone={health?.state === 'expired' ? 'danger' : 'warning'}
            message={sessionNote}
            actionLabel="Details"
            onPress={() => router.push('/account')}
          />
        ) : null}

        {error ? (
          <ThemedText type="small" themeColor="danger">
            Couldn&apos;t load your projects: {error}
          </ThemedText>
        ) : null}

        {showGuidePrompt ? (
          <Card style={styles.guideCard}>
            <ThemedText type="caption" themeColor="brand">
              NEW HERE
            </ThemedText>
            <ThemedText type="heading">
              Try a short guided walkthrough
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              See the whole field flow — a hole, a box, a logged interval, a
              sample and the export — on a practice project you can delete
              afterwards. Works with no signal.
            </ThemedText>
            <View style={styles.guideActions}>
              <PrimaryButton
                label="Not now"
                variant="secondary"
                onPress={() => void dismissFieldGuide()}
              />
              <View style={styles.guideStart}>
                <PrimaryButton
                  label="Start guide"
                  loading={startingGuide}
                  onPress={() => void startFieldGuide()}
                />
              </View>
            </View>
          </Card>
        ) : null}

        {today ? (
          <Card
            onPress={() => router.push('/work' as Href)}
            accessibilityLabel="Open My work">
            <View style={styles.todayTop}>
              <ThemedText type="heading">Today</ThemedText>
              <View style={styles.todayLink}>
                <ThemedText type="smallBold" themeColor="brand">
                  My work
                </ThemedText>
                <Icon name="chevron-right" size={20} themeColor="brand" />
              </View>
            </View>
            <ThemedText type="caption" themeColor="textSecondary">
              {formatRange(today.range)}
            </ThemedText>
            <View style={styles.todayNumbers}>
              <View>
                <ThemedText type="title" style={styles.todayValue}>
                  {today.metresLogged}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  m logged
                </ThemedText>
              </View>
              <View>
                <ThemedText type="title" style={styles.todayValue}>
                  {today.samples.total}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  samples
                </ThemedText>
              </View>
              <View>
                <ThemedText type="title" style={styles.todayValue}>
                  {today.custody.total}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  custody steps
                </ThemedText>
              </View>
            </View>
          </Card>
        ) : null}

        {recent ? (
          <View style={styles.section}>
            <ThemedText type="caption" themeColor="textSecondary">
              CONTINUE WHERE YOU LEFT OFF
            </ThemedText>
            <Card
              onPress={() =>
                router.push(
                  `/projects/${recent.drillhole.projectId}/drillholes/${recent.drillhole.id}`,
                )
              }
              accessibilityLabel={`Continue with hole ${recent.drillhole.holeId}`}
              style={styles.recentCard}>
              <View style={styles.recentTop}>
                <View style={styles.recentTitle}>
                  <ThemedText type="heading">
                    {recent.drillhole.holeId}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {recent.projectName}
                  </ThemedText>
                </View>
                <StatusPill
                  label={statusLabel(recent.drillhole.status)}
                  tone={statusTone(recent.drillhole.status)}
                />
              </View>
              <View style={styles.recentProgress}>
                <ProgressBar
                  value={recent.progress}
                  label={`${recent.drillhole.holeId} logging progress`}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  {Math.round(recent.progress * 100)}% of{' '}
                  {recent.drillhole.actualFinalDepthM ??
                    recent.drillhole.plannedDepthM}{' '}
                  m logged
                </ThemedText>
              </View>
              <View
                style={[styles.continueRow, { backgroundColor: theme.accent }]}>
                <ThemedText
                  type="smallBold"
                  style={[styles.continueLabel, { color: theme.onAccent }]}>
                  Continue
                </ThemedText>
                <Icon name="arrow-right" size={20} themeColor="onAccent" />
              </View>
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="caption" themeColor="textSecondary">
            YOUR PROJECTS
          </ThemedText>

          {summaries && summaries.length === 0 ? (
            <Card style={styles.empty}>
              <BrandSymbol size={72} />
              <ThemedText type="heading">Start your first project</ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                A project holds your drillholes, core logs and samples. It takes
                a minute to set up.
              </ThemedText>
            </Card>
          ) : (
            (summaries ?? []).map(({ project, holeCount, progress }) => (
              <Card
                key={project.id}
                onPress={() => router.push(`/projects/${project.id}`)}
                accessibilityLabel={`Open project ${project.name}`}
                style={styles.projectCard}>
                <View style={styles.projectTop}>
                  <View style={styles.recentTitle}>
                    <ThemedText type="smallBold" style={styles.projectName}>
                      {project.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {holeCount} {holeCount === 1 ? 'hole' : 'holes'}
                      {project.commodity ? ` · ${project.commodity}` : ''}
                      {' · '}
                      {Math.round(progress * 100)}% logged
                    </ThemedText>
                    <SyncBadge kind="project" id={project.id} />
                  </View>
                  <Icon name="chevron-right" size={24} themeColor="muted" />
                </View>
                <ProgressBar
                  value={progress}
                  label={`${project.name} logging progress`}
                />
              </Card>
            ))
          )}

          <PrimaryButton
            label="New project"
            icon="plus"
            variant={
              summaries && summaries.length === 0 ? 'primary' : 'secondary'
            }
            onPress={() => router.push('/projects/new')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  guideCard: {
    gap: Spacing.two,
  },
  guideActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  guideStart: {
    flex: 1,
  },
  todayTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todayLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todayNumbers: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginTop: Spacing.two,
  },
  todayValue: {
    fontSize: 28,
    lineHeight: 34,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  hello: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  section: {
    gap: Spacing.two + 2,
  },
  recentCard: {
    gap: Spacing.three,
  },
  recentTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  recentTitle: {
    flex: 1,
    gap: Spacing.half,
  },
  recentProgress: {
    gap: Spacing.two,
  },
  continueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 52,
    borderRadius: Radius.control,
  },
  continueLabel: {
    fontSize: 16,
  },
  projectCard: {
    gap: Spacing.three,
  },
  projectTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  projectName: {
    fontSize: 17,
    lineHeight: 24,
  },
  empty: {
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
});
