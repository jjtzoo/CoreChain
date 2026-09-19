import {
  loggedLengthM,
  loggingProgress,
  type FieldDrillhole,
  type Project,
} from '@corechain/domain';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { BrandSymbol } from '@/components/brand-lockup';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusPill } from '@/components/ui/status-pill';
import { Radius, Spacing } from '@/constants/theme';
import {
  getMostRecentDrillhole,
  listDrillholes,
} from '@/data/drillholesRepository';
import { listIntervalRangesByProject } from '@/data/intervalsRepository';
import { listProjects } from '@/data/projectsRepository';
import { useTheme } from '@/hooks/use-theme';
import { statusLabel, statusTone } from '@/utils/status';

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
  const [summaries, setSummaries] = useState<ProjectSummary[] | null>(null);
  const [recent, setRecent] = useState<Recent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    (async () => {
      const projects = await listProjects();
      setSummaries(await Promise.all(projects.map(summarise)));

      const latest = await getMostRecentDrillhole();
      if (latest) {
        const ranges = await listIntervalRangesByProject(latest.drillhole.projectId);
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
  }, []);

  useFocusEffect(reload);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hello}>
          <ThemedText type="subtitle">{greeting(new Date())}</ThemedText>
          <View style={styles.offlineRow}>
            <Icon name="cellphone-check" size={18} themeColor="success" />
            <ThemedText type="small" themeColor="textSecondary">
              Saved on this phone. Works without signal.
            </ThemedText>
          </View>
        </View>

        {error ? (
          <ThemedText type="small" themeColor="danger">
            Couldn&apos;t load your projects: {error}
          </ThemedText>
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
                  <ThemedText type="heading">{recent.drillhole.holeId}</ThemedText>
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
                A project holds your drillholes, core logs and samples. It
                takes a minute to set up.
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
            variant={summaries && summaries.length === 0 ? 'primary' : 'secondary'}
            onPress={() => router.push('/projects/new')}
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
    gap: Spacing.four,
  },
  hello: {
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  offlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
