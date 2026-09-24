import {
  findSampleByTag,
  scannedSampleNumber,
  type FieldDrillhole,
  type FieldSample,
} from '@corechain/domain';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ScreenLoader } from '@/components/screen-loader';
import { ThemedText } from '@/components/themed-text';
import { AlertRow } from '@/components/ui/alert-row';
import { Card } from '@/components/ui/card';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { listDrillholes } from '@/data/drillholesRepository';
import { listSamples } from '@/data/samplesRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { useTheme } from '@/hooks/use-theme';
import { sampleStatusTone } from '@/utils/status';

// The tag formats bag tickets and printed labels use.
const BARCODE_TYPES = ['qr', 'code128', 'code39', 'datamatrix'] as const;

// A code held in front of the camera is read many times a second: the same
// code again within this window is the same scan, not a new one.
const SAME_SCAN_MS = 2500;

type Notice = { tone: 'danger' | 'info'; message: string } | null;

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Where the sample came from: hole and depth, or which control it is. */
function origin(sample: FieldSample, holeName: string): string {
  const parts: string[] = [`Hole ${holeName}`];
  if (sample.fromM != null && sample.toM != null) {
    parts.push(`${sample.fromM}–${sample.toM} m`);
  }
  if (sample.type !== 'primary') {
    parts.push(
      sample.type === 'standard' && sample.standardRef
        ? `Standard ${sample.standardRef}`
        : capitalise(sample.type),
    );
  }
  return parts.join(' · ');
}

/**
 * Scan bag tags: point the camera at a bag's tag (QR code or barcode), or
 * type its number, and the phone shows where that sample came from, hole and
 * depth, so a tag on the wrong bag is caught at the core shed. The scanned
 * bags are then bagged, sealed, handed over or put in a lab dispatch together,
 * through the same custody steps as picking them from the list. Works offline:
 * tags are looked up in this phone's own samples.
 */
export default function ScanTagsScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();

  const [samples, setSamples] = useState<FieldSample[] | null>(null);
  const [holes, setHoles] = useState<FieldDrillhole[]>([]);
  const [scanned, setScanned] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const lastRead = useRef<{ code: string; at: number } | null>(null);

  const reload = useCallback(() => {
    listSamples(projectId).then(setSamples);
    listDrillholes(projectId).then(setHoles);
  }, [projectId]);
  useFocusReload(reload);

  const holeName = new Map(holes.map((h) => [h.id, h.holeId]));
  const byId = new Map((samples ?? []).map((s) => [s.id, s]));
  const scannedSamples = scanned
    .map((id) => byId.get(id))
    .filter((s): s is FieldSample => s != null);

  function take(raw: string) {
    if (!samples) return;
    const code = scannedSampleNumber(raw);
    if (!code) return;
    const sample = findSampleByTag(code, samples);
    if (!sample) {
      setNotice({
        tone: 'danger',
        message: `${code} isn't a sample in this project. Check the tag before bagging.`,
      });
      return;
    }
    setNotice(
      scanned.includes(sample.id)
        ? { tone: 'info', message: `${sample.sampleNumber} is already on the list.` }
        : null,
    );
    // The latest scan goes to the top, so its origin is the first thing seen.
    setScanned((current) => [sample.id, ...current.filter((id) => id !== sample.id)]);
  }

  function handleBarcode({ data }: { data: string }) {
    const now = Date.now();
    const last = lastRead.current;
    if (last && last.code === data && now - last.at < SAME_SCAN_MS) return;
    lastRead.current = { code: data, at: now };
    take(data);
  }

  function handleTyped() {
    if (!typed.trim()) {
      setNotice({ tone: 'danger', message: 'Type the number on the tag first.' });
      return;
    }
    take(typed);
    setTyped('');
  }

  function actOnScanned(path: string) {
    if (scanned.length === 0) return;
    router.push(
      `/projects/${projectId}/${path}${path.includes('?') ? '&' : '?'}sampleIds=${scanned.join(',')}` as Href,
    );
  }

  if (!permission || !samples) {
    return <ScreenLoader />;
  }

  const latest = scannedSamples[0] ?? null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {permission.granted ? (
          <View style={styles.cameraFrame}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
              onBarcodeScanned={handleBarcode}
            />
            <View style={styles.caption}>
              <ThemedText type="smallBold" style={styles.captionText}>
                Point at a bag tag
              </ThemedText>
            </View>
          </View>
        ) : (
          <Card style={styles.permission}>
            <ThemedText type="default">
              Allow the camera to scan bag tags. You can also type the number
              below.
            </ThemedText>
            <PrimaryButton
              label="Allow camera"
              variant="secondary"
              onPress={requestPermission}
            />
          </Card>
        )}

        <View style={styles.typedRow}>
          <View style={styles.typedField}>
            <TextField
              label="Or type the tag number"
              value={typed}
              onChangeText={(text) => {
                setTyped(text);
                if (notice?.tone === 'danger') setNotice(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleTyped}
              placeholder="AB-0041"
            />
          </View>
          <View style={styles.typedButton}>
            <PrimaryButton label="Add" variant="secondary" onPress={handleTyped} />
          </View>
        </View>

        {notice ? <AlertRow tone={notice.tone} message={notice.message} /> : null}

        {latest ? (
          <Card style={[styles.latest, { borderColor: theme.accent }]}>
            <ThemedText type="caption" themeColor="textSecondary">
              Last scanned
            </ThemedText>
            <View style={styles.numberRow}>
              <ThemedText type="title">{latest.sampleNumber}</ThemedText>
              <StatusPill
                label={capitalise(latest.status)}
                tone={sampleStatusTone(latest.status)}
              />
            </View>
            <ThemedText type="default">
              {origin(latest, holeName.get(latest.drillholeId) ?? '?')}
            </ThemedText>
          </Card>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Each tag you scan is listed here with its hole and depth. Then
            bag, seal, hand over or dispatch them together.
          </ThemedText>
        )}

        {scannedSamples.slice(1).map((sample) => (
          <Card key={sample.id}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <ThemedText type="heading">{sample.sampleNumber}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {origin(sample, holeName.get(sample.drillholeId) ?? '?')}
                </ThemedText>
              </View>
              <StatusPill
                label={capitalise(sample.status)}
                tone={sampleStatusTone(sample.status)}
              />
            </View>
          </Card>
        ))}
      </ScrollView>

      {scanned.length > 0 ? (
        <View
          style={[
            styles.bulkBar,
            { backgroundColor: theme.background, borderTopColor: theme.border },
          ]}
        >
          <View style={styles.bulkTop}>
            <ThemedText type="smallBold">
              {scanned.length} scanned
            </ThemedText>
            <PrimaryButton
              label="Clear"
              variant="secondary"
              onPress={() => {
                setScanned([]);
                setNotice(null);
              }}
            />
          </View>
          <View style={styles.bulkRow}>
            <View style={styles.bulkButton}>
              <PrimaryButton
                label="Bag"
                onPress={() => actOnScanned('custody/record?type=bagged')}
              />
            </View>
            <View style={styles.bulkButton}>
              <PrimaryButton
                label="Seal"
                variant="secondary"
                onPress={() => actOnScanned('custody/record?type=sealed')}
              />
            </View>
            <View style={styles.bulkButton}>
              <PrimaryButton
                label="Hand over"
                variant="secondary"
                onPress={() => actOnScanned('custody/record?type=handed_over')}
              />
            </View>
          </View>
          <PrimaryButton
            label="Put in a lab dispatch"
            icon="truck-delivery-outline"
            variant="secondary"
            onPress={() => actOnScanned('dispatches/new')}
          />
        </View>
      ) : null}
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
  cameraFrame: {
    height: 260,
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
    bottom: 0,
    padding: Spacing.two,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  captionText: {
    color: '#ffffff',
    textAlign: 'center',
  },
  permission: {
    gap: Spacing.three,
  },
  typedRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
  },
  typedField: {
    flex: 1,
  },
  typedButton: {
    width: 96,
  },
  latest: {
    gap: Spacing.one,
    borderWidth: 2,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.one,
  },
  bulkBar: {
    padding: Spacing.three,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bulkTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bulkRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bulkButton: {
    flex: 1,
  },
});
