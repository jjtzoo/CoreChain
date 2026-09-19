import {
  nextRunDefaults,
  recoveryPercent,
  rqdPercent,
} from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { WarningList } from '@/components/form/warning-list';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { createRun, listRuns } from '@/data/coreRepository';
import { parseOptionalNumber, parseRequiredNumber } from '@/utils/numbers';

/**
 * E3-2 / E3-3: record a drilling run. "From" is pre-filled from the previous
 * run, and recovery % and RQD % are worked out live as the geologist types.
 * Recovery above 100%, overlaps and gaps are shown as warnings that need a
 * second tap ("Save anyway").
 */
export default function NewCoreRunScreen() {
  const { drillholeId } = useLocalSearchParams<{ drillholeId: string }>();
  const router = useRouter();

  const [fromM, setFromM] = useState('');
  const [toM, setToM] = useState('');
  const [recoveredM, setRecoveredM] = useState('');
  const [rqdPiecesM, setRqdPiecesM] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{
    snapshot: string;
    warnings: string[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listRuns(drillholeId).then((runs) => {
      setFromM(String(nextRunDefaults(runs).fromM));
    });
  }, [drillholeId]);

  const from = parseRequiredNumber(fromM);
  const to = parseRequiredNumber(toM);
  const recovered = parseRequiredNumber(recoveredM);
  const rqdPieces = parseOptionalNumber(rqdPiecesM);
  const drilled = to - from;
  const liveRecovery = recoveryPercent(drilled, recovered);
  const liveRqd = rqdPieces != null ? rqdPercent(drilled, rqdPieces) : null;

  const snapshot = JSON.stringify([fromM, toM, recoveredM, rqdPiecesM]);
  const activeWarnings = pending?.snapshot === snapshot ? pending.warnings : [];

  async function handleSave() {
    setErrors({});
    setSaving(true);
    try {
      const result = await createRun(
        drillholeId,
        { fromM: from, toM: to, recoveredM: recovered, rqdPiecesM: rqdPieces },
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
      <FormScrollView
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled">
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
          label="Recovered length (m)"
          value={recoveredM}
          onChangeText={setRecoveredM}
          error={errors.recoveredM}
          keyboardType="decimal-pad"
        />
        {liveRecovery != null && Number.isFinite(recovered) ? (
          <ThemedText type="small" themeColor="textSecondary">
            Recovery: {liveRecovery}%
          </ThemedText>
        ) : null}

        <TextField
          label="Pieces ≥ 10 cm, total length (m)"
          optional
          value={rqdPiecesM}
          onChangeText={setRqdPiecesM}
          error={errors.rqdPiecesM}
          keyboardType="decimal-pad"
        />
        {liveRqd != null ? (
          <ThemedText type="small" themeColor="textSecondary">
            RQD: {liveRqd}%
          </ThemedText>
        ) : null}

        <WarningList warnings={activeWarnings} />

        <PrimaryButton
          label={activeWarnings.length > 0 ? 'Save anyway' : 'Save run'}
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
});
