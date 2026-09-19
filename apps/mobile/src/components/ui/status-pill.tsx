import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

const TONE_COLORS: Record<Tone, { fg: ThemeColor; bg: ThemeColor }> = {
  accent: { fg: 'accent', bg: 'accentSoft' },
  success: { fg: 'success', bg: 'successSoft' },
  warning: { fg: 'warning', bg: 'warningSoft' },
  danger: { fg: 'danger', bg: 'dangerSoft' },
  neutral: { fg: 'textSecondary', bg: 'backgroundSelected' },
};

/** A small rounded label for a status, such as "Drilling" or "Bagged". */
export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const theme = useTheme();
  const colors = TONE_COLORS[tone];
  return (
    <View style={[styles.pill, { backgroundColor: theme[colors.bg] }]}>
      <ThemedText type="caption" themeColor={colors.fg}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one,
  },
});
