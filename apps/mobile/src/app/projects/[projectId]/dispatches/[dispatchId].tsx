import { type FieldDispatch } from '@corechain/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { StatusPill } from '@/components/ui/status-pill';
import { Spacing } from '@/constants/theme';
import {
  addSamplesToDispatch,
  deleteOpenDispatch,
  getDispatch,
  listDispatchSamples,
  listDispatchableSamples,
  removeSampleFromDispatch,
  shareDispatchSheet,
  type DispatchMember,
} from '@/data/dispatchRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { describeDay } from '@/utils/dates';

function describe(sample: DispatchMember): string {
  const parts = [sample.holeId];
  if (sample.fromM != null && sample.toM != null) {
    parts.push(`${sample.fromM}–${sample.toM} m`);
  }
  parts.push(sample.type.charAt(0).toUpperCase() + sample.type.slice(1));
  return parts.join(' · ');
}

/**
 * E7-2 / E7-3: one dispatch. While it is open, samples can be added and taken
 * out. Handing it over records every sample as dispatched, and the sheet can be
 * shared at any point (email, messaging, Drive).
 */
export default function DispatchScreen() {
  const { projectId, dispatchId } = useLocalSearchParams<{
    projectId: string;
    dispatchId: string;
  }>();
  const router = useRouter();

  const [dispatch, setDispatch] = useState<FieldDispatch | null>(null);
  const [members, setMembers] = useState<DispatchMember[]>([]);
  const [available, setAvailable] = useState<DispatchMember[]>([]);
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);

  const load = useCallback(() => {
    (async () => {
      const loaded = await getDispatch(dispatchId);
      setDispatch(loaded);
      if (!loaded) return;
      const [inside, outside] = await Promise.all([
        listDispatchSamples(dispatchId),
        loaded.status === 'open'
          ? listDispatchableSamples(loaded.projectId)
          : Promise.resolve([]),
      ]);
      setMembers(inside);
      setAvailable(outside);
    })().catch(() => {});
  }, [dispatchId]);
  useFocusReload(load);

  if (!dispatch) {
    return null;
  }
  const open = dispatch.status === 'open';

  async function share() {
    setSharing(true);
    try {
      await shareDispatchSheet(dispatchId);
    } catch (error) {
      Alert.alert(
        'Could not share the sheet',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setSharing(false);
    }
  }

  async function addPicked() {
    if (!dispatch) return;
    await addSamplesToDispatch(
      dispatch,
      available.filter((s) => picked.has(s.id)),
    );
    setPicked(new Set());
    setAdding(false);
    load();
  }

  function confirmDelete() {
    Alert.alert(
      `Delete ${dispatch?.dispatchNumber}?`,
      'The dispatch is removed and its samples are free to go in another. Nothing has been handed over yet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteOpenDispatch(dispatchId);
            router.back();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <ThemedText type="subtitle" style={styles.flex}>
              {dispatch.dispatchNumber}
            </ThemedText>
            <StatusPill
              label={open ? 'Open' : 'Dispatched'}
              tone={open ? 'warning' : 'success'}
            />
          </View>
          <ThemedText type="default">{dispatch.laboratory}</ThemedText>
          {dispatch.handoverAt ? (
            <ThemedText type="small" themeColor="textSecondary">
              Handed over {describeDay(dispatch.handoverAt)}
            </ThemedText>
          ) : null}
          {dispatch.preparationRequest ? (
            <ThemedText type="small" themeColor="textSecondary">
              Preparation: {dispatch.preparationRequest}
            </ThemedText>
          ) : null}
          {dispatch.note ? (
            <ThemedText type="small" themeColor="textSecondary">
              {dispatch.note}
            </ThemedText>
          ) : null}
        </View>

        {open ? (
          <PrimaryButton
            label="Hand over to the laboratory"
            icon="truck-delivery-outline"
            disabled={members.length === 0}
            onPress={() =>
              router.push(
                `/projects/${projectId}/dispatches/handover?dispatchId=${dispatchId}`,
              )
            }
          />
        ) : null}
        <PrimaryButton
          label="Share dispatch sheet"
          icon="share-variant-outline"
          variant={open ? 'secondary' : 'primary'}
          loading={sharing}
          disabled={members.length === 0}
          onPress={() => void share()}
        />

        <View style={styles.section}>
          <ThemedText type="caption" themeColor="textSecondary">
            SAMPLES · {members.length}
          </ThemedText>
          {members.map((sample) => (
            <Card key={sample.id}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <ThemedText type="smallBold">
                    {sample.sampleNumber}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {describe(sample)}
                  </ThemedText>
                </View>
                {open ? (
                  <Pressable
                    onPress={async () => {
                      await removeSampleFromDispatch(dispatchId, sample.id);
                      load();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Take ${sample.sampleNumber} out of this dispatch`}
                    hitSlop={Spacing.two}
                  >
                    <Icon
                      name="close-circle-outline"
                      size={26}
                      themeColor="muted"
                    />
                  </Pressable>
                ) : null}
              </View>
            </Card>
          ))}
        </View>

        {open ? (
          <View style={styles.section}>
            <PrimaryButton
              label={adding ? 'Close the list' : 'Add more samples'}
              icon={adding ? 'chevron-up' : 'plus'}
              variant="secondary"
              onPress={() => setAdding((value) => !value)}
            />
            {adding ? (
              available.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No other bagged samples are free to add.
                </ThemedText>
              ) : (
                <>
                  {available.map((sample) => {
                    const on = picked.has(sample.id);
                    return (
                      <Card
                        key={sample.id}
                        onPress={() =>
                          setPicked((previous) => {
                            const next = new Set(previous);
                            if (next.has(sample.id)) next.delete(sample.id);
                            else next.add(sample.id);
                            return next;
                          })
                        }
                        accessibilityLabel={`${on ? 'Remove' : 'Add'} sample ${sample.sampleNumber}`}
                      >
                        <View style={styles.row}>
                          <Icon
                            name={
                              on ? 'checkbox-marked' : 'checkbox-blank-outline'
                            }
                            size={26}
                            themeColor={on ? 'accent' : 'muted'}
                          />
                          <View style={styles.flex}>
                            <ThemedText type="smallBold">
                              {sample.sampleNumber}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary">
                              {describe(sample)}
                            </ThemedText>
                          </View>
                        </View>
                      </Card>
                    );
                  })}
                  <PrimaryButton
                    label={`Add ${picked.size} ${picked.size === 1 ? 'sample' : 'samples'}`}
                    disabled={picked.size === 0}
                    onPress={() => void addPicked()}
                  />
                </>
              )
            ) : null}
          </View>
        ) : null}

        {open ? (
          <Pressable
            onPress={confirmDelete}
            accessibilityRole="button"
            accessibilityLabel={`Delete dispatch ${dispatch.dispatchNumber}`}
            style={styles.delete}
          >
            <ThemedText type="smallBold" themeColor="danger">
              Delete dispatch
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
  flex: {
    flex: 1,
  },
  header: {
    gap: Spacing.one + 2,
    paddingTop: Spacing.two,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.two + 2,
    paddingTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  delete: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
});
