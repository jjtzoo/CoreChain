import { type CustodyError } from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormScrollView } from '@/components/form/form-scroll-view';
import { PrimaryButton } from '@/components/form/primary-button';
import { StickyActions } from '@/components/form/sticky-actions';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import {
  createDispatch,
  listDispatchableSamples,
  listDispatches,
  type DispatchMember,
} from '@/data/dispatchRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';

function describe(sample: DispatchMember): string {
  const parts = [sample.holeId];
  if (sample.fromM != null && sample.toM != null) {
    parts.push(`${sample.fromM}–${sample.toM} m`);
  }
  parts.push(sample.type.charAt(0).toUpperCase() + sample.type.slice(1));
  return parts.join(' · ');
}

/**
 * E7-2: group bagged samples into a dispatch for one laboratory. Samples picked
 * on the register arrive already ticked; only bagged samples that are in no
 * other open dispatch are offered.
 */
export default function NewDispatchScreen() {
  const { projectId, sampleIds } = useLocalSearchParams<{
    projectId: string;
    sampleIds?: string;
  }>();
  const router = useRouter();

  const [available, setAvailable] = useState<DispatchMember[] | null>(null);
  const [labs, setLabs] = useState<string[]>([]);
  const preselected = useMemo(
    () => new Set((sampleIds ?? '').split(',').filter(Boolean)),
    [sampleIds],
  );
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [laboratory, setLaboratory] = useState('');
  const [request, setRequest] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<CustodyError[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    (async () => {
      const [samples, dispatches] = await Promise.all([
        listDispatchableSamples(projectId),
        listDispatches(projectId),
      ]);
      setAvailable(samples);
      setLabs([...new Set(dispatches.map((d) => d.laboratory))].slice(0, 4));
      // Start with the register's selection, once, and only what can go.
      setChosen(
        (previous) =>
          previous ??
          new Set(
            samples.filter((s) => preselected.has(s.id)).map((s) => s.id),
          ),
      );
    })().catch(() => setAvailable([]));
  }, [projectId, preselected]);
  useFocusReload(load);

  const picked = chosen ?? new Set<string>();
  const skipped =
    available && preselected.size > 0
      ? [...preselected].filter((id) => !available.some((s) => s.id === id))
          .length
      : 0;

  function toggle(id: string) {
    setChosen((previous) => {
      const next = new Set(previous ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const errorFor = (field: string) =>
    errors.find((error) => error.field === field)?.message;

  async function save() {
    setSaving(true);
    try {
      const result = await createDispatch(projectId, {
        laboratory,
        preparationRequest: request,
        note,
        sampleIds: [...picked],
      });
      if (result.outcome === 'invalid') {
        setErrors(result.errors);
        return;
      }
      router.replace(`/projects/${projectId}/dispatches/${result.dispatchId}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <FormScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        footer={
          <StickyActions>
            <PrimaryButton
              label={
                picked.size > 0
                  ? `Create dispatch · ${picked.size} ${picked.size === 1 ? 'sample' : 'samples'}`
                  : 'Create dispatch'
              }
              loading={saving}
              onPress={() => void save()}
            />
          </StickyActions>
        }
      >
        <TextField
          label="Laboratory"
          value={laboratory}
          onChangeText={setLaboratory}
          autoCapitalize="words"
          error={errorFor('laboratory')}
        />
        {labs.length > 0 ? (
          <View style={styles.chips}>
            {labs.map((lab) => (
              <Chip
                key={lab}
                label={lab}
                selected={laboratory === lab}
                onPress={() => setLaboratory(lab)}
              />
            ))}
          </View>
        ) : null}
        <TextField
          label="Preparation request"
          optional
          value={request}
          onChangeText={setRequest}
          placeholder="For example: crush, split, pulverise"
        />
        <TextField
          label="Note"
          optional
          value={note}
          onChangeText={setNote}
          multiline
        />

        <View style={styles.section}>
          <ThemedText type="caption" themeColor="textSecondary">
            SAMPLES TO SEND
          </ThemedText>
          {skipped > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {skipped} of the samples you picked cannot go in a dispatch yet
              (not bagged, already dispatched, or in another open dispatch).
            </ThemedText>
          ) : null}
          {errorFor('samples') ? (
            <ThemedText type="small" themeColor="danger">
              {errorFor('samples')}
            </ThemedText>
          ) : null}
          {available && available.length === 0 ? (
            <Card style={styles.empty}>
              <ThemedText type="heading">No bagged samples</ThemedText>
              <ThemedText type="default" themeColor="textSecondary">
                A sample can be sent once it has been bagged. Bag samples from
                the register, then come back.
              </ThemedText>
            </Card>
          ) : (
            (available ?? []).map((sample) => {
              const on = picked.has(sample.id);
              return (
                <Card
                  key={sample.id}
                  onPress={() => toggle(sample.id)}
                  accessibilityLabel={`${on ? 'Remove' : 'Add'} sample ${sample.sampleNumber}`}
                >
                  <View style={styles.row}>
                    <Icon
                      name={on ? 'checkbox-marked' : 'checkbox-blank-outline'}
                      size={26}
                      themeColor={on ? 'accent' : 'muted'}
                    />
                    <View style={styles.rowText}>
                      <ThemedText type="smallBold">
                        {sample.sampleNumber}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {describe(sample)}
                      </ThemedText>
                    </View>
                  </View>
                </Card>
              );
            })
          )}
        </View>
      </FormScrollView>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two + 2,
    paddingTop: Spacing.two,
  },
  empty: {
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
});
