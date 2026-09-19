import {
  qcReminders,
  SAMPLE_TYPES,
  type FieldDrillhole,
  type FieldSample,
  type Project,
  type QcEvent,
  type SampleType,
} from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipSelect } from '@/components/form/chip-select';
import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { QcReminders } from '@/components/qc-reminders';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { listDrillholes } from '@/data/drillholesRepository';
import { getProject } from '@/data/projectsRepository';
import {
  createSample,
  listHoleSamples,
  listQcEvents,
  suggestNextSampleNumber,
} from '@/data/samplesRepository';
import { parseOptionalNumber } from '@/utils/numbers';

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function isSampleType(value: string | undefined): value is SampleType {
  return SAMPLE_TYPES.some((t) => t === value);
}

/**
 * E6-1 / E6-2: create a sample. The number is pre-filled with the device's
 * next one; typing a different (pre-printed) tag leaves the counter alone.
 * The fields follow the type: depths for a primary, a reference material ID
 * for a standard, a parent primary sample for a field duplicate.
 */
export default function NewSampleScreen() {
  const params = useLocalSearchParams<{
    projectId: string;
    drillholeId?: string;
    fromM?: string;
    toM?: string;
    type?: string;
  }>();
  const { projectId } = params;
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [holes, setHoles] = useState<FieldDrillhole[]>([]);
  const [events, setEvents] = useState<QcEvent[]>([]);
  const [holeSamples, setHoleSamples] = useState<FieldSample[]>([]);
  const [suggested, setSuggested] = useState('');

  const [holeId, setHoleId] = useState<string | null>(params.drillholeId ?? null);
  const [type, setType] = useState<SampleType>(
    isSampleType(params.type) ? params.type : 'primary',
  );
  const [sampleNumber, setSampleNumber] = useState('');
  const [fromM, setFromM] = useState(params.fromM ?? '');
  const [toM, setToM] = useState(params.toM ?? '');
  const [standardRef, setStandardRef] = useState('');
  const [parentNumber, setParentNumber] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // A field's error goes away as soon as the geologist changes it.
  function clearErrors(...keys: string[]) {
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of keys) {
        delete next[key];
      }
      return next;
    });
  }

  useEffect(() => {
    getProject(projectId).then(setProject);
    listQcEvents(projectId).then(setEvents);
    suggestNextSampleNumber(projectId).then((next) => {
      setSuggested(next ?? '');
      setSampleNumber(next ?? '');
    });
    listDrillholes(projectId).then((loaded) => {
      setHoles(loaded);
      setHoleId((current) => current ?? loaded[0]?.id ?? null);
    });
  }, [projectId]);

  useEffect(() => {
    // A previously chosen parent from another hole simply stops matching (sample
    // numbers are unique per project), so there's nothing to reset here.
    if (holeId) {
      listHoleSamples(holeId).then(setHoleSamples);
    }
  }, [holeId]);

  const holeName = useMemo(
    () => new Map(holes.map((h) => [h.id, h.holeId])),
    [holes],
  );
  const primaries = holeSamples.filter((s) => s.type === 'primary');
  const parent = primaries.find((s) => s.sampleNumber === parentNumber);
  const reminders = useMemo(
    () => (project ? qcReminders(events, project.qcInsertionRate) : []),
    [project, events],
  );

  async function handleSave() {
    if (!holeId) {
      setErrors({ hole: 'Create a drillhole first.' });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const result = await createSample(
        projectId,
        holeId,
        {
          sampleNumber,
          type,
          fromM: parseOptionalNumber(fromM),
          toM: parseOptionalNumber(toM),
          standardRef,
          parentSampleId: parent?.id ?? null,
          note,
        },
        { usedSuggestedNumber: sampleNumber.trim() === suggested },
      );

      if (result.outcome === 'invalid') {
        const fieldErrors: Record<string, string> = {};
        if (!result.result.valid) {
          for (const e of result.result.errors) {
            fieldErrors[e.field] = e.message;
          }
        }
        setErrors(fieldErrors);
        return;
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (holes.length === 0 && project) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <FormScrollView contentContainerStyle={styles.form}>
          <ThemedText type="default">
            Create a drillhole before taking samples.
          </ThemedText>
        </FormScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FormScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled">
        <QcReminders reminders={reminders} />

        <ChipSelect
          label="Hole"
          options={holes.map((h) => h.id)}
          value={holeId}
          onChange={(id) => {
            setHoleId(id);
            setErrors({});
          }}
          formatOption={(id) => holeName.get(id) ?? id}
        />
        {errors.hole ? (
          <ThemedText type="small" themeColor="danger">
            {errors.hole}
          </ThemedText>
        ) : null}

        <ChipSelect
          label="Type"
          options={SAMPLE_TYPES}
          value={type}
          onChange={(t) => {
            setType(t);
            setErrors({});
          }}
          formatOption={capitalise}
        />

        <TextField
          label="Sample number"
          value={sampleNumber}
          onChangeText={(v) => {
            setSampleNumber(v);
            clearErrors('sampleNumber');
          }}
          error={errors.sampleNumber}
          autoCapitalize="characters"
        />
        <ThemedText type="small" themeColor="textSecondary">
          {sampleNumber.trim() === suggested
            ? 'The device’s next number. Type a different one to use a pre-printed tag.'
            : 'Using a typed tag number. The device’s own count is left alone.'}
        </ThemedText>

        {type === 'primary' ? (
          <>
            <TextField
              label="From depth (m)"
              value={fromM}
              onChangeText={(v) => {
                setFromM(v);
                clearErrors('fromM', 'toM');
              }}
              error={errors.fromM}
              keyboardType="decimal-pad"
            />
            <TextField
              label="To depth (m)"
              value={toM}
              onChangeText={(v) => {
                setToM(v);
                clearErrors('fromM', 'toM');
              }}
              error={errors.toM}
              keyboardType="decimal-pad"
            />
          </>
        ) : null}

        {type === 'standard' ? (
          <TextField
            label="Reference material ID"
            value={standardRef}
            onChangeText={(v) => {
              setStandardRef(v);
              clearErrors('standardRef');
            }}
            error={errors.standardRef}
            placeholder="e.g. OREAS 45e"
          />
        ) : null}

        {type === 'duplicate' ? (
          <>
            {primaries.length > 0 ? (
              <ChipSelect
                label="Duplicate of"
                options={primaries.map((s) => s.sampleNumber)}
                value={parentNumber}
                onChange={(n) => {
                  setParentNumber(n);
                  clearErrors('parentSampleId');
                }}
              />
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                This hole has no primary sample to duplicate yet.
              </ThemedText>
            )}
            {errors.parentSampleId ? (
              <ThemedText type="small" themeColor="danger">
                {errors.parentSampleId}
              </ThemedText>
            ) : null}
            {parent ? (
              <ThemedText type="small" themeColor="textSecondary">
                Takes its parent’s depth: {parent.fromM}–{parent.toM} m.
              </ThemedText>
            ) : null}
          </>
        ) : null}

        <TextField
          label="Note"
          optional
          value={note}
          onChangeText={setNote}
        />

        <PrimaryButton label="Save sample" onPress={handleSave} loading={saving} />
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
