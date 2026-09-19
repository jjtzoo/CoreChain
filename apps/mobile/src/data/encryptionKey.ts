import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// The SQLCipher passphrase for the on-device database (decisions D8/D11 in
// docs/product/corechain-mobile-mvp-scrum-plan.md). Generated once per
// install and kept in the platform keystore via expo-secure-store — never
// written to the database file itself, and never sent anywhere; sync
// (Sprint 4/5) transfers rows over HTTPS to our own API, not this key.
const SECURE_STORE_KEY = 'corechain.sqlite.encryptionKey';
const KEY_BYTE_LENGTH = 32; // 256-bit passphrase

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Returns the device's local database passphrase, generating and storing a
 * new one on first launch. Uninstalling the app deletes this key on Android
 * (expo-secure-store's documented behavior), which is fine here: the
 * encrypted database file is deleted along with the app anyway.
 */
export async function getOrCreateEncryptionKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(SECURE_STORE_KEY);
  if (existing) {
    return existing;
  }

  const randomBytes = await Crypto.getRandomBytesAsync(KEY_BYTE_LENGTH);
  const key = bytesToHex(randomBytes);
  await SecureStore.setItemAsync(SECURE_STORE_KEY, key);
  return key;
}
