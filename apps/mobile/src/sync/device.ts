import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { SERVER_URL } from '@/config';

// This phone's identity on the server (decision D6): a random id made once and
// kept in the keystore. The server uses it to tell two phones on one account
// apart, and to hand each phone its own block of sample numbers.

const KEY = 'corechain.device.id';

// A stale pooled connection (e.g. surviving a Wi-Fi/mobile-data handoff) can
// leave a request neither answered nor failed. Without a bound, that wedges
// every later sync attempt, since registration gates the upload itself.
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * A device id belongs to one account for good (the server refuses a second
 * account trying to claim it): when this phone changes hands to a different
 * account, it must mint a fresh id rather than have the new account collide
 * with whatever account last used this phone.
 */
export async function resetDeviceId(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}

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
  console.log('[Sync] registerDevice: reading device id');
  const deviceId = await getDeviceId();
  console.log(`[Sync] registerDevice: got device id ${deviceId}`);
  const controller = new AbortController();
  const timer = setTimeout(() => {
    console.log('[Sync] registerDevice: aborting after timeout');
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  console.log(`[Sync] registerDevice: POST /api/devices to ${SERVER_URL}`);
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
      signal: controller.signal,
    });
    console.log(`[Sync] registerDevice: response ${response.status}`);
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
  } catch (error) {
    console.log(
      `[Sync] registerDevice: fetch threw: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { ok: false, reason: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}
