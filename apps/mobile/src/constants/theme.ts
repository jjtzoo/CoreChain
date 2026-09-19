/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  // Light is tuned for bright outdoor light: near-black text on white cards,
  // strong (not pastel) status colours, and clear card borders.
  light: {
    text: '#0E1116',
    background: '#F4F6F8',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E6EAF0',
    textSecondary: '#525A67',
    muted: '#7A828E',
    border: '#DCE1E8',
    accent: '#1660E8',
    accentSoft: '#E6EFFD',
    onAccent: '#FFFFFF',
    success: '#0E7A55',
    successSoft: '#DFF3EA',
    warning: '#A84300',
    warningSoft: '#FDEBD6',
    danger: '#C1271D',
    dangerSoft: '#FCE8E6',
  },
  dark: {
    text: '#F2F4F7',
    background: '#0A0C0F',
    backgroundElement: '#15181D',
    backgroundSelected: '#232830',
    textSecondary: '#A6ADB8',
    muted: '#7C8491',
    border: '#262B33',
    accent: '#6AA5FF',
    accentSoft: '#13284A',
    onAccent: '#04122E',
    success: '#4FD1A0',
    successSoft: '#0E2E24',
    warning: '#F2A65A',
    warningSoft: '#3A2410',
    danger: '#FF7B70',
    dangerSoft: '#3A1512',
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
