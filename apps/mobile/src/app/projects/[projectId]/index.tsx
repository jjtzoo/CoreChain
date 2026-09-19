import {
  loggedLengthM,
  loggingProgress,
  matchesDrillholeSearch,
  type FieldDrillhole,
  type Project,
} from '@corechain/domain';
import { Link, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listDrillholes } from '@/data/drillholesRepository';
import { listIntervalRangesByProject } from '@/data/intervalsRepository';
import { getProject } from '@/data/projectsRepository';

export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [drillholes, setDrillholes] = useState<FieldDrillhole[]>([]);
  // Metres logged per drillhole id (overlapping intervals counted once).
  const [loggedMetres, setLoggedMetres] = useState<Map<string, number>>(new Map());
  const [query, setQuery] = useState('');

  const reload = useCallback(() => {
    getProject(projectId).then(setProject);
    listDrillholes(projectId).then(setDrillholes);
    listIntervalRangesByProject(projectId).then((byHole) => {
      setLoggedMetres(
        new Map([...byHole].map(([holeId, ranges]) => [holeId, loggedLengthM(ranges)])),
      );
    });
  }, [projectId]);

  useFocusEffect(reload);

  const visibleDrillholes = useMemo(
    () => drillholes.filter((d) => matchesDrillholeSearch(d, query)),
    [drillholes, query],
  );

  if (!project) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="subtitle">{project.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {project.coordinateSystem}
          </ThemedText>
        </View>
        <View style={styles.headerLinks}>
          <Pressable onPress={() => router.push(`/projects/${projectId}/samples`)}>
            <ThemedText type="link">Samples</ThemedText>
          </Pressable>
          <Pressable onPress={() => router.push(`/projects/${projectId}/export`)}>
            <ThemedText type="link">Export</ThemedText>
          </Pressable>
          <Pressable onPress={() => router.push(`/projects/${projectId}/settings`)}>
            <ThemedText type="link">Settings</ThemedText>
          </Pressable>
        </View>
      </View>

      <TextField
        label="Search holes"
        value={query}
        onChangeText={setQuery}
        placeholder="Search by hole ID"
      />

      <PrimaryButton
        label="New drillhole"
        onPress={() => router.push(`/projects/${projectId}/drillholes/new`)}
      />

      {drillholes.length === 0 ? (
        <ThemedView type="backgroundElement" style={styles.emptyState}>
          <ThemedText type="default">No drillholes yet.</ThemedText>
        </ThemedView>
      ) : (
        <FlatList
          data={visibleDrillholes}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <ThemedView type="backgroundElement" style={styles.emptyState}>
              <ThemedText type="default">
                No holes match &ldquo;{query.trim()}&rdquo;.
              </ThemedText>
            </ThemedView>
          }
          renderItem={({ item }) => {
            const progress = loggingProgress(loggedMetres.get(item.id) ?? 0, item);
            return (
              <Link
                href={`/projects/${projectId}/drillholes/${item.id}`}
                asChild>
                <Pressable>
                  <ThemedView type="backgroundElement" style={styles.holeCard}>
                    <ThemedText type="default">{item.holeId}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.status} ·{' '}
                      {item.actualFinalDepthM ?? item.plannedDepthM}m ·{' '}
                      {Math.round(progress * 100)}% logged
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              </Link>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.three,
  },
  headerText: {
    gap: Spacing.half,
  },
  headerLinks: {
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  holeCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.half,
  },
  emptyState: {
    padding: Spacing.four,
    borderRadius: Spacing.two,
  },
});
