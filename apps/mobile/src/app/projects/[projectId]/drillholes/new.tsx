import type { Collar } from '@corechain/domain';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { createDrillhole } from '@/data/drillholesRepository';
import { nowIso } from '@/data/ids';

function parseOptionalNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * E2-1: create a drillhole from a GPS collar or manual entry, with planned
 * azimuth/dip/depth. Only the hole ID and planned depth are required.
 */
export default function NewDrillholeScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();

  const [holeId, setHoleId] = useState('');
  const [plannedDepthM, setPlannedDepthM] = useState('');
  const [plannedAzimuthDeg, setPlannedAzimuthDeg] = useState('');
  const [plannedInclinationDeg, setPlannedInclinationDeg] = useState('');
  const [manualLatitude, setManualLatitude] = useState('');
  const [manualLongitude, setManualLongitude] = useState('');
  const [collar, setCollar] = useState<Collar | null>(null);
  const [locatingGps, setLocatingGps] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function handleUseGps() {
    setLocatingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrors((prev) => ({
          ...prev,
          collar: 'Location permission was not granted. Enter the collar manually instead.',
        }));
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setCollar({
        source: 'gps',
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyM: position.coords.accuracy,
        capturedAt: nowIso(),
      });
      setErrors((prev) => ({ ...prev, collar: '' }));
    } catch {
      setErrors((prev) => ({
        ...prev,
        collar: "Couldn't get a GPS fix. Enter the collar manually instead.",
      }));
    } finally {
      setLocatingGps(false);
    }
  }

  function manualCollarOrNull(): Collar | null {
    const latitude = parseOptionalNumber(manualLatitude);
    const longitude = parseOptionalNumber(manualLongitude);
    if (latitude == null || longitude == null) {
      return null;
    }
    return {
      source: 'manual',
      latitude,
      longitude,
      accuracyM: null,
      capturedAt: nowIso(),
    };
  }

  async function handleCreate() {
    setErrors({});
    setSaving(true);
    try {
      const result = await createDrillhole(projectId, {
        holeId,
        plannedDepthM: Number(plannedDepthM),
        plannedAzimuthDeg: parseOptionalNumber(plannedAzimuthDeg),
        plannedInclinationDeg: parseOptionalNumber(plannedInclinationDeg),
        collar: collar ?? manualCollarOrNull(),
      });

      if (result.outcome === 'invalid') {
        const fieldErrors: Record<string, string> = {};
        for (const e of result.errors.errors) {
          fieldErrors[e.field] = e.message;
        }
        setErrors(fieldErrors);
        return;
      }

      router.replace(
        `/projects/${projectId}/drillholes/${result.drillhole.id}`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.form}>
        <TextField
          label="Hole ID"
          value={holeId}
          onChangeText={setHoleId}
          error={errors.holeId}
          placeholder="e.g. DDH-01"
          autoCapitalize="characters"
          autoFocus
        />

        <TextField
          label="Planned depth (m)"
          value={plannedDepthM}
          onChangeText={setPlannedDepthM}
          error={errors.plannedDepthM}
          keyboardType="decimal-pad"
        />

        <TextField
          label="Planned azimuth (0-360°)"
          optional
          value={plannedAzimuthDeg}
          onChangeText={setPlannedAzimuthDeg}
          error={errors.plannedAzimuthDeg}
          keyboardType="decimal-pad"
        />

        <TextField
          label="Planned inclination / dip (-90 to 90°)"
          optional
          value={plannedInclinationDeg}
          onChangeText={setPlannedInclinationDeg}
          error={errors.plannedInclinationDeg}
          keyboardType="decimal-pad"
        />

        <ThemedText type="smallBold">Collar location</ThemedText>
        {collar ? (
          <ThemedText type="small" themeColor="textSecondary">
            GPS fix: {collar.latitude.toFixed(6)}, {collar.longitude.toFixed(6)}
            {collar.accuracyM != null
              ? ` (±${Math.round(collar.accuracyM)}m)`
              : ''}
          </ThemedText>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Use GPS at the collar, or enter coordinates manually below.
          </ThemedText>
        )}
        <PrimaryButton
          label="Use GPS"
          variant="secondary"
          onPress={handleUseGps}
          loading={locatingGps}
        />
        {errors.collar ? (
          <ThemedText type="small" style={styles.errorText}>
            {errors.collar}
          </ThemedText>
        ) : null}

        {!collar && (
          <>
            <TextField
              label="Latitude"
              optional
              value={manualLatitude}
              onChangeText={setManualLatitude}
              keyboardType="numbers-and-punctuation"
            />
            <TextField
              label="Longitude"
              optional
              value={manualLongitude}
              onChangeText={setManualLongitude}
              keyboardType="numbers-and-punctuation"
            />
          </>
        )}

        <PrimaryButton
          label="Create drillhole"
          onPress={handleCreate}
          loading={saving}
          disabled={holeId.trim().length === 0 || plannedDepthM.trim().length === 0}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  form: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  errorText: {
    color: '#d92d20',
  },
});
