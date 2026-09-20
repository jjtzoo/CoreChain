import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_STATUS_LABELS,
  feedbackQueuedMessage,
  isFeedbackCategory,
  isFeedbackStatus,
  validateFeedback,
  type FeedbackCategory,
  type FeedbackErrors,
} from '@corechain/domain';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/auth/session-context';
import { ChipSelect } from '@/components/form/chip-select';
import { FormScrollView } from '@/components/form/form-scroll-view';
import { FormSection } from '@/components/form/form-section';
import { PrimaryButton } from '@/components/form/primary-button';
import { StickyActions } from '@/components/form/sticky-actions';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { AlertRow } from '@/components/ui/alert-row';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';
import { enqueueFeedback } from '@/data/feedbackRepository';
import {
  fetchMyFeedback,
  flushFeedback,
  type SentFeedback,
} from '@/feedback/sender';

/**
 * E10-2: send feedback. Tell us what it is, write a few lines; the app adds the
 * version, the phone, the screen you came from and your tier. The message is
 * saved on the phone first and sent when there is signal, so it is never lost.
 * Below the form: your recent messages and what we answered.
 */
export default function FeedbackScreen() {
  const router = useRouter();
  const { cookie } = useSession();
  const { from } = useLocalSearchParams<{ from?: string }>();

  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FeedbackErrors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [mine, setMine] = useState<SentFeedback[]>([]);

  useEffect(() => {
    if (!cookie) return;
    let cancelled = false;
    fetchMyFeedback(cookie).then((items) => {
      if (!cancelled) setMine(items.slice(0, 5));
    });
    return () => {
      cancelled = true;
    };
  }, [cookie, done]);

  const send = async () => {
    const problems = validateFeedback({ category: category ?? '', message });
    setErrors(problems);
    if (problems.category || problems.message || !category) return;

    setBusy(true);
    try {
      await enqueueFeedback({
        category,
        message,
        screen: from ?? null,
        appVersion: Constants.expoConfig?.version ?? null,
        device: Device.modelName ?? null,
      });
      const waiting = cookie ? await flushFeedback(cookie) : 1;
      setDone(
        waiting === 0
          ? 'Thank you. Your message was sent.'
          : feedbackQueuedMessage(),
      );
      setMessage('');
      setCategory(null);
    } catch {
      setErrors({ message: 'Could not save that. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormScrollView
      contentContainerStyle={styles.content}
      footer={
        <StickyActions>
          <PrimaryButton label="Send feedback" onPress={send} loading={busy} />
        </StickyActions>
      }
    >
      {done ? (
        <AlertRow tone="info" message={done} />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Tell us what worked, what got in your way, or what you wish the app
          did. It goes to the team that builds CoreChain.
        </ThemedText>
      )}

      <FormSection>
        <ChipSelect
          label="What is this about?"
          options={FEEDBACK_CATEGORIES}
          value={category}
          onChange={(value) => {
            setCategory(value);
            setErrors((previous) => ({ ...previous, category: undefined }));
          }}
          formatOption={(option) => FEEDBACK_CATEGORY_LABELS[option]}
        />
        {errors.category ? (
          <ThemedText type="small" themeColor="danger">
            {errors.category}
          </ThemedText>
        ) : null}

        <TextField
          label="Your message"
          value={message}
          onChangeText={setMessage}
          error={errors.message}
          multiline
          textAlignVertical="top"
          maxLength={FEEDBACK_MAX_LENGTH}
          placeholder="What happened, and where?"
          style={styles.message}
        />
        <ThemedText type="small" themeColor="textSecondary">
          We add the app version, your phone and the screen you came from.
        </ThemedText>
      </FormSection>

      {mine.length > 0 ? (
        <View style={styles.history}>
          <ThemedText type="caption" themeColor="textSecondary">
            YOUR RECENT MESSAGES
          </ThemedText>
          {mine.map((item) => (
            <Card key={item.id} style={styles.item}>
              <View style={styles.itemHead}>
                <ThemedText type="smallBold">
                  {isFeedbackCategory(item.category)
                    ? FEEDBACK_CATEGORY_LABELS[item.category]
                    : item.category}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {isFeedbackStatus(item.status)
                    ? FEEDBACK_STATUS_LABELS[item.status]
                    : item.status}
                </ThemedText>
              </View>
              <ThemedText type="small" numberOfLines={3}>
                {item.message}
              </ThemedText>
              {item.note ? (
                <ThemedText type="small" themeColor="accent">
                  {item.note}
                </ThemedText>
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}

      {done ? (
        <PrimaryButton
          label="Back"
          variant="secondary"
          onPress={() => router.back()}
        />
      ) : null}
    </FormScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  message: {
    minHeight: 140,
    paddingTop: Spacing.two,
  },
  history: {
    gap: Spacing.two,
  },
  item: {
    gap: Spacing.one,
  },
  itemHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
