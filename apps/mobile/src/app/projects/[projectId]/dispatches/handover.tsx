import { localDateToIso, type CustodyError } from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { DateTimeField } from '@/components/form/date-time-field';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { PrimaryButton } from '@/components/form/primary-button';
import { StickyActions } from '@/components/form/sticky-actions';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  getDispatch,
  handOverDispatch,
  listDispatchSamples,
} from '@/data/dispatchRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';

/**
 * E7-2: hands a dispatch over. Every sample in it gets a "dispatched" custody
 * step and the dispatch is closed, so this asks first: it cannot be edited
 * afterwards, only corrected with a note.
 */
export default function HandOverScreen() {
  const { dispatchId } = useLocalSearchParams<{ dispatchId: string }>();
  const router = useRouter();
  const { user } = useSession();

  const [laboratory, setLaboratory] = useState('');
  const [number, setNumber] = useState('');
  const [count, setCount] = useState(0);
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString());
  const [handledBy, setHandledBy] = useState(user?.name || user?.email || '');
  const [recipient, setRecipient] = useState('');
  const [errors, setErrors] = useState<CustodyError[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    (async () => {
      const dispatch = await getDispatch(dispatchId);
      if (!dispatch) return;
      setLaboratory(dispatch.laboratory);
      setNumber(dispatch.dispatchNumber);
      setCount((await listDispatchSamples(dispatchId)).length);
    })().catch(() => {});
  }, [dispatchId]);
  useFocusReload(load);

  const errorFor = (field: string) =>
    errors.find((error) => error.field === field)?.message;

  function confirm() {
    Alert.alert(
      `Hand over ${number}?`,
      `${count} ${count === 1 ? 'sample is' : 'samples are'} recorded as dispatched to ${
        recipient.trim() || laboratory
      }. This is added to their custody record and cannot be edited afterwards.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Hand over', onPress: () => void save() },
      ],
    );
  }

  async function save() {
    setSaving(true);
    try {
      const result = await handOverDispatch(dispatchId, {
        handledBy,
        recipient: recipient.trim() || null,
        handoverDay: localDateToIso(new Date(occurredAt)),
        occurredAt,
      });
      if (result.outcome === 'invalid') {
        setErrors(result.errors);
      } else if (result.outcome === 'not-open') {
        Alert.alert('Already handed over', 'This dispatch is closed.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(
          `${number} handed over`,
          `${count} ${count === 1 ? 'sample is' : 'samples are'} now recorded as dispatched to ${
            recipient.trim() || laboratory
          }.`,
          [{ text: 'OK', onPress: () => router.back() }],
        );
      }
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
              label={`Hand over ${count} ${count === 1 ? 'sample' : 'samples'}`}
              loading={saving}
              disabled={count === 0}
              onPress={confirm}
            />
          </StickyActions>
        }
      >
        <View style={styles.summary}>
          <ThemedText type="heading">
            {number} to {laboratory}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Every sample in the dispatch is recorded as dispatched, with the
            time, who handed it over and who took it.
          </ThemedText>
        </View>
        <DateTimeField
          label="Date and time"
          value={occurredAt}
          onChange={setOccurredAt}
          error={errorFor('occurredAt')}
        />
        <TextField
          label="Handed over by"
          value={handledBy}
          onChangeText={setHandledBy}
          autoCapitalize="words"
          error={errorFor('handledBy')}
        />
        <TextField
          label="Received by"
          optional
          value={recipient}
          onChangeText={setRecipient}
          autoCapitalize="words"
          placeholder={`Courier or person. If blank: ${laboratory}`}
        />
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
  summary: {
    gap: Spacing.one + 2,
  },
});
