import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GuideStep } from '@/guide/steps';

/**
 * The first-run guide's coachmark: a bottom sheet over a dimmed backdrop,
 * matching the app's existing modal pattern (`success-dialog.tsx`) rather
 * than a spotlight/cutout highlight, which is fragile to place reliably in
 * React Native. Approved in the E10-1 mockup (Sprint 6).
 */
export function CoachmarkOverlay({
  step,
  stepNumber,
  totalSteps,
  onNext,
  nextLabel = 'Got it',
  onSkip,
}: {
  step: GuideStep;
  stepNumber: number;
  totalSteps: number;
  onNext: () => void;
  nextLabel?: string;
  onSkip: () => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.scrim}>
        <SafeAreaView edges={['bottom']}>
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              { backgroundColor: theme.backgroundElement },
            ]}
          >
            <View style={styles.steps}>
              {Array.from({ length: totalSteps }, (_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    { backgroundColor: theme.border },
                    index < stepNumber - 1 && { backgroundColor: theme.brand },
                    index === stepNumber - 1 && [
                      styles.dotActive,
                      { backgroundColor: theme.accent },
                    ],
                  ]}
                />
              ))}
            </View>
            <ThemedText type="caption" themeColor="brand">
              Step {stepNumber} of {totalSteps}
            </ThemedText>
            <ThemedText type="heading">{step.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {step.body}
            </ThemedText>
            <View style={styles.actions}>
              <Pressable
                onPress={onSkip}
                accessibilityRole="button"
                style={styles.skip}
              >
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Skip guide
                </ThemedText>
              </Pressable>
              <PrimaryButton label={nextLabel} onPress={onNext} />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(8, 12, 11, 0.55)',
  },
  sheet: {
    borderTopLeftRadius: Radius.card + 6,
    borderTopRightRadius: Radius.card + 6,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  steps: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
  },
  dotActive: {
    width: 16,
    borderRadius: 3,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  skip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
});
