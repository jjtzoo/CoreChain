import * as Network from 'expo-network';
import * as SecureStore from 'expo-secure-store';

// E5-3: the one photo-backup choice, and whether the phone is on Wi-Fi right
// now. Kept in the keystore like the theme choice: a small preference, not work.

const KEY = 'corechain.photos-wifi-only';

export async function loadWifiOnly(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === '1';
  } catch {
    return false;
  }
}

export async function saveWifiOnly(wifiOnly: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, wifiOnly ? '1' : '0');
  } catch {
    // The choice still applies until the app closes; only remembering failed.
  }
}

/** True on Wi-Fi, false on anything else, null when the phone will not say. */
export async function isOnWifi(): Promise<boolean | null> {
  try {
    const state = await Network.getNetworkStateAsync();
    if (!state.type || state.type === Network.NetworkStateType.UNKNOWN) {
      return null;
    }
    return state.type === Network.NetworkStateType.WIFI;
  } catch {
    return null;
  }
}
