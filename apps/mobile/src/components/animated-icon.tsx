import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Brand } from '@/constants/theme';

/** Must match `imageWidth` for expo-splash-screen in app.json, so the hand-off is seamless. */
const SPLASH_IMAGE_SIZE = 160;
const FADE_MS = 600;
// One blink: the glow brightens, dims, then rests a moment before the next.
const BLINK_UP_MS = 380;
const BLINK_DOWN_MS = 380;
const BLINK_REST_MS = 260;
/** At least one full blink is always seen before the overlay can fade away. */
const MIN_SHOWN_MS = 1100;
/** If the app is somehow never "ready", the overlay still leaves after this. */
const MAX_SHOWN_MS = 8000;

// Soft halo behind the symbol: concentric copper circles that breathe together.
const RINGS = [
  { size: 360, strength: 0.03 },
  { size: 325, strength: 0.035 },
  { size: 292, strength: 0.04 },
  { size: 262, strength: 0.045 },
  { size: 234, strength: 0.05 },
  { size: 208, strength: 0.055 },
  { size: 184, strength: 0.06 },
] as const;

/**
 * Drawn over the app while it opens, exactly where the native splash was (brand
 * symbol centred on limestone or graphite). The symbol glows while the phone
 * opens its data, then the whole overlay fades away to the dashboard as soon as
 * `ready` is true (and not before the glow has been seen for a moment).
 */
export function AnimatedSplashOverlay({ ready = true }: { ready?: boolean }) {
  const dark = useColorScheme() === 'dark';
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);
  const startedAt = useRef(0);

  const pulse = useSharedValue(1);
  const opacity = useSharedValue(1);

  // The glow starts when the overlay appears.
  useEffect(() => {
    startedAt.current = Date.now();
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: BLINK_UP_MS,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0, {
          duration: BLINK_DOWN_MS,
          easing: Easing.in(Easing.quad),
        }),
        withTiming(0, { duration: BLINK_REST_MS }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  // Fade out once the app is ready, after the glow has been on show a moment.
  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_SHOWN_MS - (Date.now() - startedAt.current));
    const timer = setTimeout(() => setFading(true), wait);
    return () => clearTimeout(timer);
  }, [ready]);

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
  const symbolStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.3, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.97, 1.05]) }],
  }));

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
      {RINGS.map((ring) => (
        <GlowRing
          key={ring.size}
          size={ring.size}
          strength={ring.strength}
          pulse={pulse}
        />
      ))}
      <Animated.View style={symbolStyle}>
        <Image
          style={styles.image}
          source={
            dark
              ? require('@/assets/images/corechain/splash-icon-dark.png')
              : require('@/assets/images/corechain/splash-icon.png')
          }
        />
      </Animated.View>
    </Animated.View>
  );
}

function GlowRing({
  size,
  strength,
  pulse,
}: {
  size: number;
  strength: number;
  pulse: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: strength * interpolate(pulse.value, [0, 1], [0, 2.6]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.85, 1.12]) }],
  }));
  return (
    <Animated.View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  image: {
    width: SPLASH_IMAGE_SIZE,
    height: SPLASH_IMAGE_SIZE,
  },
  ring: {
    position: 'absolute',
    backgroundColor: Brand.copper,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
