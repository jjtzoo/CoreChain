import * as SecureStore from 'expo-secure-store';

// Which account the records on this phone belong to. Kept in the keystore, next
// to the sign-in itself, so a phone handed to a different account can be
// recognised and never mixes two people's work.
const KEY = 'corechain.data.owner';

export async function getDataOwner(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setDataOwner(userId: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, userId);
}
