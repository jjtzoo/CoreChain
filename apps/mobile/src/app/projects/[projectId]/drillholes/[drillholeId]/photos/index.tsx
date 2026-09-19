import {
  photoLabel,
  type FieldPhoto,
  type PhotoSubjectType,
} from '@corechain/domain';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { deletePhotoFile, photoFile } from '@/data/photoFiles';
import { deletePhotoRecord, listPhotos } from '@/data/photosRepository';

function describeSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/** E5-1 / E5-2: the photos taken against one core box or interval. */
export default function PhotosScreen() {
  const { projectId, drillholeId, subjectType, subjectId } =
    useLocalSearchParams<{
      projectId: string;
      drillholeId: string;
      subjectType: PhotoSubjectType;
      subjectId: string;
    }>();
  const router = useRouter();
  const [photos, setPhotos] = useState<FieldPhoto[] | null>(null);

  const reload = useCallback(() => {
    listPhotos(subjectType, subjectId).then(setPhotos);
  }, [subjectType, subjectId]);

  useFocusEffect(reload);

  function confirmDelete(photo: FieldPhoto) {
    Alert.alert(
      'Delete this photo?',
      `${photoLabel(photo)} will be removed from this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deletePhotoRecord(photo.id);
            deletePhotoFile(photo.fileName);
            reload();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <PrimaryButton
          label="Take photo"
          onPress={() =>
            router.push(
              `/projects/${projectId}/drillholes/${drillholeId}/photos/take?subjectType=${subjectType}&subjectId=${subjectId}`,
            )
          }
        />

        {photos && photos.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="default">No photos yet.</ThemedText>
          </ThemedView>
        ) : (
          (photos ?? []).map((photo) => (
            <ThemedView
              key={photo.id}
              type="backgroundElement"
              style={styles.card}>
              <Image
                source={{ uri: photoFile(photo.fileName).uri }}
                style={styles.image}
                contentFit="cover"
                accessibilityLabel={`Photo, ${photoLabel(photo)}`}
              />
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <ThemedText type="small">{photoLabel(photo)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(photo.capturedAt).toLocaleString()} ·{' '}
                    {photo.widthPx}×{photo.heightPx} ·{' '}
                    {describeSize(photo.sizeBytes)}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => confirmDelete(photo)}
                  accessibilityRole="button"
                  accessibilityLabel="Delete photo"
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
    gap: Spacing.two,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: Spacing.two,
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
