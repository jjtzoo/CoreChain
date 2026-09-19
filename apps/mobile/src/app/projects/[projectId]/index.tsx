import {
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
import { getProject } from '@/data/projectsRepository';

// Sprint 1 has no core logging yet (that's E4, a later sprint), so every
// hole's logged metres is 0 for now — loggingProgress always renders 0%
// until logging exists to measure. That's honest, not a placeholder bug.
const LOGGED_METRES_PLACEHOLDER = 0;

export default function ProjectDetailScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [drillholes, setDrillholes] = useState<FieldDrillhole[]>([]);
  const [query, setQuery] = useState('');

  const reload = useCallback(() => {
    getProject(projectId).then(setProject);
    listDrillholes(projectId).then(setDrillholes);
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
        <Pressable onPress={() => router.push(`/projects/${projectId}/settings`)}>
          <ThemedText type="link">Settings</ThemedText>
        </Pressable>
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
            const progress = loggingProgress(LOGGED_METRES_PLACEHOLDER, item);
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
