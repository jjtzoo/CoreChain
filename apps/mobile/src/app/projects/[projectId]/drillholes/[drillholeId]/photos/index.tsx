import {
  photoBackupLabel,
  photoLabel,
  type FieldPhoto,
  type PhotoBackupState,
  type PhotoSubjectType,
} from '@corechain/domain';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { RowAction } from '@/components/ui/row-action';
import { StatusPill, type Tone } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { deletePhotoFile, photoFile } from '@/data/photoFiles';
import { photoBackupStates } from '@/data/photoUploadsRepository';
import { deletePhotoRecord, listPhotos } from '@/data/photosRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { useSync } from '@/sync/sync-context';

const BACKUP_TONE: Record<PhotoBackupState, Tone> = {
  sent: 'success',
  waiting: 'neutral',
  failed: 'danger',
  'no-file': 'neutral',
};

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
  const [backup, setBackup] = useState<Map<string, PhotoBackupState>>(
    new Map(),
  );
  // Reloads when photo files go up, so a photo's badge turns to "Backed up".
  const { photoBackupVersion } = useSync();

  const reload = useCallback(() => {
    void photoBackupVersion;
    listPhotos(subjectType, subjectId).then(setPhotos);
    photoBackupStates()
      .then(setBackup)
      .catch(() => {});
  }, [subjectType, subjectId, photoBackupVersion]);

  useFocusReload(reload);

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
          <Card style={styles.card}>
            <ThemedText type="default">No photos yet.</ThemedText>
          </Card>
        ) : (
          (photos ?? []).map((photo) => (
            <Card key={photo.id} style={styles.card}>
              <Image
                source={{ uri: photoFile(photo.fileName).uri }}
                style={styles.image}
                contentFit="cover"
                accessibilityLabel={`Photo, ${photoLabel(photo)}`}
              />
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <StatusPill
                    label={photoBackupLabel(backup.get(photo.id) ?? 'waiting')}
                    tone={BACKUP_TONE[backup.get(photo.id) ?? 'waiting']}
                  />
                  <ThemedText type="small">{photoLabel(photo)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {new Date(photo.capturedAt).toLocaleString()} ·{' '}
                    {photo.widthPx}×{photo.heightPx} ·{' '}
                    {describeSize(photo.sizeBytes)}
                  </ThemedText>
                </View>
                <RowAction
                  icon="trash-can-outline"
                  tone="danger"
                  onPress={() => confirmDelete(photo)}
                  accessibilityLabel="Delete photo"
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
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  image: {
    width: '100%',
    height: 220,
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
