import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Brand } from '@/constants/theme';

/** Must match `imageWidth` for expo-splash-screen in app.json, so the hand-off is seamless. */
const SPLASH_IMAGE_SIZE = 160;
const DURATION = 400;

const fadeOut = new Keyframe({
  0: { opacity: 1 },
  100: { opacity: 0, easing: Easing.out(Easing.quad) },
});

/**
 * Drawn over the first screen while it loads, exactly where the native splash
 * was (brand symbol centred on limestone or graphite), then fades away.
 */
export function AnimatedSplashOverlay() {
  const dark = useColorScheme() === 'dark';
  const [fading, setFading] = useState(false);
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const background = dark ? Brand.graphite : Brand.limestone;
  const image = (
    <Image
      style={styles.image}
      source={
        dark
          ? require('@/assets/images/corechain/splash-icon-dark.png')
          : require('@/assets/images/corechain/splash-icon.png')
      }
    />
  );

  return fading ? (
    <Animated.View
      entering={fadeOut.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={[styles.splashOverlay, { backgroundColor: background }]}>
      {image}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setFading(true);
        });
      }}
      style={[styles.splashOverlay, { backgroundColor: background }]}>
      {image}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: SPLASH_IMAGE_SIZE,
    height: SPLASH_IMAGE_SIZE,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
