import {
  DEFAULT_PHOTO_MAX_MB,
  photoLabel,
  type PhotoSubjectType,
} from '@corechain/domain';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listBoxes } from '@/data/coreRepository';
import { getDrillhole } from '@/data/drillholesRepository';
import { listIntervals } from '@/data/intervalsRepository';
import { compressPhoto, deletePhotoFile, keepPhoto } from '@/data/photoFiles';
import {
  fileNameFor,
  insertPhoto,
  type NewPhoto,
} from '@/data/photosRepository';
import { getProject } from '@/data/projectsRepository';
import { nowIso } from '@/data/ids';

type Context = Omit<
  NewPhoto,
  'widthPx' | 'heightPx' | 'sizeBytes' | 'capturedAt'
>;

/**
 * E5-1 / E5-2: photograph a core box or a logged interval from inside the app.
 * The photo is saved against that box/interval with its hole ID, box number,
 * depth range and timestamp, compressed to the project's size limit, and stored
 * on the device.
 */
export default function TakePhotoScreen() {
  const { projectId, drillholeId, subjectType, subjectId } =
    useLocalSearchParams<{
      projectId: string;
      drillholeId: string;
      subjectType: PhotoSubjectType;
      subjectId: string;
    }>();
  const router = useRouter();
  const theme = useTheme();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const [context, setContext] = useState<Context | null>(null);
  const [maxMb, setMaxMb] = useState(DEFAULT_PHOTO_MAX_MB);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getDrillhole(drillholeId),
      subjectType === 'box' ? listBoxes(drillholeId) : listIntervals(drillholeId),
      getProject(projectId),
    ]).then(([hole, subjects, project]) => {
      const subject = subjects.find((s) => s.id === subjectId);
      if (!hole || !subject) {
        setError('That box or interval no longer exists.');
        return;
      }
      setMaxMb(project?.photoMaxMb ?? DEFAULT_PHOTO_MAX_MB);
      setContext({
        drillholeId,
        subjectType,
        subjectId,
        holeId: hole.holeId,
        boxNumber: 'boxNumber' in subject ? subject.boxNumber : null,
        fromM: subject.fromM,
        toM: subject.toM,
      });
    });
  }, [projectId, drillholeId, subjectType, subjectId]);

  async function handleCapture() {
    if (!context || !cameraRef.current || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const capturedAt = nowIso();
      const picture = await cameraRef.current.takePictureAsync({ quality: 1 });
      const compressed = await compressPhoto(
        picture.uri,
        picture.width,
        picture.height,
        maxMb,
      );

      const photo: NewPhoto = {
        ...context,
        widthPx: compressed.widthPx,
        heightPx: compressed.heightPx,
        sizeBytes: compressed.sizeBytes,
        capturedAt,
      };
      const fileName = fileNameFor(photo);
      keepPhoto(compressed, fileName);
      try {
        await insertPhoto(photo, fileName);
      } catch (err) {
        // Don't leave an orphan file behind if the record couldn't be saved.
        deletePhotoFile(fileName);
        throw err;
      }
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (!permission) {
    return null;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.message}>
          <ThemedText type="default">
            CoreChain Field needs the camera to photograph core.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Photos stay on this device, filed against the box or interval
            you’re photographing.
          </ThemedText>
          <PrimaryButton label="Allow camera" onPress={requestPermission} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.cameraFrame}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          onCameraReady={() => setReady(true)}
        />
        {context ? (
          <View style={styles.caption}>
            <ThemedText type="smallBold" style={styles.captionText}>
              {photoLabel(context)}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {error ? (
        <ThemedText type="small" themeColor="danger" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.controls}>
        {busy ? (
          <ActivityIndicator />
        ) : (
          <Pressable
            onPress={handleCapture}
            disabled={!ready || !context}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            style={[
              styles.shutter,
              { borderColor: theme.accent },
              (!ready || !context) && styles.disabled,
            ]}>
            <View style={[styles.shutterInner, { backgroundColor: theme.accent }]} />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  message: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cameraFrame: {
    flex: 1,
    margin: Spacing.two,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  caption: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    padding: Spacing.two,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  captionText: {
    color: '#ffffff',
  },
  controls: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 112,
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  disabled: {
    opacity: 0.4,
  },
  error: {
    paddingHorizontal: Spacing.three,
  },
});
