import { Modal, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SuccessDetail = { label: string; value: string };

export type SuccessMessage = {
  title: string;
  /** One line under the title, such as "3 samples". */
  summary?: string;
  details: SuccessDetail[];
};

/**
 * The confirmation after something important was saved: a check mark, what
 * happened, and the facts of it (when, who, to whom), so there is never a doubt
 * that it went in. It waits for a tap on Done, then the screen carries on.
 */
export function SuccessDialog({
  message,
  onDone,
}: {
  message: SuccessMessage | null;
  onDone: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal
      visible={message !== null}
      transparent
      animationType="fade"
      onRequestClose={onDone}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={[
            styles.dialog,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={[styles.badge, { backgroundColor: theme.successSoft }]}>
            <Icon name="check" size={36} themeColor="success" />
          </View>
          <View style={styles.heading}>
            <ThemedText type="subtitle" style={styles.centered}>
              {message?.title}
            </ThemedText>
            {message?.summary ? (
              <ThemedText
                type="default"
                themeColor="textSecondary"
                style={styles.centered}
              >
                {message.summary}
              </ThemedText>
            ) : null}
          </View>
          {message && message.details.length > 0 ? (
            <View style={[styles.details, { borderColor: theme.border }]}>
              {message.details.map((detail, index) => (
                <View
                  key={detail.label}
                  style={[
                    styles.row,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <ThemedText type="small" themeColor="textSecondary">
                    {detail.label}
                  </ThemedText>
                  <ThemedText type="smallBold" style={styles.value}>
                    {detail.value}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}
          <PrimaryButton label="Done" onPress={onDone} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(8, 12, 11, 0.7)',
  },
  dialog: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  heading: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  details: {
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
