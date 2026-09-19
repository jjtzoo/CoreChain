/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * The CoreChain brand palette (assets/brand/README.md): graphite, warm
 * limestone and muted copper. The UI is graphite-on-limestone; copper is the
 * brand accent. Status colours (success, warning, danger) are the only other
 * hues, and each is tuned to sit on the warm background.
 */
export const Brand = {
  graphite: '#182321',
  limestone: '#EEEAE1',
  copper: '#A66A43',
} as const;

export const Colors = {
  // Light is tuned for bright outdoor light: graphite text on limestone, white-ish
  // cards with clear borders, and strong (not pastel) status colours.
  light: {
    text: '#182321',
    background: '#EEEAE1',
    backgroundElement: '#FAF8F3',
    backgroundSelected: '#E2DCCE',
    textSecondary: '#49554F',
    muted: '#7A827C',
    border: '#D6CFC0',
    accent: '#182321',
    accentSoft: '#E3DDCF',
    onAccent: '#EEEAE1',
    brand: '#A66A43',
    success: '#1F7A55',
    successSoft: '#D9E9DE',
    warning: '#9A5B00',
    warningSoft: '#F3E3C2',
    danger: '#B3261E',
    dangerSoft: '#F4DCD6',
  },
  dark: {
    text: '#EEEAE1',
    background: '#0F1615',
    backgroundElement: '#182321',
    backgroundSelected: '#243431',
    textSecondary: '#A8B0A9',
    muted: '#7E8983',
    border: '#2A3A37',
    accent: '#EEEAE1',
    accentSoft: '#243431',
    onAccent: '#182321',
    brand: '#C98559',
    success: '#5FCB9B',
    successSoft: '#12301F',
    warning: '#E6A94C',
    warningSoft: '#3A2A0E',
    danger: '#FF8378',
    dangerSoft: '#3A1815',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Corner radii: controls, cards, and pills. */
export const Radius = {
  control: 14,
  card: 18,
  pill: 999,
} as const;

/** The smallest a tap target should be, so gloved hands can hit it. */
export const MinTap = 52;

export const MaxContentWidth = 800;
