import {
  actualDepthWarning,
  DRILLHOLE_STATUSES,
  type DrillholeStatus,
  type FieldDrillhole,
} from '@corechain/domain';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipSelect } from '@/components/form/chip-select';
import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  getDrillhole,
  updateDrillholeActuals,
  updateDrillholeStatus,
} from '@/data/drillholesRepository';

// Sprint 1 has no core boxes or runs yet (E3), so there is no real recorded
// depth to compare against — 0 means "nothing recorded yet", not a bug.
const DEEPEST_RECORDED_DEPTH_PLACEHOLDER = 0;

function formatStatus(status: DrillholeStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function DrillholeDetailScreen() {
  const { drillholeId } = useLocalSearchParams<{
    projectId: string;
    drillholeId: string;
  }>();

  const [drillhole, setDrillhole] = useState<FieldDrillhole | null>(null);
  const [startedAt, setStartedAt] = useState('');
  const [completedAt, setCompletedAt] = useState('');
  const [actualFinalDepthM, setActualFinalDepthM] = useState('');
  const [depthWarning, setDepthWarning] = useState<string | null>(null);
  const [savingActuals, setSavingActuals] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const load = useCallback(() => {
    getDrillhole(drillholeId).then((loaded) => {
      if (!loaded) {
        return;
      }
      setDrillhole(loaded);
      setStartedAt(loaded.startedAt ?? '');
      setCompletedAt(loaded.completedAt ?? '');
      setActualFinalDepthM(
        loaded.actualFinalDepthM != null ? String(loaded.actualFinalDepthM) : '',
      );
    });
  }, [drillholeId]);

  useFocusEffect(load);

  async function handleStatusChange(status: DrillholeStatus) {
    setStatusSaving(true);
    try {
      const updated = await updateDrillholeStatus(drillholeId, status);
      if (updated) {
        setDrillhole(updated);
      }
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleSaveActuals() {
    const parsedDepth =
      actualFinalDepthM.trim().length > 0 ? Number(actualFinalDepthM) : null;

    if (parsedDepth != null) {
      setDepthWarning(
        actualDepthWarning(parsedDepth, DEEPEST_RECORDED_DEPTH_PLACEHOLDER),
      );
    } else {
      setDepthWarning(null);
    }

    setSavingActuals(true);
    try {
      const updated = await updateDrillholeActuals(drillholeId, {
        startedAt: startedAt.trim() || null,
        completedAt: completedAt.trim() || null,
        actualFinalDepthM: parsedDepth,
      });
      if (updated) {
        setDrillhole(updated);
      }
    } finally {
      setSavingActuals(false);
    }
  }

  if (!drillhole) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.form}>
        <ThemedText type="subtitle">{drillhole.holeId}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Planned: {drillhole.plannedDepthM}m
          {drillhole.plannedAzimuthDeg != null
            ? ` · azimuth ${drillhole.plannedAzimuthDeg}°`
            : ''}
          {drillhole.plannedInclinationDeg != null
            ? ` · dip ${drillhole.plannedInclinationDeg}°`
            : ''}
        </ThemedText>
        {drillhole.collar ? (
          <ThemedText type="small" themeColor="textSecondary">
            Collar ({drillhole.collar.source}):{' '}
            {drillhole.collar.latitude.toFixed(6)},{' '}
            {drillhole.collar.longitude.toFixed(6)}
          </ThemedText>
        ) : null}

        <ChipSelect
          label="Status"
          options={DRILLHOLE_STATUSES}
          value={drillhole.status}
          onChange={handleStatusChange}
          formatOption={formatStatus}
        />
        {statusSaving ? (
          <ThemedText type="small" themeColor="textSecondary">
            Saving…
          </ThemedText>
        ) : null}

        <ThemedText type="smallBold">Actual details</ThemedText>
        <TextField
          label="Started (ISO date, e.g. 2026-09-19)"
          optional
          value={startedAt}
          onChangeText={setStartedAt}
          placeholder="YYYY-MM-DD"
        />
        <TextField
          label="Completed (ISO date)"
          optional
          value={completedAt}
          onChangeText={setCompletedAt}
          placeholder="YYYY-MM-DD"
        />
        <TextField
          label="Actual final depth (m)"
          optional
          value={actualFinalDepthM}
          onChangeText={setActualFinalDepthM}
          keyboardType="decimal-pad"
          error={depthWarning ?? undefined}
        />

        <PrimaryButton
          label="Save actual details"
          onPress={handleSaveActuals}
          loading={savingActuals}
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
});
