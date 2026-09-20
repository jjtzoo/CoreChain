import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';

// Light, dark, or follow the phone (the default). A geologist can force the
// light theme, which is tuned for bright sun, even when the phone is in dark
// mode. It is a small preference kept in the keystore, next to the session.

export const THEME_PREFERENCES = ['auto', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const THEME_PREFERENCE_LABELS: Record<ThemePreference, string> = {
  auto: 'Match phone',
  light: 'Light',
  dark: 'Dark',
};

const KEY = 'corechain.theme-preference';

export function toThemePreference(raw: string | null): ThemePreference {
  return (THEME_PREFERENCES as readonly string[]).includes(raw ?? '')
    ? (raw as ThemePreference)
    : 'auto';
}

/** Makes every screen use the chosen theme (or the phone's own, for auto). */
export function applyThemePreference(preference: ThemePreference): void {
  Appearance.setColorScheme(preference === 'auto' ? 'unspecified' : preference);
}

export async function loadThemePreference(): Promise<ThemePreference> {
  try {
    return toThemePreference(await SecureStore.getItemAsync(KEY));
  } catch {
    return 'auto';
  }
}

export async function saveThemePreference(
  preference: ThemePreference,
): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, preference);
  } catch {
    // The choice still applies until the app closes; only remembering failed.
  }
}
