import {
  copyIntervalCodes,
  nextIntervalDefaults,
  type LibraryCode,
  type LogInterval,
} from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CodePicker } from '@/components/form/code-picker';
import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { WarningList } from '@/components/form/warning-list';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { listCodes } from '@/data/codesRepository';
import {
  clearDraft,
  createInterval,
  listIntervals,
  loadDraft,
  saveDraft,
} from '@/data/intervalsRepository';
import { parseOptionalNumber, parseRequiredNumber } from '@/utils/numbers';

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

/**
 * E4-3: log an interval. "From" starts where the previous interval ended, the
 * pick-lists come from the project's code library (free text always allowed),
 * and every change is autosaved as a draft so killing the app loses nothing.
 * E4-5: "Copy previous interval" carries over every code except depths and
 * free text.
 */
export default function NewIntervalScreen() {
  const { projectId, drillholeId } = useLocalSearchParams<{
    projectId: string;
    drillholeId: string;
  }>();
  const router = useRouter();

  const [form, setForm] = useState<Form>(EMPTY_FORM);
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
    Promise.all([
      listCodes(projectId),
      listIntervals(drillholeId),
      loadDraft(drillholeId),
    ]).then(([loadedCodes, intervals, draft]) => {
      if (cancelled) {
        return;
      }
      setCodes(loadedCodes);
      setPrevious(intervals.length > 0 ? intervals[intervals.length - 1] : null);
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
  }, [projectId, drillholeId]);

  // Autosave: persist the draft shortly after the last keystroke.
  useEffect(() => {
    if (!loaded || saved.current) {
      return;
    }
    if (JSON.stringify(form) === initialSnapshot.current) {
      return;
    }
    const timer = setTimeout(() => {
      saveDraft(drillholeId, form);
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [form, loaded, drillholeId]);

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
      const result = await createInterval(
        drillholeId,
        {
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
        },
        { acceptWarnings: activeWarnings.length > 0 },
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
      if (result.outcome === 'needs-confirmation') {
        setPending({ snapshot, warnings: result.warnings });
        // The keyboard would otherwise cover the "Save anyway" button.
        Keyboard.dismiss();
        return;
      }

      saved.current = true;
      await clearDraft(drillholeId);
      router.back();
    } finally {
      setSaving(false);
    }
  }

  // Wait for the draft to load so `autoFocus` is decided with `restored` known
  // (it only applies on mount) — a restored entry shouldn't pop the keyboard.
  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <FormScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled">
        {restored ? (
          <ThemedText type="small" themeColor="textSecondary">
            Restored your unsaved entry.
          </ThemedText>
        ) : null}

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
          autoFocus={!restored}
        />

        <PrimaryButton
          label="Copy previous interval"
          variant="secondary"
          disabled={!previous}
          onPress={handleCopyPrevious}
        />

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

        <WarningList warnings={activeWarnings} />

        <PrimaryButton
          label={activeWarnings.length > 0 ? 'Save anyway' : 'Save interval'}
          onPress={handleSave}
          loading={saving}
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
  notes: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
