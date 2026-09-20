import { type CustodyError, type RecordableEventType } from '@corechain/domain';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import {
  DateTimeField,
  describeMoment,
} from '@/components/form/date-time-field';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { PrimaryButton } from '@/components/form/primary-button';
import { StickyActions } from '@/components/form/sticky-actions';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import {
  SuccessDialog,
  type SuccessMessage,
} from '@/components/ui/success-dialog';
import { Spacing } from '@/constants/theme';
import { recordCustodyEvent } from '@/data/custodyRepository';

const TITLES: Record<RecordableEventType, string> = {
  bagged: 'Bag samples',
  sealed: 'Seal samples',
  handed_over: 'Hand samples over',
};

const HEADINGS: Record<RecordableEventType, string> = {
  bagged: 'Bagging',
  sealed: 'Sealing',
  handed_over: 'Handing over',
};

const DONE_TITLES: Record<RecordableEventType, string> = {
  bagged: 'Bagging recorded',
  sealed: 'Sealing recorded',
  handed_over: 'Handover recorded',
};

const SAVE_LABELS: Record<RecordableEventType, string> = {
  bagged: 'Record bagging',
  sealed: 'Record sealing',
  handed_over: 'Record handover',
};

function isRecordable(value: string | undefined): value is RecordableEventType {
  return value === 'bagged' || value === 'sealed' || value === 'handed_over';
}

/**
 * E7-1: records one custody step (bagged, sealed, handed over) on one or many
 * samples at once. Samples that cannot take the step, such as one that is
 * already bagged, are skipped and listed afterwards, never half-recorded.
 */
export default function RecordCustodyScreen() {
  const { projectId, sampleIds, type } = useLocalSearchParams<{
    projectId: string;
    sampleIds: string;
    type: string;
  }>();
  const router = useRouter();
  const { user } = useSession();

  const eventType: RecordableEventType = isRecordable(type) ? type : 'bagged';
  const ids = useMemo(
    () => (sampleIds ?? '').split(',').filter(Boolean),
    [sampleIds],
  );

  // The moment the form opened, so the time is right without typing it.
  const [openedAt] = useState(() => new Date().toISOString());
  const [occurredAt, setOccurredAt] = useState(openedAt);
  const [handledBy, setHandledBy] = useState(user?.name || user?.email || '');
  const [location, setLocation] = useState('');
  const [recipient, setRecipient] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<CustodyError[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<SuccessMessage | null>(null);

  const errorFor = (field: string) =>
    errors.find((error) => error.field === field)?.message;

  async function save() {
    setSaving(true);
    try {
      const result = await recordCustodyEvent(projectId, ids, {
        type: eventType,
        occurredAt,
        handledBy,
        location,
        recipient,
        note,
      });
      if (result.outcome === 'invalid') {
        setErrors(result.errors);
        return;
      }
      if (result.skipped.length > 0) {
        const reasons = [...new Set(result.skipped.map((s) => s.reason))];
        Alert.alert(
          result.recorded === 0
            ? 'Nothing was recorded'
            : `Recorded on ${result.recorded}, skipped ${result.skipped.length}`,
          `${result.skipped.length} ${
            result.skipped.length === 1 ? 'sample was' : 'samples were'
          } skipped: ${reasons.join('; ').toLowerCase()}.`,
          [{ text: 'OK', onPress: () => router.back() }],
        );
        return;
      }
      const details = [
        { label: 'Date and time', value: describeMoment(occurredAt) },
        {
          label: eventType === 'handed_over' ? 'Handed over by' : 'Handled by',
          value: handledBy.trim(),
        },
        ...(recipient.trim()
          ? [{ label: 'Received by', value: recipient.trim() }]
          : []),
        ...(location.trim()
          ? [{ label: 'Location', value: location.trim() }]
          : []),
      ];
      setDone({
        title: DONE_TITLES[eventType],
        summary: `${result.recorded} ${result.recorded === 1 ? 'sample' : 'samples'}`,
        details,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <Stack.Screen options={{ title: TITLES[eventType] }} />
      <FormScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        footer={
          <StickyActions>
            <PrimaryButton
              label={SAVE_LABELS[eventType]}
              loading={saving}
              disabled={ids.length === 0}
              onPress={() => void save()}
            />
          </StickyActions>
        }
      >
        <View style={styles.summary}>
          <ThemedText type="heading">
            {HEADINGS[eventType]} {ids.length}{' '}
            {ids.length === 1 ? 'sample' : 'samples'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Each step is a permanent part of the custody record. If one is
            wrong, add a correction that says what was wrong.
          </ThemedText>
        </View>

        <DateTimeField
          label="Date and time"
          value={occurredAt}
          onChange={setOccurredAt}
          error={errorFor('occurredAt')}
        />
        <TextField
          label="Handled by"
          value={handledBy}
          onChangeText={setHandledBy}
          autoCapitalize="words"
          error={errorFor('handledBy')}
        />
        {eventType === 'handed_over' ? (
          <TextField
            label="Received by"
            value={recipient}
            onChangeText={setRecipient}
            autoCapitalize="words"
            placeholder="Courier, driver or laboratory staff"
            error={errorFor('recipient')}
          />
        ) : null}
        <TextField
          label="Location"
          optional
          value={location}
          onChangeText={setLocation}
          placeholder="Core shed, camp gate, laboratory reception"
        />
        <TextField
          label="Note"
          optional
          value={note}
          onChangeText={setNote}
          multiline
        />
      </FormScrollView>
      <SuccessDialog message={done} onDone={() => router.back()} />
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
    gap: Spacing.one + 2,
  },
});
