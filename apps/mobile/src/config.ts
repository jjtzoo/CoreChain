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

// Where crash and error reports go (E10-3). A Sentry DSN is not a secret —
// it is meant to ship inside client apps — so it is safe to default here.
export const SENTRY_DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN ??
  'https://674afa3534426644d17effdd3f648adf@o4512125496983552.ingest.us.sentry.io/4512125505568768';
