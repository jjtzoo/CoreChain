import type { FieldCoreBox } from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ContinuitySummary } from '@/components/continuity-summary';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { RowAction } from '@/components/ui/row-action';
import { Spacing } from '@/constants/theme';
import { deleteBox, listBoxes } from '@/data/coreRepository';
import { countPhotosBySubject } from '@/data/photosRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';

/** E3-1: the hole's core boxes, with any depth gaps or overlaps between them. */
export default function CoreBoxesScreen() {
  const { projectId, drillholeId } = useLocalSearchParams<{
    projectId: string;
    drillholeId: string;
  }>();
  const router = useRouter();
  const [boxes, setBoxes] = useState<FieldCoreBox[] | null>(null);
  const [photoCounts, setPhotoCounts] = useState<Map<string, number>>(
    new Map(),
  );

  const reload = useCallback(() => {
    listBoxes(drillholeId).then(setBoxes);
    countPhotosBySubject(drillholeId, 'box').then(setPhotoCounts);
  }, [drillholeId]);

  useFocusReload(reload);

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
          <Card style={styles.card}>
            <ThemedText type="default">No core boxes yet.</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Add each box with its from/to depth so core is traceable to depth.
            </ThemedText>
          </Card>
        ) : (
          (boxes ?? []).map((box) => (
            <Card key={box.id} style={styles.card}>
              <View style={styles.rowText}>
                <ThemedText type="heading">Box {box.boxNumber}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {box.fromM}–{box.toM} m{box.note ? ` · ${box.note}` : ''}
                </ThemedText>
              </View>
              <View style={styles.actions}>
                <RowAction
                  icon="camera-outline"
                  label={`Photos (${photoCounts.get(box.id) ?? 0})`}
                  onPress={() =>
                    router.push(
                      `/projects/${projectId}/drillholes/${drillholeId}/photos?subjectType=box&subjectId=${box.id}`,
                    )
                  }
                  accessibilityLabel={`Photos of box ${box.boxNumber}`}
                />
                <RowAction
                  icon="trash-can-outline"
                  tone="danger"
                  onPress={() => confirmDelete(box)}
                  accessibilityLabel={`Delete box ${box.boxNumber}`}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.three,
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
