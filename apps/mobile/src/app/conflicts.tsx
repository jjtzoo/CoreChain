import {
  conflictFields,
  conflictValueText,
  type ConflictField,
  type ConflictSide,
} from '@corechain/domain';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Radius, Spacing } from '@/constants/theme';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { useTheme } from '@/hooks/use-theme';
import {
  describeRecord,
  listConflicts,
  resolveConflict,
  type SyncIssue,
} from '@/sync/issues';
import { ScreenLoader } from '@/components/screen-loader';

type Entry = { issue: SyncIssue; name: string; fields: ConflictField[] };
type Choices = Record<string, Record<string, ConflictSide>>;

/**
 * E8-5: two phones changed one record at the same time. The server kept one
 * version and this phone kept the other. Each differing field is shown side by
 * side and the geologist picks which to keep, so nothing is lost silently.
 */
export default function ConflictsScreen() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [choices, setChoices] = useState<Choices>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(() => {
    void (async () => {
      const issues = await listConflicts();
      setEntries(
        await Promise.all(
          issues.map(async (issue) => ({
            issue,
            name: await describeRecord(issue),
            fields: conflictFields(issue.mine ?? {}, issue.theirs ?? {}),
          })),
        ),
      );
    })();
  }, []);
  useFocusReload(load);

  function choose(issueId: string, field: string, side: ConflictSide) {
    setChoices((all) => ({
      ...all,
      [issueId]: { ...all[issueId], [field]: side },
    }));
  }

  function chooseAll(entry: Entry, side: ConflictSide) {
    setChoices((all) => ({
      ...all,
      [entry.issue.id]: Object.fromEntries(
        entry.fields.map((f) => [f.field, side]),
      ),
    }));
  }

  async function save(entry: Entry) {
    setSaving(entry.issue.id);
    try {
      await resolveConflict(entry.issue, choices[entry.issue.id] ?? {});
      load();
    } finally {
      setSaving(null);
    }
  }

  if (entries === null) return <ScreenLoader />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {entries.length === 0 ? (
          <Card>
            <ThemedText type="heading">Nothing to review</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              When the same record is changed on two phones at the same time,
              both versions appear here so you can choose what to keep.
            </ThemedText>
          </Card>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            These records were changed on another phone at the same time as
            here. For each difference, choose the version to keep. The
            server&apos;s version is chosen until you change it.
          </ThemedText>
        )}

        {entries.map((entry) => {
          const mine = choices[entry.issue.id] ?? {};
          return (
            <Card key={entry.issue.id} style={styles.card}>
              <ThemedText type="heading">
                {entry.name.charAt(0).toUpperCase() + entry.name.slice(1)}
              </ThemedText>

              {entry.fields.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Both versions have the same content, so there is nothing to
                  choose.
                </ThemedText>
              ) : (
                <>
                  <View style={styles.quick}>
                    <Chip
                      label="Use all mine"
                      selected={entry.fields.every(
                        (f) => mine[f.field] === 'mine',
                      )}
                      onPress={() => chooseAll(entry, 'mine')}
                    />
                    <Chip
                      label="Use all the server's"
                      selected={entry.fields.every(
                        (f) => (mine[f.field] ?? 'theirs') === 'theirs',
                      )}
                      onPress={() => chooseAll(entry, 'theirs')}
                    />
                  </View>
                  {entry.fields.map((f) => (
                    <View key={f.field} style={styles.field}>
                      <ThemedText type="smallBold">{f.label}</ThemedText>
                      <Option
                        title="Mine (this phone)"
                        value={conflictValueText(f.mine)}
                        selected={mine[f.field] === 'mine'}
                        onPress={() => choose(entry.issue.id, f.field, 'mine')}
                      />
                      <Option
                        title="On the server"
                        value={conflictValueText(f.theirs)}
                        selected={(mine[f.field] ?? 'theirs') === 'theirs'}
                        onPress={() =>
                          choose(entry.issue.id, f.field, 'theirs')
                        }
                      />
                    </View>
                  ))}
                </>
              )}

              <PrimaryButton
                label={entry.fields.length === 0 ? 'Done' : 'Save my choices'}
                loading={saving === entry.issue.id}
                onPress={() => void save(entry)}
              />
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Option({
  title,
  value,
  selected,
  onPress,
}: {
  title: string;
  value: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}: ${value}`}
      style={[
        styles.option,
        {
          borderColor: selected ? theme.accent : theme.border,
          backgroundColor: selected
            ? theme.backgroundSelected
            : theme.backgroundElement,
        },
      ]}>
      <View style={styles.optionText}>
        <ThemedText type="caption" themeColor="textSecondary">
          {title}
        </ThemedText>
        <ThemedText type="default">{value}</ThemedText>
      </View>
      <View
        style={[
          styles.radio,
          { borderColor: selected ? theme.accent : theme.muted },
        ]}>
        {selected ? (
          <View style={[styles.radioDot, { backgroundColor: theme.accent }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
  card: {
    gap: Spacing.three,
  },
  quick: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  field: {
    gap: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    minHeight: 56,
    padding: Spacing.three - 4,
    borderWidth: 1.5,
    borderRadius: Radius.control,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
