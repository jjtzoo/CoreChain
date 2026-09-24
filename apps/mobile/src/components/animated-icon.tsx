import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BrandFill, CREEP_MS, CREEP_TO } from '@/components/brand-fill';
import { Brand } from '@/constants/theme';

/** Must match `imageWidth` for expo-splash-screen in app.json, so the hand-off is seamless. */
const SPLASH_IMAGE_SIZE = 160;
const FADE_MS = 600;
/** The last stretch, once the app is ready, and a beat to see it full. */
const FINISH_MS = 240;
const FULL_HOLD_MS = 160;
/** The fill is always on show for at least this long, so it never flickers past. */
const MIN_SHOWN_MS = 1000;
/** If the app is somehow never "ready", the overlay still leaves after this. */
const MAX_SHOWN_MS = 8000;

/**
 * Drawn over the app while it opens, exactly where the native splash was. The
 * CoreChain "C" is the loading bar: it starts as a faint outline and fills from
 * left to right while the phone opens its data, completes when the app is
 * ready, then the whole overlay fades away to the dashboard.
 */
export function AnimatedSplashOverlay({ ready = true }: { ready?: boolean }) {
  const dark = useColorScheme() === 'dark';
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);
  const startedAt = useRef(0);

  const progress = useSharedValue(0);
  const opacity = useSharedValue(1);

  // The fill starts creeping as soon as the overlay appears.
  useEffect(() => {
    startedAt.current = Date.now();
    progress.value = withTiming(CREEP_TO, {
      duration: CREEP_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  // Once the app is ready (and the fill has been seen for a moment), complete
  // the fill, hold a beat, then fade to the dashboard.
  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_SHOWN_MS - (Date.now() - startedAt.current));
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const finishTimer = setTimeout(() => {
      progress.value = withTiming(1, {
        duration: FINISH_MS,
        easing: Easing.out(Easing.quad),
      });
      fadeTimer = setTimeout(() => setFading(true), FINISH_MS + FULL_HOLD_MS);
    }, wait);
    return () => {
      clearTimeout(finishTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [ready, progress]);

  // Never stay for good, whatever happens (a reopened app once kept this on screen).
  useEffect(() => {
    const timer = setTimeout(() => setFading(true), MAX_SHOWN_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!fading) return;
    opacity.value = withTiming(0, {
      duration: FADE_MS,
      easing: Easing.out(Easing.quad),
    });
    // Remove it from the screen even if the animation never reports back.
    const timer = setTimeout(() => setVisible(false), FADE_MS + 400);
    return () => clearTimeout(timer);
  }, [fading, opacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents={fading ? 'none' : 'auto'}
      onLayout={() => {
        // The native splash is identical, so it can go as soon as this is drawn.
        SplashScreen.hideAsync().catch(() => {});
      }}
      style={[
        styles.splashOverlay,
        { backgroundColor: dark ? Brand.graphite : Brand.limestone },
        overlayStyle,
      ]}>
      <BrandFill
        size={SPLASH_IMAGE_SIZE}
        progress={progress}
        tone={dark ? 'onDark' : 'onLight'}
        accessibilityLabel="Opening CoreChain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
