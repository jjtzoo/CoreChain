import {
  actualDepthWarning,
  deepestRecordedDepthM,
  DRILLHOLE_STATUSES,
  normaliseDateInput,
  validateActualDates,
  type DrillholeStatus,
  type FieldDrillhole,
} from '@corechain/domain';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipSelect } from '@/components/form/chip-select';
import { DateField } from '@/components/form/date-field';
import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { listBoxes, listRuns } from '@/data/coreRepository';
import { listIntervals } from '@/data/intervalsRepository';
import { listHoleSamples } from '@/data/samplesRepository';
import {
  getDrillhole,
  updateDrillholeActuals,
  updateDrillholeStatus,
} from '@/data/drillholesRepository';

function formatStatus(status: DrillholeStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function DrillholeDetailScreen() {
  const { projectId, drillholeId } = useLocalSearchParams<{
    projectId: string;
    drillholeId: string;
  }>();
  const router = useRouter();

  const [drillhole, setDrillhole] = useState<FieldDrillhole | null>(null);
  const [boxCount, setBoxCount] = useState(0);
  const [runCount, setRunCount] = useState(0);
  const [intervalCount, setIntervalCount] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);
  // Deepest depth recorded by any core box, run or log interval — what the
  // E2-2 "final depth is shallower than what's recorded" warning compares to.
  const [deepestRecordedM, setDeepestRecordedM] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [dateErrors, setDateErrors] = useState<{
    startedAt?: string;
    completedAt?: string;
  }>({});
  const [depthError, setDepthError] = useState<string | null>(null);
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
      // Tidy any date saved in an older, looser format (e.g. 2026/09/19).
      const started = normaliseDateInput(loaded.startedAt ?? '', 'Started');
      const completed = normaliseDateInput(loaded.completedAt ?? '', 'Completed');
      setStartedAt(started.valid ? started.value : null);
      setCompletedAt(completed.valid ? completed.value : null);
      setActualFinalDepthM(
        loaded.actualFinalDepthM != null ? String(loaded.actualFinalDepthM) : '',
      );
    });
    listHoleSamples(drillholeId).then((samples) => setSampleCount(samples.length));
    Promise.all([
      listBoxes(drillholeId),
      listRuns(drillholeId),
      listIntervals(drillholeId),
    ]).then(([boxes, runs, intervals]) => {
      setBoxCount(boxes.length);
      setRunCount(runs.length);
      setIntervalCount(intervals.length);
      setDeepestRecordedM(
        deepestRecordedDepthM([...boxes, ...runs, ...intervals]),
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
    const dates = validateActualDates(startedAt ?? '', completedAt ?? '');
    setDateErrors(dates.valid ? {} : dates.errors);

    const depthText = actualFinalDepthM.trim();
    const parsedDepth = depthText.length > 0 ? Number(depthText) : null;
    const depthInvalid =
      parsedDepth != null && !(Number.isFinite(parsedDepth) && parsedDepth > 0);
    setDepthError(
      depthInvalid ? 'Final depth must be a number above 0.' : null,
    );

    if (!dates.valid || depthInvalid) {
      return;
    }

    if (parsedDepth != null) {
      setDepthWarning(actualDepthWarning(parsedDepth, deepestRecordedM));
    } else {
      setDepthWarning(null);
    }

    setSavingActuals(true);
    try {
      const updated = await updateDrillholeActuals(drillholeId, {
        startedAt: dates.startedAt,
        completedAt: dates.completedAt,
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
      <FormScrollView contentContainerStyle={styles.form}>
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

        <ThemedText type="smallBold">Core</ThemedText>
        <PrimaryButton
          label={`Core boxes (${boxCount})`}
          variant="secondary"
          onPress={() =>
            router.push(
              `/projects/${projectId}/drillholes/${drillholeId}/boxes`,
            )
          }
        />
        <PrimaryButton
          label={`Core runs (${runCount})`}
          variant="secondary"
          onPress={() =>
            router.push(
              `/projects/${projectId}/drillholes/${drillholeId}/runs`,
            )
          }
        />

        <PrimaryButton
          label={`Core log (${intervalCount})`}
          variant="secondary"
          onPress={() =>
            router.push(`/projects/${projectId}/drillholes/${drillholeId}/log`)
          }
        />

        <PrimaryButton
          label={`Samples (${sampleCount})`}
          variant="secondary"
          onPress={() =>
            router.push(`/projects/${projectId}/samples?drillholeId=${drillholeId}`)
          }
        />

        <ThemedText type="smallBold">Actual details</ThemedText>
        <DateField
          label="Started"
          optional
          value={startedAt}
          onChange={setStartedAt}
          error={dateErrors.startedAt}
        />
        <DateField
          label="Completed"
          optional
          value={completedAt}
          onChange={setCompletedAt}
          minimumDate={startedAt}
          error={dateErrors.completedAt}
        />
        <TextField
          label="Actual final depth (m)"
          optional
          value={actualFinalDepthM}
          onChangeText={setActualFinalDepthM}
          keyboardType="decimal-pad"
          error={depthError ?? depthWarning ?? undefined}
        />

        <PrimaryButton
          label="Save actual details"
          onPress={handleSaveActuals}
          loading={savingActuals}
        />
      </FormScrollView>
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
