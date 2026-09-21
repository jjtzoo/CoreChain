import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { SERVER_URL } from '@/config';

// This phone's identity on the server (decision D6): a random id made once and
// kept in the keystore. The server uses it to tell two phones on one account
// apart, and to hand each phone its own block of sample numbers.

const KEY = 'corechain.device.id';

export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(KEY, id);
  return id;
}

function deviceName(): string {
  const constants = Platform.constants as { Brand?: string; Model?: string };
  const name = [constants.Brand, constants.Model].filter(Boolean).join(' ');
  return name || 'Android phone';
}

export type Registration =
  | { ok: true; deviceId: string }
  | { ok: false; reason: 'unreachable' | 'refused' };

const MIN_VERSION_KEY = 'corechain.sync.minAppVersion';

/**
 * The oldest app version the server said it still accepts, last learned at
 * registration (E10-8). Null until the phone has reached the server at least
 * once; nothing is assumed before then.
 */
export async function loadMinAppVersion(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(MIN_VERSION_KEY);
  } catch {
    return null;
  }
}

async function saveMinAppVersion(minAppVersion: unknown): Promise<void> {
  if (typeof minAppVersion !== 'string' || !minAppVersion) return;
  try {
    await SecureStore.setItemAsync(MIN_VERSION_KEY, minAppVersion);
  } catch {
    // The check just won't be as fresh next time; it is never a reason to fail registration.
  }
}

/** Tells the server this phone is in use. Safe to repeat. Never throws. */
export async function registerDevice(cookie: string): Promise<Registration> {
  const deviceId = await getDeviceId();
  try {
    const response = await fetch(`${SERVER_URL}/api/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        deviceId,
        name: deviceName(),
        platform: 'android',
        appVersion: Constants.expoConfig?.version ?? null,
      }),
    });
    if (response.ok) {
      const body = (await response.json().catch(() => null)) as {
        minAppVersion?: unknown;
      } | null;
      await saveMinAppVersion(body?.minAppVersion);
      return { ok: true, deviceId };
    }
    // 401 means the session ended, 403 that this phone was removed: neither is
    // fixed by trying again, and neither should stop the person working.
    return {
      ok: false,
      reason: response.status >= 500 ? 'unreachable' : 'refused',
    };
  } catch {
    return { ok: false, reason: 'unreachable' };
  }
}
