import type { ControlType, QcReminder } from '@corechain/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/form/primary-button';
import { TextField } from '@/components/form/text-field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const CONTROL_LABELS: Record<ControlType, string> = {
  standard: 'standard',
  blank: 'blank',
  duplicate: 'field duplicate',
};

/**
 * E6-2: reminders that a QC control is due, following the project's "every N
 * samples" rates. Each can be acted on ("Insert") or dismissed — but only with
 * a reason, which restarts that control's count. Pass no handlers for a
 * read-only hint.
 */
export function QcReminders({
  reminders,
  onInsert,
  onDismiss,
}: {
  reminders: readonly QcReminder[];
  onInsert?: (controlType: ControlType) => void;
  onDismiss?: (controlType: ControlType, reason: string) => Promise<void>;
}) {
  const theme = useTheme();
  const [dismissing, setDismissing] = useState<ControlType | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (reminders.length === 0) {
    return null;
  }

  async function confirmDismiss(controlType: ControlType) {
    if (reason.trim().length === 0) {
      setError('Say why, so the record shows it was a decision.');
      return;
    }
    await onDismiss?.(controlType, reason);
    setDismissing(null);
    setReason('');
    setError(null);
  }

  return (
    <View style={styles.list}>
      {reminders.map((reminder) => (
        <View
          key={reminder.controlType}
          style={[styles.box, { backgroundColor: theme.warningSoft }]}>
          <ThemedText type="smallBold" themeColor="warning">
            A {CONTROL_LABELS[reminder.controlType]} is due
          </ThemedText>
          <ThemedText type="small" themeColor="warning">
            {reminder.sinceLast} samples since the last one (target: every{' '}
            {reminder.everyN}).
          </ThemedText>

          {dismissing === reminder.controlType ? (
            <>
              <TextField
                label="Reason for dismissing"
                value={reason}
                onChangeText={setReason}
                error={error ?? undefined}
                placeholder="e.g. no standards left at the rig"
              />
              <PrimaryButton
                label="Confirm dismiss"
                onPress={() => confirmDismiss(reminder.controlType)}
              />
              <PrimaryButton
                label="Cancel"
                variant="secondary"
                onPress={() => {
                  setDismissing(null);
                  setReason('');
                  setError(null);
                }}
              />
            </>
          ) : (
            <>
              {onInsert ? (
                <PrimaryButton
                  label={`Insert ${CONTROL_LABELS[reminder.controlType]}`}
                  onPress={() => onInsert(reminder.controlType)}
                />
              ) : null}
              {onDismiss ? (
                <PrimaryButton
                  label="Dismiss…"
                  variant="secondary"
                  onPress={() => setDismissing(reminder.controlType)}
                />
              ) : null}
            </>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  box: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.card,
  },
});
