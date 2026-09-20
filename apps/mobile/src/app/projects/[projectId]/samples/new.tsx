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
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipSelect } from '@/components/form/chip-select';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { FormRow, FormSection } from '@/components/form/form-section';
import { LengthChips } from '@/components/form/length-chips';
import { useDepthLandmarks } from '@/hooks/use-depth-landmarks';
import { PrimaryButton } from '@/components/form/primary-button';
import { StickyActions } from '@/components/form/sticky-actions';
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

/** Where the last primary sample in a hole ended, as text; '' when there is none. */
function endOfLastPrimary(samples: readonly FieldSample[]): string {
  let deepest = Number.NEGATIVE_INFINITY;
  for (const sample of samples) {
    if (sample.type === 'primary' && sample.toM != null) {
      deepest = Math.max(deepest, sample.toM);
    }
  }
  return Number.isFinite(deepest) ? String(deepest) : '';
}

/**
 * E6-1 / E6-2: create a sample. The number is pre-filled with the device's
 * next one; typing a different (pre-printed) tag leaves the counter alone.
 * The fields follow the type: depths for a primary (starting where the last
 * primary sample ended), a reference material ID for a standard, a parent
 * primary sample for a field duplicate.
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
  const landmarks = useDepthLandmarks(holeId, fromM, 'sample');
  const [toM, setToM] = useState(params.toM ?? '');
  const [standardRef, setStandardRef] = useState('');
  const [parentNumber, setParentNumber] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Once the geologist types a "from" depth (or one was passed in), it is theirs.
  // (A ref for the async load, a state for what the screen shows.)
  const fromIsTheirs = useRef(params.fromM != null);
  const [fromEdited, setFromEdited] = useState(params.fromM != null);

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
      listHoleSamples(holeId).then((loaded) => {
        setHoleSamples(loaded);
        if (!fromIsTheirs.current) {
          setFromM(endOfLastPrimary(loaded));
        }
      });
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
        footer={
          <StickyActions>
            <PrimaryButton label="Save sample" onPress={handleSave} loading={saving} />
          </StickyActions>
        }>
        <QcReminders reminders={reminders} />

        <FormSection title="Which sample">
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
        </FormSection>

        {type === 'primary' ? (
          <FormSection
            title="Depth sampled"
            hint={
              fromM !== '' && !fromEdited
                ? 'Starts where your last sample ended.'
                : undefined
            }>
            <FormRow>
              <TextField
                label="From depth (m)"
                value={fromM}
                onChangeText={(v) => {
                  fromIsTheirs.current = true;
                  setFromEdited(true);
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
            </FormRow>
            <LengthChips
              fromText={fromM}
              lengths={[0.5, 1, 2]}
              landmarks={landmarks}
              onPick={(v) => {
                setToM(v);
                clearErrors('fromM', 'toM');
              }}
            />
          </FormSection>
        ) : null}

        {type === 'standard' ? (
          <FormSection title="Certified standard">
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
          </FormSection>
        ) : null}

        {type === 'duplicate' ? (
          <FormSection title="Which sample is this a duplicate of?">
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
          </FormSection>
        ) : null}

        <FormSection>
          <TextField
            label="Note"
            optional
            value={note}
            onChangeText={setNote}
          />
        </FormSection>
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
