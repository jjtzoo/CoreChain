import {
  filterSamples,
  qcAchievement,
  qcReminders,
  SAMPLE_STATUSES,
  SAMPLE_TYPES,
  type ControlType,
  type FieldDrillhole,
  type FieldSample,
  type Project,
  type QcEvent,
  type SampleStatus,
  type SampleType,
} from '@corechain/domain';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipSelect } from '@/components/form/chip-select';
import { PrimaryButton } from '@/components/form/primary-button';
import { CONTROL_LABELS, QcReminders } from '@/components/qc-reminders';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listDrillholes } from '@/data/drillholesRepository';
import { getProject } from '@/data/projectsRepository';
import {
  deleteSample,
  dismissQcReminder,
  listQcEvents,
  listSamples,
} from '@/data/samplesRepository';

const ALL = 'all';

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function describeSample(
  sample: FieldSample,
  holeName: string,
  samples: readonly FieldSample[],
): string {
  const parts: string[] = [holeName];
  if (sample.fromM != null && sample.toM != null) {
    parts.push(`${sample.fromM}–${sample.toM} m`);
  }
  if (sample.type === 'standard' && sample.standardRef) {
    parts.push(sample.standardRef);
  }
  if (sample.type === 'duplicate') {
    const parent = samples.find((s) => s.id === sample.parentSampleId);
    parts.push(`duplicate of ${parent?.sampleNumber ?? '?'}`);
  }
  parts.push(sample.status);
  return parts.join(' · ');
}

/**
 * E6-3: the sample register — filter by hole, type and status, see the QC
 * insertion rate achieved against the target, and act on due QC reminders
 * (E6-2).
 */
export default function SampleRegisterScreen() {
  const { projectId, drillholeId } = useLocalSearchParams<{
    projectId: string;
    drillholeId?: string;
  }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [holes, setHoles] = useState<FieldDrillhole[]>([]);
  const [samples, setSamples] = useState<FieldSample[]>([]);
  const [events, setEvents] = useState<QcEvent[]>([]);
  const [holeFilter, setHoleFilter] = useState<string>(drillholeId ?? ALL);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);

  const reload = useCallback(() => {
    getProject(projectId).then(setProject);
    listDrillholes(projectId).then(setHoles);
    listSamples(projectId).then(setSamples);
    listQcEvents(projectId).then(setEvents);
  }, [projectId]);

  useFocusEffect(reload);

  const holeName = useMemo(
    () => new Map(holes.map((h) => [h.id, h.holeId])),
    [holes],
  );

  const visible = useMemo(
    () =>
      filterSamples(samples, {
        drillholeId: holeFilter === ALL ? null : holeFilter,
        type: typeFilter === ALL ? null : (typeFilter as SampleType),
        status: statusFilter === ALL ? null : (statusFilter as SampleStatus),
      }),
    [samples, holeFilter, typeFilter, statusFilter],
  );

  const reminders = useMemo(
    () => (project ? qcReminders(events, project.qcInsertionRate) : []),
    [project, events],
  );
  const achievement = useMemo(
    () => (project ? qcAchievement(samples, project.qcInsertionRate) : []),
    [project, samples],
  );

  function openNew(extra = '') {
    const hole = holeFilter === ALL ? '' : `drillholeId=${holeFilter}`;
    const query = [hole, extra].filter(Boolean).join('&');
    router.push(`/projects/${projectId}/samples/new${query ? `?${query}` : ''}`);
  }

  async function handleDismiss(controlType: ControlType, reason: string) {
    await dismissQcReminder(projectId, controlType, reason);
    reload();
  }

  function confirmDelete(sample: FieldSample) {
    Alert.alert(
      `Delete ${sample.sampleNumber}?`,
      'The sample is removed, but its number stays reserved so it is never reused.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteSample(sample.id);
            if (result.outcome === 'has-duplicates') {
              Alert.alert(
                'Has a duplicate',
                'A field duplicate points at this sample. Delete the duplicate first.',
              );
              return;
            }
            reload();
          },
        },
      ],
    );
  }

  if (!project) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <PrimaryButton label="New sample" onPress={() => openNew()} />

        <QcReminders
          reminders={reminders}
          onInsert={(controlType) => openNew(`type=${controlType}`)}
          onDismiss={handleDismiss}
        />

        <View style={styles.summary}>
          <ThemedText type="smallBold">QC insertion rate</ThemedText>
          {achievement.map((a) => (
            <ThemedText
              key={a.controlType}
              type="small"
              themeColor="textSecondary">
              {capitalise(CONTROL_LABELS[a.controlType])}s: {a.count}
              {a.achievedEveryN != null
                ? ` (1 per ${a.achievedEveryN} samples`
                : ' (none yet'}
              {a.targetEveryN > 0 ? `, target 1 per ${a.targetEveryN})` : ')'}
            </ThemedText>
          ))}
        </View>

        <ChipSelect
          label="Hole"
          options={[ALL, ...holes.map((h) => h.id)]}
          value={holeFilter}
          onChange={setHoleFilter}
          formatOption={(id) => (id === ALL ? 'All holes' : (holeName.get(id) ?? id))}
        />
        <ChipSelect
          label="Type"
          options={[ALL, ...SAMPLE_TYPES]}
          value={typeFilter}
          onChange={setTypeFilter}
          formatOption={(t) => (t === ALL ? 'All types' : capitalise(t))}
        />
        <ChipSelect
          label="Status"
          options={[ALL, ...SAMPLE_STATUSES]}
          value={statusFilter}
          onChange={setStatusFilter}
          formatOption={(s) => (s === ALL ? 'All statuses' : capitalise(s))}
        />

        {visible.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="default">
              {samples.length === 0 ? 'No samples yet.' : 'No samples match.'}
            </ThemedText>
          </ThemedView>
        ) : (
          visible.map((sample) => (
            <ThemedView
              key={sample.id}
              type="backgroundElement"
              style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <ThemedText type="default">
                    {sample.sampleNumber} · {sample.type}
                    {sample.type !== 'primary' ? ' (QC)' : ''}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {describeSample(
                      sample,
                      holeName.get(sample.drillholeId) ?? '?',
                      samples,
                    )}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => confirmDelete(sample)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete sample ${sample.sampleNumber}`}
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
  summary: {
    gap: Spacing.one,
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
