# How CoreChain Field (the phone app) is built

A plain-language map of `apps/mobile`, written so it can be explained out
loud. It covers what each piece is, why it was chosen, and how the app
works with no signal at all — which is the whole point of the app. The desk
side (`apps/web`) is covered separately in
[web-app-architecture.md](web-app-architecture.md).

CoreChain Field is in development testing, not yet released.

## The one-line version

A native Android app (Expo / React Native), built as a real native app, not
run inside Expo Go, because it needs a native, encrypted SQLite database.
Every screen reads and writes to that local database first — the network is
never on the critical path for logging core. A background sync engine
(PowerSync) later carries those changes up to the same Postgres database the
web app uses, and carries down whatever a teammate or the desk logged, so
every device converges on the same picture without anyone waiting for a
signal bar.

## The stack, and why each piece is there

| Layer | Choice | Why |
|---|---|---|
| Framework | Expo (React Native), TypeScript, Expo Router | File-based navigation, and Expo's tooling for building a real native binary, over-the-air JS updates, and Play Store packaging — without hand-rolling native build config. |
| Local database | SQLite via `@op-engineering/op-sqlite`, opened through PowerSync | Requires a real native build (`expo run:android`); this is why Expo Go can't run this app. `op-sqlite`'s SQLCipher build encrypts the database file at rest — the key lives in the phone's Keystore, not in the app's code. |
| Offline sync | `@powersync/react-native` | Gives every local table PowerSync's own change-tracking triggers, so any edit is automatically queued to upload later. The phone is never blocked waiting on a write to reach the server. |
| Auth | Cookie-based session against the web app's Better Auth, then a short-lived JWT for PowerSync | The phone signs in once against the web app; after that, it fetches a fresh PowerSync token whenever it needs to sync, so the session can be revoked or expire without the phone losing its locally logged data. |
| Crash and error reporting | Sentry (`@sentry/react-native`) | The only way to know a field build broke, since nobody is watching a terminal in the field. |
| Shared logic | `packages/domain` (plain TypeScript, no React Native dependency) | Interval continuity, recovery %, sample-overlap rules, and the role/permission matrix are computed identically on the phone and the web app — a QA/QC review on the desk can never disagree with what the phone itself calculated. |
| Icons/UI | `@expo/vector-icons`, `@expo/ui`, `react-native-reanimated`, `react-native-gesture-handler` | Native-feel gestures and animation for a UI meant to be used one-handed, in gloves, in bright sun. |

## Repository shape

```text
apps/mobile/
├─ src/
│  ├─ app/                 Expo Router screens (file-based routing): sign-in, work,
│  │                       project/hole detail, conflicts, account, feedback
│  ├─ data/                 repositories: one file per table/feature area
│  │  ├─ database.ts        opens the single encrypted PowerSync/SQLite connection everything else uses
│  │  ├─ migrations.ts      the local database's own schema history (separate from the server's Prisma migrations)
│  │  ├─ *Repository.ts     e.g. coreRepository, samplesRepository, custodyRepository — read/write for one feature, nothing else touches SQL directly
│  │  └─ encryptionKey.ts   fetches/creates the SQLCipher key from the phone's secure storage
│  ├─ sync/
│  │  ├─ connector.ts       PowerSync's upload/download contract: fetches a token, sends queued local changes to the server, handles the server's per-change response (applied / duplicate / conflict / rejected)
│  │  ├─ syncedTables.ts    which local tables are under PowerSync's control, and which columns are "set once" (never sent again after creation)
│  │  ├─ device.ts          registers this phone as a device on the account, so it can be revoked later
│  │  ├─ photoUploader.ts   uploads photo files separately, after their record has synced
│  │  └─ wipe.ts            clears the local database and photos on sign-out or "remove this device"
│  ├─ auth/                 session storage and the sign-in API call
│  ├─ guide/                the first-run guided tour (steps.ts is the script; guide-context.tsx drives it)
│  ├─ crash/                Sentry setup
│  ├─ feedback/             in-app "send feedback" (with an optional screenshot) to the admin inbox
│  ├─ components/           shared UI: the core log chart/ribbons, continuity strip, sync status badge, custody timeline, QC reminders
│  └─ constants/theme.ts    the app's colour tokens — the same palette the web app's design tokens were matched to
└─ app.json, eas.json        native build config: package name, permissions, EAS Build/Update channels
```

## How the app behaves with no signal

This is the part of the architecture that actually matters for the job the
app does, so it's worth walking through end to end.

1. A geologist opens the app at the rig, with no signal. Every screen — new
   hole, log an interval, log a run, take a sample, take a photo, custody —
   reads and writes straight to the local encrypted SQLite database through
   the matching repository in `src/data/`. Nothing here waits on the
   network; there is no "offline mode" toggle because there is no online
   mode to fall back from.
2. Every write to a table PowerSync is watching gets picked up automatically
   by change-tracking triggers PowerSync installed when the database opened.
   The app doesn't have to remember to "queue" anything — inserting a row
   *is* queuing it.
3. Each record shows a **synced / pending / needs attention** status, computed
   from that queue, so the geologist can always see at a glance what hasn't
   left the phone yet.
4. When a connection appears — even briefly — `connector.ts` does two things
   in parallel: it uploads the queued local changes in small batches
   (`/api/sync/upload` on the web app), and PowerSync separately streams
   down whatever rows changed elsewhere (a teammate's phone, or an edit made
   on the desk) that this account is allowed to see.
5. If the server refuses a change — most often because someone else changed
   the same record first — that record is marked **needs attention** with
   both the phone's version and the server's version shown side by side. It
   is never silently overwritten and never retried forever on its own; the
   `conflicts.tsx` screen is where a geologist resolves it.
6. Photos are handled separately from the record: the photo's metadata
   (hole, depth range, who took it) syncs through the normal path above,
   and the image file itself uploads afterwards, retried on its own until it
   succeeds — a failed image upload never blocks the record it belongs to.
7. Sample numbers are treated as physical tags: once issued, a sample number
   is never reused, even if the sample record is later deleted (marked
   removed — nothing in this app hard-deletes a synced record) — reusing a
   physical tag number would corrupt the chain of custody.

## Device security

- The SQLite file is encrypted with SQLCipher; the key is generated on first
  run and stored in the phone's Keystore, never in the app's source or a
  config file.
- The sign-in session and PowerSync tokens live in secure storage
  (`expo-secure-store`), not plain `AsyncStorage`.
- Signing out, or an admin revoking a device from the web app, wipes the
  local database and any locally stored photos — after warning the person if
  anything on the phone hasn't synced yet, so nothing is lost silently.
- An offline sign-in session expires after a configurable period (30 days by
  default); the server re-checks the account's access the next time the
  phone can actually reach it.

## Why this shape, if someone asks "why not X"

- **Why a real native build instead of Expo Go?** `op-sqlite`'s encrypted
  (SQLCipher) mode is a native module Expo Go doesn't ship with — there's no
  way to get an encrypted on-device database inside Expo Go, and an
  unencrypted field database holding assay and custody data wasn't
  acceptable.
- **Why PowerSync instead of a hand-rolled queue-and-retry sync?** The hard
  parts of offline-first — detecting local changes automatically, replaying
  them safely if a request is retried, and streaming down only the rows a
  given account is allowed to see — are exactly what PowerSync exists to
  solve. This codebase only had to write what's specific to CoreChain: the
  upload validation rules and the sync-stream queries.
- **Why one encrypted local database instead of separate stores per
  feature?** Every repository goes through the same `getDatabase()`
  connection on purpose (see `data/database.ts`) — PowerSync's
  change-tracking triggers only work through that one connection, so a
  second, parallel SQLite connection would silently fail to queue its writes
  for sync.
