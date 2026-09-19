import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      style={[
        styles.button,
        variant === 'primary' ? styles.primary : styles.secondary,
        isDisabled && styles.disabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#ffffff' : undefined} />
      ) : (
        <ThemedText
          type="smallBold"
          style={
            variant === 'primary' ? styles.primaryLabel : styles.secondaryLabel
          }>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.two,
  },
  primary: {
    backgroundColor: '#208AEF',
  },
  primaryLabel: {
    color: '#ffffff',
  },
  // Outlined, so a secondary action still reads as a button and not as text.
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#208AEF',
  },
  secondaryLabel: {
    color: '#208AEF',
  },
  disabled: {
    opacity: 0.5,
  },
});
