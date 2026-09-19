import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Spacing } from '@/constants/theme';

/** A titled card that groups related fields on a form. */
export function FormSection({
  title,
  hint,
  children,
}: {
  title?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <Card style={styles.card}>
      {title ? (
        <View style={styles.heading}>
          <ThemedText type="smallBold">{title}</ThemedText>
          {hint ? (
            <ThemedText type="small" themeColor="textSecondary">
              {hint}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      {children}
    </Card>
  );
}

/** Puts two or three fields side by side, sharing the width equally. */
export function FormRow({ children }: { children: ReactNode }) {
  return (
    <View style={styles.row}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={styles.cell}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  heading: {
    gap: Spacing.half,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two + 4,
  },
  cell: {
    flex: 1,
  },
});
