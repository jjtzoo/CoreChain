import { type CustodyError } from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { PrimaryButton } from '@/components/form/primary-button';
import { StickyActions } from '@/components/form/sticky-actions';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { correctCustodyEvent } from '@/data/custodyRepository';

/**
 * E7-1: corrects the latest custody step. The step is not edited or removed: a
 * correction is added that says who found the mistake and what was wrong, and
 * the step stays on the record marked as voided.
 */
export default function CorrectCustodyScreen() {
  const { eventId, label } = useLocalSearchParams<{
    eventId: string;
    label?: string;
  }>();
  const router = useRouter();
  const { user } = useSession();

  const [handledBy, setHandledBy] = useState(user?.name || user?.email || '');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<CustodyError[]>([]);
  const [saving, setSaving] = useState(false);

  const errorFor = (field: string) =>
    errors.find((error) => error.field === field)?.message;

  async function save() {
    setSaving(true);
    try {
      const result = await correctCustodyEvent(eventId, { note, handledBy });
      if (result.outcome === 'invalid') {
        setErrors(result.errors);
      } else if (result.outcome === 'not-allowed') {
        Alert.alert('Cannot correct this step', result.reason, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        router.back();
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
              label="Record correction"
              loading={saving}
              onPress={() => void save()}
            />
          </StickyActions>
        }
      >
        <View style={styles.summary}>
          <ThemedText type="heading">
            Correct {label ? label.toLowerCase() : 'this step'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            The step stays on the record, marked as voided, with your reason
            beside it.
          </ThemedText>
        </View>
        <TextField
          label="What was wrong"
          value={note}
          onChangeText={setNote}
          multiline
          error={errorFor('note')}
        />
        <TextField
          label="Who is correcting it"
          value={handledBy}
          onChangeText={setHandledBy}
          autoCapitalize="words"
          error={errorFor('handledBy')}
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
