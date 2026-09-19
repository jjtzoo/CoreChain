import type { TraceStep, TraceStepKey, TraceStepState } from '@corechain/domain';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const STEP_ICONS: Record<TraceStepKey, IconName> = {
  hole: 'map-marker-outline',
  box: 'package-variant-closed',
  interval: 'text-box-outline',
  sample: 'flask-outline',
  bagged: 'shopping-outline',
  dispatched: 'truck-delivery-outline',
  assay: 'chart-line',
};

const STATE_STYLE: Record<
  TraceStepState,
  { fg: ThemeColor; bg: ThemeColor; icon?: IconName }
> = {
  done: { fg: 'success', bg: 'successSoft', icon: 'check' },
  current: { fg: 'accent', bg: 'accentSoft' },
  upcoming: { fg: 'muted', bg: 'backgroundSelected' },
  missing: { fg: 'warning', bg: 'warningSoft', icon: 'alert-circle-outline' },
};

const DOT = 32;

/**
 * A vertical chain of steps: what has happened (ticked), what is next
 * (highlighted), what is still to come (faded), and what should exist but
 * doesn't (amber). This is where traceability becomes visible.
 */
export function TraceChain({ steps }: { steps: readonly TraceStep[] }) {
  const theme = useTheme();

  return (
    <View>
      {steps.map((step, index) => {
        const style = STATE_STYLE[step.state];
        const last = index === steps.length - 1;
        const faded = step.state === 'upcoming';
        return (
          <View key={step.key} style={styles.step}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: theme[style.bg] }]}>
                <Icon
                  name={style.icon ?? STEP_ICONS[step.key]}
                  size={18}
                  themeColor={style.fg}
                />
              </View>
              {last ? null : (
                <View style={[styles.line, { backgroundColor: theme.border }]} />
              )}
            </View>
            <View style={[styles.text, last && styles.lastText]}>
              <ThemedText
                type="smallBold"
                themeColor={
                  step.state === 'missing'
                    ? 'warning'
                    : faded
                      ? 'textSecondary'
                      : 'text'
                }>
                {step.title}
              </ThemedText>
              {step.detail ? (
                <ThemedText
                  type="small"
                  themeColor={step.state === 'missing' ? 'warning' : 'textSecondary'}>
                  {step.detail}
                </ThemedText>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  step: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  rail: {
    alignItems: 'center',
    width: DOT,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: Spacing.three,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.three,
  },
  lastText: {
    paddingBottom: 0,
  },
});
