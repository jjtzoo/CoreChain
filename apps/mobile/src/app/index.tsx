import type { Project } from '@corechain/domain';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listProjects } from '@/data/projectsRepository';

/**
 * E1-1: the app's home screen. A field geologist working alone has no admin
 * assigning them a project, so this is where they create their own.
 */
export default function ProjectsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    listProjects()
      .then(setProjects)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  useFocusEffect(reload);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <ThemedText type="subtitle">Projects</ThemedText>
        <PrimaryButton
          label="New project"
          onPress={() => router.push('/projects/new')}
        />
      </View>

      {error ? (
        <ThemedText type="small" style={styles.errorText}>
          Couldn&apos;t load projects: {error}
        </ThemedText>
      ) : null}

      {projects && projects.length === 0 ? (
        <ThemedView type="backgroundElement" style={styles.emptyState}>
          <ThemedText type="default">No projects yet.</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Create one to start logging a drillhole — everything works
            offline.
          </ThemedText>
        </ThemedView>
      ) : (
        <FlatList
          data={projects ?? []}
          keyExtractor={(project) => project.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Link href={`/projects/${item.id}`} asChild>
              <Pressable>
                <ThemedView type="backgroundElement" style={styles.projectCard}>
                  <ThemedText type="default">{item.name}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.coordinateSystem}
                    {item.commodity ? ` · ${item.commodity}` : ''}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          )}
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
    alignItems: 'center',
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  projectCard: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.half,
  },
  emptyState: {
    padding: Spacing.four,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
  errorText: {
    color: '#d92d20',
  },
});
