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
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { CONTROL_LABELS, QcReminders } from '@/components/qc-reminders';
import { ThemedText } from '@/components/themed-text';
import { AlertRow } from '@/components/ui/alert-row';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { SyncBadge } from '@/components/sync-badge';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { listDrillholes } from '@/data/drillholesRepository';
import { getProject } from '@/data/projectsRepository';
import {
  dismissQcReminder,
  listQcEvents,
  listSamples,
} from '@/data/samplesRepository';
import { useGuideStep } from '@/guide/use-guide-step';
import type { GuideStep } from '@/guide/steps';
import { sampleStatusTone } from '@/utils/status';
import { useFocusReload } from '@/hooks/use-focus-reload';

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
  return parts.join(' · ');
}

/**
 * E6-3: the sample register — filter by hole, type and status, see the QC
 * insertion rate achieved against the target, and act on due QC reminders
 * (E6-2). Tap a sample to see where it has been.
 */
export default function SampleRegisterScreen() {
  const { projectId, drillholeId } = useLocalSearchParams<{
    projectId: string;
    drillholeId?: string;
  }>();
  const router = useRouter();
  const theme = useTheme();
  const addSampleGuide = useGuideStep('add-sample', projectId ?? null);
  const exportGuide = useGuideStep('export', projectId ?? null);
  const guidingBack: GuideStep | null =
    'step' in exportGuide ? (exportGuide.step ?? null) : null;
  // The guide's next tap is elsewhere: grey everything but the one it wants.
  const guiding = 'step' in addSampleGuide || guidingBack != null;

  const [project, setProject] = useState<Project | null>(null);
  const [holes, setHoles] = useState<FieldDrillhole[]>([]);
  const [samples, setSamples] = useState<FieldSample[]>([]);
  const [events, setEvents] = useState<QcEvent[]>([]);
  const [holeFilter, setHoleFilter] = useState<string>(drillholeId ?? ALL);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  // Selection mode: pick several samples, then act on them together (E7-1).
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const reload = useCallback(() => {
    getProject(projectId).then(setProject);
    listDrillholes(projectId).then(setHoles);
    listSamples(projectId).then(setSamples);
    listQcEvents(projectId).then(setEvents);
  }, [projectId]);

  useFocusReload(reload);

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

  function toggleSelected(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  function actOnSelected(path: string) {
    const ids = visible.filter((s) => selected.has(s.id)).map((s) => s.id);
    if (ids.length === 0) return;
    router.push(
      `/projects/${projectId}/${path}${path.includes('?') ? '&' : '?'}sampleIds=${ids.join(',')}` as Href,
    );
    stopSelecting();
  }

  function openNew(extra = '') {
    const hole = holeFilter === ALL ? '' : `drillholeId=${holeFilter}`;
    const query = [hole, extra].filter(Boolean).join('&');
    router.push(
      `/projects/${projectId}/samples/new${query ? `?${query}` : ''}`,
    );
  }

  async function handleDismiss(controlType: ControlType, reason: string) {
    await dismissQcReminder(projectId, controlType, reason);
    reload();
  }

  if (!project) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {guidingBack ? (
          <AlertRow
            tone="info"
            message={guidingBack.body}
            actionLabel="Back"
            onPress={() => router.back()}
          />
        ) : null}

        <PrimaryButton
          label="New sample"
          icon="plus"
          disabled={guidingBack != null}
          onPress={() => openNew()}
        />
        {samples.length > 0 ? (
          <PrimaryButton
            label={selecting ? 'Done selecting' : 'Select samples'}
            icon={selecting ? 'check' : 'checkbox-multiple-marked-outline'}
            variant="secondary"
            disabled={guiding}
            onPress={() => (selecting ? stopSelecting() : setSelecting(true))}
          />
        ) : null}

        <QcReminders
          reminders={reminders}
          onInsert={(controlType) => openNew(`type=${controlType}`)}
          onDismiss={handleDismiss}
        />

        <Card style={styles.summary}>
          <ThemedText type="smallBold">QC insertion rate</ThemedText>
          {achievement.map((a) => (
            <ThemedText
              key={a.controlType}
              type="small"
              themeColor="textSecondary"
            >
              {capitalise(CONTROL_LABELS[a.controlType])}s: {a.count}
              {a.achievedEveryN != null
                ? ` (1 per ${a.achievedEveryN} samples`
                : ' (none yet'}
              {a.targetEveryN > 0 ? `, target 1 per ${a.targetEveryN})` : ')'}
            </ThemedText>
          ))}
        </Card>

        <View style={styles.filters}>
          {holes.length > 1 ? (
            <FilterRow
              label="Hole"
              options={[ALL, ...holes.map((h) => h.id)]}
              value={holeFilter}
              onChange={setHoleFilter}
              disabled={guiding}
              format={(id) =>
                id === ALL ? 'All holes' : (holeName.get(id) ?? id)
              }
            />
          ) : null}
          <FilterRow
            label="Type"
            options={[ALL, ...SAMPLE_TYPES]}
            value={typeFilter}
            onChange={setTypeFilter}
            disabled={guiding}
            format={(t) => (t === ALL ? 'All types' : capitalise(t))}
          />
          <FilterRow
            label="Status"
            options={[ALL, ...SAMPLE_STATUSES]}
            value={statusFilter}
            onChange={setStatusFilter}
            disabled={guiding}
            format={(s) => (s === ALL ? 'All statuses' : capitalise(s))}
          />
        </View>

        {visible.length === 0 ? (
          <Card style={styles.empty}>
            <Icon name="flask-empty-outline" size={32} themeColor="accent" />
            <ThemedText type="heading">
              {samples.length === 0 ? 'No samples yet' : 'No samples match'}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary">
              {samples.length === 0
                ? 'Add a sample from a logged interval and it shows up here, with its full history.'
                : 'Try a different filter.'}
            </ThemedText>
          </Card>
        ) : (
          visible.map((sample) => (
            <Card
              key={sample.id}
              onPress={
                guiding
                  ? undefined
                  : () =>
                      selecting
                        ? toggleSelected(sample.id)
                        : router.push(
                            `/projects/${projectId}/samples/${sample.id}`,
                          )
              }
              style={guiding ? styles.disabled : undefined}
              accessibilityLabel={
                selecting
                  ? `${selected.has(sample.id) ? 'Deselect' : 'Select'} sample ${sample.sampleNumber}`
                  : `Open sample ${sample.sampleNumber}`
              }
            >
              <View style={styles.row}>
                {selecting ? (
                  <Icon
                    name={
                      selected.has(sample.id)
                        ? 'checkbox-marked'
                        : 'checkbox-blank-outline'
                    }
                    size={26}
                    themeColor={selected.has(sample.id) ? 'accent' : 'muted'}
                  />
                ) : null}
                <View style={styles.rowText}>
                  <View style={styles.numberRow}>
                    <ThemedText type="heading">
                      {sample.sampleNumber}
                    </ThemedText>
                    {sample.type !== 'primary' ? (
                      <StatusPill
                        label={`${capitalise(sample.type)} · QC`}
                        tone="warning"
                      />
                    ) : null}
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    {describeSample(
                      sample,
                      holeName.get(sample.drillholeId) ?? '?',
                      samples,
                    )}
                  </ThemedText>
                  <SyncBadge kind="sample" id={sample.id} />
                </View>
                <StatusPill
                  label={capitalise(sample.status)}
                  tone={sampleStatusTone(sample.status)}
                />
                {selecting ? null : (
                  <Icon name="chevron-right" size={24} themeColor="muted" />
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
      {selecting ? (
        <View
          style={[
            styles.bulkBar,
            { backgroundColor: theme.background, borderTopColor: theme.border },
          ]}
        >
          <View style={styles.bulkTop}>
            <ThemedText type="smallBold">{selected.size} selected</ThemedText>
            <Pressable
              onPress={() => setSelected(new Set(visible.map((s) => s.id)))}
              accessibilityRole="button"
              hitSlop={Spacing.two}
            >
              <ThemedText type="smallBold" themeColor="accent">
                Select all shown
              </ThemedText>
            </Pressable>
          </View>
          <View style={styles.bulkRow}>
            <View style={styles.bulkButton}>
              <PrimaryButton
                label="Bag"
                disabled={selected.size === 0}
                onPress={() => actOnSelected('custody/record?type=bagged')}
              />
            </View>
            <View style={styles.bulkButton}>
              <PrimaryButton
                label="Seal"
                variant="secondary"
                disabled={selected.size === 0}
                onPress={() => actOnSelected('custody/record?type=sealed')}
              />
            </View>
            <View style={styles.bulkButton}>
              <PrimaryButton
                label="Hand over"
                variant="secondary"
                disabled={selected.size === 0}
                onPress={() => actOnSelected('custody/record?type=handed_over')}
              />
            </View>
          </View>
          <PrimaryButton
            label="Put in a lab dispatch"
            icon="truck-delivery-outline"
            variant="secondary"
            disabled={selected.size === 0}
            onPress={() => actOnSelected('dispatches/new')}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** A labelled, sideways-scrolling row of filter chips. */
function FilterRow({
  label,
  options,
  value,
  onChange,
  format,
  disabled,
}: {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  format: (option: string) => string;
  disabled?: boolean;
}) {
  return (
    <View style={styles.filterRow}>
      <ThemedText type="caption" themeColor="textSecondary">
        {label.toUpperCase()}
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {options.map((option) => (
          <Chip
            key={option}
            label={format(option)}
            selected={option === value}
            disabled={disabled}
            onPress={() => onChange(option)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  summary: {
    gap: Spacing.one,
  },
  filters: {
    gap: Spacing.two + 2,
  },
  filterRow: {
    gap: Spacing.one + 2,
  },
  chips: {
    gap: Spacing.two,
    paddingRight: Spacing.three,
  },
  empty: {
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  rowText: {
    flex: 1,
    gap: Spacing.one,
  },
  bulkBar: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two + 4,
    paddingBottom: Spacing.two,
    borderTopWidth: 1,
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
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  disabled: {
    opacity: 0.4,
  },
});
