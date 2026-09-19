import { nextBoxDefaults } from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { WarningList } from '@/components/form/warning-list';
import { Spacing } from '@/constants/theme';
import { createBox, listBoxes } from '@/data/coreRepository';
import { parseRequiredNumber } from '@/utils/numbers';

/**
 * E3-1: register a core box. Box number and "from" depth are pre-filled from
 * the previous box. Overlaps and gaps are shown as warnings and need a second
 * tap ("Save anyway") — they don't block saving.
 */
export default function NewCoreBoxScreen() {
  const { drillholeId } = useLocalSearchParams<{ drillholeId: string }>();
  const router = useRouter();

  const [boxNumber, setBoxNumber] = useState('');
  const [fromM, setFromM] = useState('');
  const [toM, setToM] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{
    snapshot: string;
    warnings: string[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listBoxes(drillholeId).then((boxes) => {
      const defaults = nextBoxDefaults(boxes);
      setBoxNumber(String(defaults.boxNumber));
      setFromM(String(defaults.fromM));
    });
  }, [drillholeId]);

  // Warnings only apply to the exact values they were raised for.
  const snapshot = JSON.stringify([boxNumber, fromM, toM]);
  const activeWarnings = pending?.snapshot === snapshot ? pending.warnings : [];

  async function handleSave() {
    setErrors({});
    setSaving(true);
    try {
      const result = await createBox(
        drillholeId,
        {
          boxNumber: parseRequiredNumber(boxNumber),
          fromM: parseRequiredNumber(fromM),
          toM: parseRequiredNumber(toM),
          note,
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
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled">
        <TextField
          label="Box number"
          value={boxNumber}
          onChangeText={setBoxNumber}
          error={errors.boxNumber}
          keyboardType="number-pad"
        />
        <TextField
          label="From depth (m)"
          value={fromM}
          onChangeText={setFromM}
          error={errors.fromM}
          keyboardType="decimal-pad"
        />
        <TextField
          label="To depth (m)"
          value={toM}
          onChangeText={setToM}
          error={errors.toM}
          keyboardType="decimal-pad"
          autoFocus
        />
        <TextField
          label="Note"
          optional
          value={note}
          onChangeText={setNote}
          placeholder="e.g. broken core, wet"
        />

        <WarningList warnings={activeWarnings} />

        <PrimaryButton
          label={activeWarnings.length > 0 ? 'Save anyway' : 'Save box'}
          onPress={handleSave}
          loading={saving}
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
