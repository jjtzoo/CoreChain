import { Image } from 'expo-image';
import { useColorScheme } from 'react-native';

/** Width / height of the official horizontal logo files. */
const ASPECT = 1500 / 420;

/**
 * The official CoreChain logo (symbol + wordmark): graphite on light
 * surfaces, the reversed limestone version on dark ones. Nothing may be
 * added to it (shadows, outlines, other colours): assets/brand/README.md.
 */
export function BrandLockup({ height = 30 }: { height?: number }) {
  const dark = useColorScheme() === 'dark';
  return (
    <Image
      source={
        dark
          ? require('@/assets/images/corechain/primary-reversed.png')
          : require('@/assets/images/corechain/primary-horizontal.png')
      }
      style={{ height, width: height * ASPECT }}
      contentFit="contain"
      accessibilityLabel="CoreChain"
    />
  );
}

/** Just the symbol, for empty states and other spots where the name is already on screen. */
export function BrandSymbol({ size = 64 }: { size?: number }) {
  const dark = useColorScheme() === 'dark';
  return (
    <Image
      source={
        dark
          ? require('@/assets/images/corechain/splash-icon-dark.png')
          : require('@/assets/images/corechain/splash-icon.png')
      }
      style={{ width: size, height: size }}
      contentFit="contain"
      accessibilityLabel="CoreChain"
    />
  );
}
