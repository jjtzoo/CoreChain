import { CUSTODY_LABELS, type CustodyLine } from '@corechain/domain';
import { StyleSheet, View } from 'react-native';

import { describeMoment } from '@/components/form/date-time-field';
import { ThemedText } from '@/components/themed-text';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';

// A step saved in the last two minutes is tagged, so a save that lands at the
// bottom of a long record is never mistaken for one that did not take.
const JUST_NOW_MS = 2 * 60 * 1000;

/**
 * A sample's custody record, oldest first: what happened, when, who did it, and
 * where or to whom. A step that a later correction cancelled stays visible,
 * marked "Voided", so the record never hides a mistake.
 */
export function CustodyTimeline({
  lines,
  asOf,
  roster = {},
}: {
  lines: readonly CustodyLine[];
  /** When the record was loaded (ms), so "just recorded" needs no clock read while rendering. */
  asOf: number;
  /**
   * Cached account id -> name (data/rosterRepository.ts), for "Logged by" —
   * the account that entered the record on the phone, distinct from
   * `handledBy` (who physically had the sample). Left off entirely when the
   * id isn't cached yet, rather than showing a raw id.
   */
  roster?: Record<string, string>;
}) {
  if (lines.length === 0) {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        No custody steps recorded yet. Bag the sample to start its record.
      </ThemedText>
    );
  }
  return (
    <View style={styles.list}>
      {lines.map((line) => (
        <View key={line.id} style={styles.line}>
          <View style={styles.top}>
            <ThemedText
              type="smallBold"
              themeColor={line.voided ? 'textSecondary' : 'text'}
              style={[styles.title, line.voided && styles.struck]}
            >
              {CUSTODY_LABELS[line.type]}
            </ThemedText>
            {line.voided ? <StatusPill label="Voided" tone="warning" /> : null}
            {!line.voided && asOf - Date.parse(line.createdAt) < JUST_NOW_MS ? (
              <StatusPill label="Just recorded" tone="success" />
            ) : null}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {describeMoment(line.occurredAt)} · {line.handledBy}
          </ThemedText>
          {line.createdBy && roster[line.createdBy] ? (
            <ThemedText type="small" themeColor="textSecondary">
              Logged by {roster[line.createdBy]}
            </ThemedText>
          ) : null}
          {line.recipient ? (
            <ThemedText type="small" themeColor="textSecondary">
              To {line.recipient}
            </ThemedText>
          ) : null}
          {line.location ? (
            <ThemedText type="small" themeColor="textSecondary">
              At {line.location}
            </ThemedText>
          ) : null}
          {line.note ? <ThemedText type="small">{line.note}</ThemedText> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  line: {
    gap: Spacing.half,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flexShrink: 1,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
});
