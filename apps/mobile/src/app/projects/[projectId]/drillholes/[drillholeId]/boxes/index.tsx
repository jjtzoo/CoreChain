import type { FieldCoreBox } from '@corechain/domain';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContinuitySummary } from '@/components/continuity-summary';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { deleteBox, listBoxes } from '@/data/coreRepository';
import { countPhotosBySubject } from '@/data/photosRepository';

/** E3-1: the hole's core boxes, with any depth gaps or overlaps between them. */
export default function CoreBoxesScreen() {
  const { projectId, drillholeId } = useLocalSearchParams<{
    projectId: string;
    drillholeId: string;
  }>();
  const router = useRouter();
  const [boxes, setBoxes] = useState<FieldCoreBox[] | null>(null);
  const [photoCounts, setPhotoCounts] = useState<Map<string, number>>(new Map());

  const reload = useCallback(() => {
    listBoxes(drillholeId).then(setBoxes);
    countPhotosBySubject(drillholeId, 'box').then(setPhotoCounts);
  }, [drillholeId]);

  useFocusEffect(reload);

  function confirmDelete(box: FieldCoreBox) {
    Alert.alert(
      `Delete box ${box.boxNumber}?`,
      `${box.fromM}–${box.toM} m will be removed from this hole.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteBox(box.id).then(reload),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <PrimaryButton
          label="Add box"
          onPress={() =>
            router.push(
              `/projects/${projectId}/drillholes/${drillholeId}/boxes/new`,
            )
          }
        />

        <ContinuitySummary ranges={boxes ?? []} />

        {boxes && boxes.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="default">No core boxes yet.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Add each box with its from/to depth so core is traceable to depth.
            </ThemedText>
          </ThemedView>
        ) : (
          (boxes ?? []).map((box) => (
            <ThemedView
              key={box.id}
              type="backgroundElement"
              style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <ThemedText type="default">Box {box.boxNumber}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {box.fromM}–{box.toM} m
                    {box.note ? ` · ${box.note}` : ''}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() =>
                    router.push(
                      `/projects/${projectId}/drillholes/${drillholeId}/photos?subjectType=box&subjectId=${box.id}`,
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Photos of box ${box.boxNumber}`}
                  hitSlop={Spacing.two}>
                  <ThemedText type="link">
                    Photos ({photoCounts.get(box.id) ?? 0})
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(box)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete box ${box.boxNumber}`}
                  hitSlop={Spacing.two}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Delete
                  </ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          ))
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
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
});
