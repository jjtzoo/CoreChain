import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

/** Which symbol to draw: the graphite one sits on light, the limestone one on dark. */
export type BrandTone = 'onLight' | 'onDark';

const SOURCES = {
  onLight: require('@/assets/images/corechain/splash-icon.png'),
  onDark: require('@/assets/images/corechain/splash-icon-dark.png'),
} as const;

/** How faint the empty symbol is before it fills. */
const GHOST_OPACITY = 0.14;
/** How far a screen-sized fill creeps while it waits, and how long that takes. */
export const CREEP_TO = 0.85;
export const CREEP_MS = 2400;
/** A small fill that repeats, for waits with no screen of their own (a button, the shutter). */
const LOOP_FILL_MS = 900;
const LOOP_HOLD_MS = 200;

export function useBrandTone(): BrandTone {
  return useColorScheme() === 'dark' ? 'onDark' : 'onLight';
}

/**
 * The CoreChain "C" as a loading bar: a faint outline with the full symbol
 * revealed from left to right as `progress` goes from 0 to 1. The same drawing
 * as the opening splash, at any size.
 */
export function BrandFill({
  size,
  progress,
  tone,
  accessibilityLabel = 'Loading',
}: {
  size: number;
  progress: SharedValue<number>;
  tone: BrandTone;
  accessibilityLabel?: string;
}) {
  const fillStyle = useAnimatedStyle(() => ({ width: size * progress.value }));
  const square = { width: size, height: size };
  const source = SOURCES[tone];
  return (
    <View
      style={square}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}>
      <Image style={[square, { opacity: GHOST_OPACITY }]} source={source} />
      <Animated.View style={[styles.fill, { height: size }, fillStyle]}>
        <Image style={square} source={source} />
      </Animated.View>
    </View>
  );
}

/** Starts creeping towards CREEP_TO as soon as it mounts, like the splash. */
export function useCreepFill() {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(CREEP_TO, {
      duration: CREEP_MS,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(progress);
  }, [progress]);
  return progress;
}

/** Fills, holds a beat, empties and fills again, for as long as it is shown. */
export function LoopingBrandFill({
  size,
  tone,
  accessibilityLabel,
}: {
  size: number;
  tone: BrandTone;
  accessibilityLabel?: string;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: LOOP_FILL_MS,
          easing: Easing.inOut(Easing.cubic),
        }),
        withDelay(LOOP_HOLD_MS, withTiming(0, { duration: 0 })),
      ),
      -1,
    );
    return () => cancelAnimation(progress);
  }, [progress]);
  return (
    <BrandFill
      size={size}
      progress={progress}
      tone={tone}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

const styles = StyleSheet.create({
  // Shows only the left part of the full symbol, so it fills like a bar.
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
});
