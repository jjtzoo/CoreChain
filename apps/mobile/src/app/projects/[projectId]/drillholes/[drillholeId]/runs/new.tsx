import {
  nextRunDefaults,
  recoveryPercent,
  rqdPercent,
} from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormRow, FormSection } from '@/components/form/form-section';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { LengthChips } from '@/components/form/length-chips';
import { useDepthLandmarks } from '@/hooks/use-depth-landmarks';
import { PrimaryButton } from '@/components/form/primary-button';
import { StickyActions } from '@/components/form/sticky-actions';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { Card } from '@/components/ui/card';
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
  const landmarks = useDepthLandmarks(drillholeId, fromM, 'run');
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

  const drilledKnown = Number.isFinite(drilled) && drilled > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FormScrollView
        contentContainerStyle={styles.form}
        footer={
          <StickyActions warnings={activeWarnings}>
            <PrimaryButton
              label={activeWarnings.length > 0 ? 'Save anyway' : 'Save run'}
              onPress={handleSave}
              loading={saving}
            />
          </StickyActions>
        }
      >
        <FormSection title="Depth drilled">
          <FormRow>
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
          </FormRow>
          <LengthChips
            fromText={fromM}
            lengths={[1.5, 3, 4.5, 6]}
            landmarks={landmarks}
            onPick={setToM}
          />
        </FormSection>

        <FormSection title="Core recovered">
          <TextField
            label="Recovered length (m)"
            value={recoveredM}
            onChangeText={setRecoveredM}
            error={errors.recoveredM}
            keyboardType="decimal-pad"
          />
          {drilledKnown ? (
            <View style={styles.chips}>
              <Chip
                label="Full recovery"
                selected={false}
                onPress={() =>
                  setRecoveredM(String(Math.round(drilled * 1000) / 1000))
                }
              />
            </View>
          ) : null}
          <TextField
            label="Pieces ≥ 10 cm, total length (m)"
            optional
            value={rqdPiecesM}
            onChangeText={setRqdPiecesM}
            error={errors.rqdPiecesM}
            keyboardType="decimal-pad"
          />
        </FormSection>

        <Card style={styles.results}>
          <View style={styles.result}>
            <ThemedText type="caption" themeColor="textSecondary">
              RECOVERY
            </ThemedText>
            <ThemedText type="heading">
              {liveRecovery != null && Number.isFinite(recovered)
                ? `${liveRecovery}%`
                : '–'}
            </ThemedText>
          </View>
          <View style={styles.result}>
            <ThemedText type="caption" themeColor="textSecondary">
              RQD
            </ThemedText>
            <ThemedText type="heading">
              {liveRqd != null ? `${liveRqd}%` : '–'}
            </ThemedText>
          </View>
        </Card>
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
  chips: {
    flexDirection: 'row',
  },
  results: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  result: {
    flex: 1,
    gap: Spacing.half,
  },
});
