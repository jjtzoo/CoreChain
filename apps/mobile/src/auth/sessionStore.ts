import * as SecureStore from 'expo-secure-store';

import type { SessionUser } from './authApi';

// The signed-in session, kept in the platform keystore (like the database
// key), never in the database or anything that gets exported.
const KEY = 'corechain.session';

export type StoredSession = {
  cookie: string;
  user: SessionUser;
  /** When the server last confirmed the session (sign-in or a good check). ISO 8601. */
  lastVerifiedAt: string;
};

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.cookie || !parsed.user?.id || !parsed.lastVerifiedAt) return null;
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing stored, or the keystore is unavailable: either way there is no session.
  }
}
