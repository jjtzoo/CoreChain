import {
  daysInRange,
  formatRange,
  formatWorkReport,
  isEmptyWork,
  isoToLocalDate,
  localDateToIso,
  orderedRange,
  rangeForPreset,
  summariseWork,
  type DayRange,
  type WorkInput,
  type WorkPreset,
} from '@corechain/domain';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/auth/session-context';
import { DateField } from '@/components/form/date-field';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { StatTile } from '@/components/ui/stat-tile';
import { WorkWeekStrip } from '@/components/work-week-strip';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { loadWorkInput } from '@/data/workRepository';
import { useFocusReload } from '@/hooks/use-focus-reload';
import { ScreenLoader } from '@/components/screen-loader';

type Choice = WorkPreset | 'custom';

const CHOICES: { key: Choice; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'custom', label: 'Pick dates' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * E14: what the geologist did on a day, a week or any range of dates, worked
 * out from the records on the phone (no signal needed).
 */
export default function MyWorkScreen() {
  const { user } = useSession();
  const [input, setInput] = useState<WorkInput | null>(null);
  const [choice, setChoice] = useState<Choice>('today');
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);

  const load = useCallback(() => {
    void loadWorkInput().then(setInput);
  }, []);
  useFocusReload(load);

  const range: DayRange = useMemo(() => {
    const now = new Date();
    if (choice !== 'custom') return rangeForPreset(choice, now);
    const today = localDateToIso(now);
    return orderedRange(customFrom ?? today, customTo ?? customFrom ?? today);
  }, [choice, customFrom, customTo]);

  const summary = useMemo(
    () => (input ? summariseWork(input, range) : null),
    [input, range],
  );

  // The strip always shows the seven days that end on the chosen last day.
  const strip = useMemo(() => {
    if (!input) return [];
    const end = isoToLocalDate(range.to) ?? new Date();
    const stripRange = {
      from: localDateToIso(new Date(end.getTime() - 6 * DAY_MS)),
      to: range.to,
    };
    return summariseWork(input, stripRange).perDay;
  }, [input, range.to]);

  if (!summary) return <ScreenLoader />;

  function pickDay(day: string) {
    setChoice('custom');
    setCustomFrom(day);
    setCustomTo(day);
  }

  async function share() {
    if (!summary) return;
    await Share.share({
      message: formatWorkReport({
        summary,
        person: user?.name || user?.email || 'Field geologist',
      }),
    });
  }

  const multiDay = daysInRange(range).length > 1;
  const empty = isEmptyWork(summary);
  const c = summary.custody;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.chips}>
          {CHOICES.map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              selected={choice === item.key}
              onPress={() => {
                if (item.key === 'custom' && customFrom === null) {
                  setCustomFrom(range.from);
                  setCustomTo(range.to);
                }
                setChoice(item.key);
              }}
            />
          ))}
        </View>

        {choice === 'custom' ? (
          <Card style={styles.dates}>
            <DateField
              label="From"
              clearable={false}
              value={customFrom ?? range.from}
              onChange={(day) => day && setCustomFrom(day)}
            />
            <DateField
              label="To"
              clearable={false}
              value={customTo ?? range.to}
              onChange={(day) => day && setCustomTo(day)}
            />
          </Card>
        ) : null}

        <WorkWeekStrip
          days={strip}
          selectedFrom={range.from}
          selectedTo={range.to}
          onSelectDay={pickDay}
        />

        <View style={styles.heading}>
          <ThemedText type="heading">{formatRange(range)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Counted by the day the work was done, from what is on this phone.
          </ThemedText>
        </View>

        {empty ? (
          <Card>
            <ThemedText type="default">
              Nothing recorded {multiDay ? 'in these dates' : 'this day'}.
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Pick another day on the strip above, or log some core and it
              appears here.
            </ThemedText>
          </Card>
        ) : (
          <>
            <Card style={styles.hero}>
              <ThemedText type="caption" themeColor="textSecondary">
                CORE LOGGED
              </ThemedText>
              <ThemedText type="title" style={styles.heroValue}>
                {summary.metresLogged} m
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {summary.intervalCount === 0
                  ? 'No intervals logged'
                  : `${plural(summary.intervalCount, 'interval', 'intervals')} across ${plural(summary.holes.length, 'hole', 'holes')}`}
              </ThemedText>
              {multiDay ? <MetresChart perDay={summary.perDay} /> : null}
            </Card>

            <View style={styles.tiles}>
              <StatTile
                value={summary.samples.total}
                label="Samples"
                detail={
                  summary.samples.qc > 0
                    ? `${summary.samples.qc} QC`
                    : undefined
                }
              />
              <StatTile
                value={c.total}
                label="Custody steps"
                detail={
                  c.total > 0
                    ? [
                        c.bagged ? `${c.bagged} bagged` : '',
                        c.sealed ? `${c.sealed} sealed` : '',
                        c.handedOver ? `${c.handedOver} handed over` : '',
                        c.dispatched ? `${c.dispatched} dispatched` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : undefined
                }
              />
              <StatTile value={summary.boxes} label="Core boxes" />
              <StatTile value={summary.runs} label="Core runs" />
              <StatTile value={summary.photos} label="Photos" />
              <StatTile
                value={summary.dispatches.length}
                label="Dispatches"
                detail={summary.dispatches
                  .map((d) => d.dispatchNumber)
                  .join(', ')}
              />
            </View>

            {summary.holes.length > 0 ? (
              <Card style={styles.list}>
                <ThemedText type="heading">Holes worked</ThemedText>
                {summary.holes.map((hole) => (
                  <View key={hole.holeName} style={styles.holeRow}>
                    <View style={styles.holeText}>
                      <ThemedText type="smallBold">{hole.holeName}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {hole.fromM}–{hole.toM} m
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold">{hole.metres} m</ThemedText>
                  </View>
                ))}
              </Card>
            ) : null}

            <Card style={styles.list}>
              <ThemedText type="heading">Activity</ThemedText>
              {summary.activity.slice(0, 40).map((line, index) => (
                <View key={`${line.at}-${index}`} style={styles.activityRow}>
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    style={styles.activityTime}>
                    {multiDay
                      ? new Date(line.at).toLocaleDateString([], {
                          day: 'numeric',
                          month: 'short',
                        })
                      : time(line.at)}
                  </ThemedText>
                  <ThemedText type="small" style={styles.activityText}>
                    {line.text}
                  </ThemedText>
                </View>
              ))}
              {summary.activity.length > 40 ? (
                <ThemedText type="caption" themeColor="textSecondary">
                  Showing the latest 40 of {summary.activity.length}.
                </ThemedText>
              ) : null}
            </Card>

            <PrimaryButton
              label={multiDay ? 'Share report' : 'Share day report'}
              icon="share-variant-outline"
              onPress={() => void share()}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Metres logged each day across the chosen dates. */
function MetresChart({
  perDay,
}: {
  perDay: readonly { day: string; metres: number }[];
}) {
  const theme = useTheme();
  const most = Math.max(1, ...perDay.map((d) => d.metres));
  return (
    <View style={styles.chart} accessibilityLabel="Metres logged per day">
      {perDay.map((d) => (
        <View key={d.day} style={styles.chartColumn}>
          <View style={styles.chartTrack}>
            <View
              style={[
                styles.chartBar,
                {
                  backgroundColor: theme.brand,
                  height: `${Math.max(d.metres > 0 ? 6 : 0, (d.metres / most) * 100)}%`,
                },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  dates: {
    gap: Spacing.three,
  },
  heading: {
    gap: Spacing.one,
  },
  hero: {
    gap: Spacing.one,
  },
  heroValue: {
    fontSize: 40,
    lineHeight: 46,
  },
  tiles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two + 2,
  },
  list: {
    gap: Spacing.three,
  },
  holeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
  },
  holeText: {
    flex: 1,
  },
  activityRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  activityTime: {
    width: 64,
  },
  activityText: {
    flex: 1,
  },
  chart: {
    flexDirection: 'row',
    gap: 3,
    height: 64,
    marginTop: Spacing.two,
  },
  chartColumn: {
    flex: 1,
  },
  chartTrack: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  chartBar: {
    borderRadius: 3,
  },
});
