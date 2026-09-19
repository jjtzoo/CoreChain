import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { WarningList } from '@/components/form/warning-list';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * The bar pinned to the bottom of a form: any warnings that need a decision,
 * then the Save button. Pass it as `FormScrollView`'s `footer`, so the button
 * never scrolls out of reach and rides above the keyboard.
 */
export function StickyActions({
  warnings = [],
  children,
}: {
  warnings?: readonly string[];
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.background, borderTopColor: theme.border },
      ]}>
      <WarningList warnings={warnings} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two + 4,
    paddingBottom: Spacing.two,
    borderTopWidth: 1,
  },
});
