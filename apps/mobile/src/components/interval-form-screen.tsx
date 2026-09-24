import {
  copyIntervalCodes,
  nextIntervalDefaults,
  type LibraryCode,
  type LogInterval,
} from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CodePicker } from '@/components/form/code-picker';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { FormRow, FormSection } from '@/components/form/form-section';
import { LengthChips } from '@/components/form/length-chips';
import { useDepthLandmarks } from '@/hooks/use-depth-landmarks';
import { PrimaryButton } from '@/components/form/primary-button';
import { StickyActions } from '@/components/form/sticky-actions';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { listCodes } from '@/data/codesRepository';
import { reconcileDrillholeStatus } from '@/data/drillholeStatus';
import {
  clearDraft,
  createInterval,
  getInterval,
  listIntervals,
  loadDraft,
  saveDraft,
  updateInterval,
} from '@/data/intervalsRepository';
import { useGuideStep } from '@/guide/use-guide-step';
import { parseOptionalNumber, parseRequiredNumber } from '@/utils/numbers';
import { ScreenLoader } from '@/components/screen-loader';

type Form = {
  fromM: string;
  toM: string;
  lithology: string;
  alterationType: string;
  alterationIntensity: string;
  mineral: string;
  mineralStyle: string;
  mineralPercent: string;
  weathering: string;
  structureType: string;
  notes: string;
};

const EMPTY_FORM: Form = {
  fromM: '',
  toM: '',
  lithology: '',
  alterationType: '',
  alterationIntensity: '',
  mineral: '',
  mineralStyle: '',
  mineralPercent: '',
  weathering: '',
  structureType: '',
  notes: '',
};

const AUTOSAVE_DELAY_MS = 500;

function toForm(interval: LogInterval): Form {
  const text = (value: string | null) => value ?? '';
  return {
    fromM: String(interval.fromM),
    toM: String(interval.toM),
    lithology: text(interval.lithology),
    alterationType: text(interval.alterationType),
    alterationIntensity: text(interval.alterationIntensity),
    mineral: text(interval.mineral),
    mineralStyle: text(interval.mineralStyle),
    mineralPercent:
      interval.mineralPercent != null ? String(interval.mineralPercent) : '',
    weathering: text(interval.weathering),
    structureType: text(interval.structureType),
    notes: text(interval.notes),
  };
}

/**
 * E4-3: log an interval. "From" starts where the previous interval ended, the
 * pick-lists come from the project's code library (free text always allowed),
 * and every change is autosaved as a draft so killing the app loses nothing.
 * E4-5: "Copy previous interval" carries over every code except depths and
 * free text.
 *
 * With `intervalId`, the same form corrects an interval already logged (a
 * typo, a wrong depth), as the first geologist tester asked. Editing keeps no
 * draft: leaving without saving leaves the interval as it was.
 */
export function IntervalFormScreen({ intervalId }: { intervalId?: string }) {
  const editing = intervalId != null;
  const { projectId, drillholeId } = useLocalSearchParams<{
    projectId: string;
    drillholeId: string;
  }>();
  const router = useRouter();
  const guide = useGuideStep('log-interval', projectId ?? null);

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const landmarks = useDepthLandmarks(drillholeId, form.fromM, 'interval');
  const [codes, setCodes] = useState<LibraryCode[]>([]);
  const [previous, setPrevious] = useState<LogInterval | null>(null);
  const [restored, setRestored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{
    snapshot: string;
    warnings: string[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const saved = useRef(false);
  // What the form looked like when it loaded: an untouched form isn't worth a
  // draft (it would come back later as a stale "restored" entry).
  const initialSnapshot = useRef('');

  useEffect(() => {
    let cancelled = false;
    if (intervalId) {
      Promise.all([listCodes(projectId), getInterval(intervalId)]).then(
        ([loadedCodes, interval]) => {
          // Removed since the list was opened: the loader offers "Go back".
          if (cancelled || !interval) {
            return;
          }
          setCodes(loadedCodes);
          const initialForm = toForm(interval);
          initialSnapshot.current = JSON.stringify(initialForm);
          setForm(initialForm);
          setLoaded(true);
        },
      );
      return () => {
        cancelled = true;
      };
    }
    Promise.all([
      listCodes(projectId),
      listIntervals(drillholeId),
      loadDraft(drillholeId),
    ]).then(([loadedCodes, intervals, draft]) => {
      if (cancelled) {
        return;
      }
      setCodes(loadedCodes);
      setPrevious(
        intervals.length > 0 ? intervals[intervals.length - 1] : null,
      );
      const initialForm: Form = draft
        ? { ...EMPTY_FORM, ...draft }
        : {
            ...EMPTY_FORM,
            fromM: String(nextIntervalDefaults(intervals).fromM),
          };
      initialSnapshot.current = JSON.stringify(initialForm);
      setForm(initialForm);
      setRestored(draft != null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, drillholeId, intervalId]);

  // Autosave: persist the draft shortly after the last keystroke.
  useEffect(() => {
    if (!loaded || saved.current || editing) {
      return;
    }
    if (JSON.stringify(form) === initialSnapshot.current) {
      return;
    }
    const timer = setTimeout(() => {
      saveDraft(drillholeId, form);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [form, loaded, drillholeId, editing]);

  function update<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleCopyPrevious() {
    if (!previous) {
      return;
    }
    const c = copyIntervalCodes(previous);
    setForm((prev) => ({
      ...prev,
      lithology: c.lithology ?? '',
      alterationType: c.alterationType ?? '',
      alterationIntensity: c.alterationIntensity ?? '',
      mineral: c.mineral ?? '',
      mineralStyle: c.mineralStyle ?? '',
      mineralPercent: c.mineralPercent != null ? String(c.mineralPercent) : '',
      weathering: c.weathering ?? '',
      structureType: c.structureType ?? '',
    }));
  }

  // Warnings only apply to the depths they were raised for.
  const snapshot = JSON.stringify([form.fromM, form.toM]);
  const activeWarnings = pending?.snapshot === snapshot ? pending.warnings : [];

  async function handleSave() {
    setErrors({});
    setSaving(true);
    try {
      const input = {
        fromM: parseRequiredNumber(form.fromM),
        toM: parseRequiredNumber(form.toM),
        lithology: form.lithology,
        alterationType: form.alterationType,
        alterationIntensity: form.alterationIntensity,
        mineral: form.mineral,
        mineralStyle: form.mineralStyle,
        mineralPercent: parseOptionalNumber(form.mineralPercent),
        weathering: form.weathering,
        structureType: form.structureType,
        notes: form.notes,
      };
      const options = { acceptWarnings: activeWarnings.length > 0 };
      const result = intervalId
        ? await updateInterval(intervalId, input, options)
        : await createInterval(drillholeId, input, options);

      if (result.outcome === 'missing') {
        Alert.alert(
          'This interval no longer exists',
          'It was deleted, on this phone or by a change that synced in. Nothing was saved.',
        );
        router.back();
        return;
      }

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
      if (result.outcome === 'needs-confirmation') {
        setPending({ snapshot, warnings: result.warnings });
        // The keyboard would otherwise cover the "Save anyway" button.
        Keyboard.dismiss();
        return;
      }

      saved.current = true;
      await reconcileDrillholeStatus(drillholeId);
      if (!editing) {
        await clearDraft(drillholeId);
        if ('step' in guide) await guide.advance();
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  // Wait for the draft to load so `autoFocus` is decided with `restored` known
  // (it only applies on mount) — a restored entry shouldn't pop the keyboard.
  if (!loaded) {
    return <ScreenLoader />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FormScrollView
        contentContainerStyle={styles.form}
        footer={
          <StickyActions warnings={activeWarnings}>
            <PrimaryButton
              label={
                activeWarnings.length > 0
                  ? 'Save anyway'
                  : editing
                    ? 'Save changes'
                    : 'Save interval'
              }
              onPress={handleSave}
              loading={saving}
            />
          </StickyActions>
        }
      >
        {restored ? (
          <ThemedText type="small" themeColor="textSecondary">
            Restored your unsaved entry.
          </ThemedText>
        ) : null}

        <FormSection title="Depth">
          <FormRow>
            <TextField
              label="From depth (m)"
              value={form.fromM}
              onChangeText={(v) => update('fromM', v)}
              error={errors.fromM}
              keyboardType="decimal-pad"
            />
            <TextField
              label="To depth (m)"
              value={form.toM}
              onChangeText={(v) => update('toM', v)}
              error={errors.toM}
              keyboardType="decimal-pad"
              autoFocus={!restored && !editing}
            />
          </FormRow>
          <LengthChips
            fromText={form.fromM}
            lengths={[1, 2, 3, 4]}
            landmarks={landmarks}
            onPick={(v) => update('toM', v)}
          />
          {editing ? null : (
            <PrimaryButton
              label="Copy previous interval"
              variant="secondary"
              icon="content-copy"
              disabled={!previous}
              onPress={handleCopyPrevious}
            />
          )}
        </FormSection>

        <FormSection title="Rock and alteration">
          <CodePicker
            category="lithology"
            codes={codes}
            value={form.lithology}
            onChange={(v) => update('lithology', v)}
          />
          <CodePicker
            category="alteration_type"
            codes={codes}
            value={form.alterationType}
            onChange={(v) => update('alterationType', v)}
          />
          <CodePicker
            category="alteration_intensity"
            codes={codes}
            value={form.alterationIntensity}
            onChange={(v) => update('alterationIntensity', v)}
          />
        </FormSection>

        <FormSection title="Mineralisation">
          <CodePicker
            category="mineral"
            codes={codes}
            value={form.mineral}
            onChange={(v) => update('mineral', v)}
          />
          <CodePicker
            category="mineral_style"
            codes={codes}
            value={form.mineralStyle}
            onChange={(v) => update('mineralStyle', v)}
          />
          <TextField
            label="Mineral content (%)"
            optional
            value={form.mineralPercent}
            onChangeText={(v) => update('mineralPercent', v)}
            error={errors.mineralPercent}
            keyboardType="decimal-pad"
          />
        </FormSection>

        <FormSection title="Weathering and structure">
          <CodePicker
            category="weathering"
            codes={codes}
            value={form.weathering}
            onChange={(v) => update('weathering', v)}
          />
          <CodePicker
            category="structure_type"
            codes={codes}
            value={form.structureType}
            onChange={(v) => update('structureType', v)}
          />
          <TextField
            label="Structure notes and comments"
            optional
            value={form.notes}
            onChangeText={(v) => update('notes', v)}
            multiline
            style={styles.notes}
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
  notes: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
