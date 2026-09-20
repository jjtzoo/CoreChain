// Where the CoreChain server lives. The phone talks to it only to sign in and,
// from Sprint 4 on, to sync; everything else works with no signal.
//
// Override for a local or staging server with EXPO_PUBLIC_SERVER_URL at build time.
export const SERVER_URL = (
  process.env.EXPO_PUBLIC_SERVER_URL ?? 'https://corechain-orpin.vercel.app'
).replace(/\/$/, '');

// The PowerSync instance the phone syncs through (Sprint 4). Not a secret: a
// phone still needs a valid sign-in token to use it.
export const POWERSYNC_URL =
  process.env.EXPO_PUBLIC_POWERSYNC_URL ??
  'https://6aaf4b9902481fb31b97fabf.powersync.journeyapps.com';
