# CoreChain mobile MVP — product and Scrum plan

> Status: approved plan, 2026-09-19. Source of truth for the mobile MVP build.
> Supersedes the "offline entry is not part of Phase 1" note in `corechain-phase-1-masterplan-prompt.md` for everything after Phase 1.

---

## 1. Product summary

### What CoreChain is

CoreChain is an offline-first workflow platform for exploration and mining teams. It keeps the chain between drilling, core logging, samples, custody, laboratory results and QA/QC decisions clear, connected and easy to trace. Teams keep working when there's no internet, then sync safely once they're connected again.

CoreChain supports geological teams. It does **not** replace professional geological judgement, resource estimation, mine planning, or modelling tools such as GEOVIA or Leapfrog. It protects the working evidence those tools rely on.

### The problem

Exploration evidence is spread across core-box markings, paper logging sheets, Excel logs, phone photos, chat messages, sample registers, dispatch documents and laboratory files. Simple but critical questions become slow to answer:

- Where did this sample come from?
- Which drillhole and depth interval does this assay result represent?
- Who handled the sample and when was it dispatched?
- Is a result complete, missing, or waiting for QA/QC review?

A single depth or sample-ID mismatch breaks confidence in the final assay and leads to hours of reconciliation.

### Where we are (Phase 1, complete)

A working Next.js web demonstration built on an attributed public Alberta drillhole dataset (commit `5299cfc`):

- Project workspace: overview, drillholes, samples, dispatches, assays and QA/QC.
- Drillhole records: collar details, planned vs actual, geological intervals and assay information.
- Sample traceability: sample → source interval → custody events → dispatch → matched assay.
- QA/QC views that surface unmatched or review-needed results.
- Source provenance and audit-oriented views, including explicit handling of missing source data.
- Product research, pilot materials and workflow docs for Philippine exploration and mining teams.

The demo is read-only and runs from CSV fixtures behind a server-only repository (`lib/repositories/alberta-demo-repository.ts`). It has no database, no auth and no offline capability.

### Measure of success

A geological team can trace a sample from its assay result back to its drillhole and depth interval quickly, understand what happened to it, and **keep recording field work with no internet connection**.

---

## 2. MVP definition

### Who tests it

**Primary persona: the field geologist working alone.**

- Works at the rig or in the core yard, often with no signal for days.
- Logs core, chooses sample intervals, inserts QC samples, bags and hands over samples.
- Uses an Android phone or rugged tablet, sometimes in the sun and with dirty gloves.
- Currently uses paper logging sheets and Excel, and transcribes them in the evening.

**The constraint that shapes the MVP:** there is **no project manager or administrator** in the test. Nobody sets up an organisation, invites users, defines code lists, writes a work plan or sets deadlines. The geologist installs the app and does everything themselves.

So the MVP must be **self-serve**:

| Normally done by an admin                         | In the MVP                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Create the organisation and invite users          | Sign-up creates a personal workspace; the geologist owns it                         |
| Define geology code lists                         | Starter code library bundled with the app, editable by the geologist                |
| Set sampling rules (ID format, QC insertion rate) | Per-project settings the geologist fills in when creating the project               |
| Assign projects to users                          | The geologist creates their own projects                                            |
| Approve records                                   | No approval step; every change is recorded in history instead                       |
| Work plans and deadlines                          | Out of scope; a drillhole status (planned → drilling → complete → logged) is enough |

The data model still carries `organization_id` and a membership/role table, so teams, invites and roles can be added later **without migrating data**.

### In scope: the field chain

```text
Project → Drillhole → Core boxes & runs (recovery, RQD) → Interval logging → Photos
        → Samples (incl. standards, blanks, duplicates) → Custody → Dispatch → CSV export
                                  ↘ everything works offline, then syncs to cloud backup
```

### Out of scope for the MVP (and why)

| Item                                     | Reason                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Assay import and QA/QC review            | Desk work; lab results arrive weeks after the field test starts. Stays on the web app (Phase 1 views).                  |
| Organisations, invites, roles, approvals | Need an admin, and the test has none. The schema is ready for them.                                                     |
| QR scanning and label printing           | Listed in "validate before building" (`docs/discovery/mvp-validation-brief.md`). A typed sample tag is enough to learn. |
| iOS                                      | Philippine field teams mostly carry Android. Skipping it avoids Apple review and cost during the pilot.                 |
| Maps, sections, 3D                       | Specialist tools do this; CoreChain exports to them.                                                                    |
| Work plans and deadlines                 | Need a manager, and the test has none.                                                                                  |

---

## 3. Decisions log

| #   | Decision                                                                                                                                                         | Why                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | The field product is a **native mobile app** (Expo / React Native), not a web app or PWA                                                                         | Offline reliability in core yards with no signal is the core promise. A native app gets a real local database, encryption at rest, background sync and the camera.                                                                                                                    |
| D2  | **Android first**; iOS later                                                                                                                                     | Matches the devices of the target users and removes App Store friction from the pilot. Confirmed 2026-09-22: exploration geologists are expected to carry rugged Android phones for fieldwork, not iPhones, so an iOS tester is treated as unlikely rather than planned for. `app.json` has no iOS configuration yet, iOS builds need a Mac (this is a Windows setup), and there is no free sideload path on iOS the way an APK works on Android — an Apple Developer account (US$99/yr) would be needed the day an iOS tester actually shows up. A browser/PWA workaround was considered and rejected: op-sqlite's encrypted local database does not run in a browser, so a browser version would mean either a second, weaker offline layer or a version that needs a live connection the whole time — which stops being a real test of an offline-first app. |
| D3  | **Two apps, one backend.** Mobile for field roles; the existing Next.js web app for desk roles (admin, assay import, QA/QC review)                               | Field roles work offline on phones; desk roles work online on laptops. There's no point rebuilding desk screens on mobile.                                                                                                                                                            |
| D4  | **PowerSync** for sync: Postgres to on-device SQLite; uploads go through our own API                                                                             | The server validates every write and re-checks permissions, and we don't build sync plumbing ourselves. The fallback if it's rejected is `expo-sqlite` + Drizzle + our own outbox.                                                                                                    |
| D5  | **Better Auth**, with its Expo integration; tokens in Android Keystore via secure storage                                                                        | Organisations and roles are available when needed later. Sign in once online, then an offline session with an expiry applies.                                                                                                                                                         |
| D6  | **IDs are generated on the device** (UUIDs). Human-readable sample numbers come from **pre-issued blocks per device**                                            | A phone with no signal can't ask a server for the next number. The blocks work like the paper sample-ticket books core yards already use.                                                                                                                                             |
| D7  | **Custody events are append-only.** Edited records carry a `version`; a stale edit becomes **"needs attention"** instead of overwriting                          | Traceability can't tolerate last-write-wins data loss.                                                                                                                                                                                                                                |
| D8  | **Offline-first with cloud backup, in two stages.** Sprints 1–3 are offline-only on a schema ready for sync; Sprints 4–5 add sync before any tester relies on it | Losing a phone must not mean losing a hole's log. Staging still gets an installable build onto a device early.                                                                                                                                                                        |
| D9  | **Self-serve MVP**: personal workspace, bundled editable code library, per-project settings                                                                      | The testers are field geologists working alone, with no admin.                                                                                                                                                                                                                        |
| D10 | **The whole field chain is in the MVP**; assay and QA/QC stay on the web                                                                                         | The geologist does all the field steps personally, so a partial chain wouldn't test the real day.                                                                                                                                                                                     |
| D11 | **Encrypted local database** (SQLCipher via op-sqlite, PowerSync's built-in storage adapter)                                                                     | Exploration data is commercially sensitive, and phones get lost in the field. Package compatibility and the toolchain (prebuild → real Gradle project) are confirmed by the Sprint 0 spike; on-device read/write is confirmed in Sprint 1's E8-1 instead, once a device is available. |
| D12 | **2-week sprints**, each ending in a demo build on a real Android device                                                                                         | Standard cadence, and it proves every increment on real hardware.                                                                                                                                                                                                                     |
| D13 | **Pilot accounts are created by the owner**; open sign-up stays off during the field test | Testers get a ready account (their own email and a first password) instead of registering. That keeps strangers out of the cloud database while the product is unproven, and each tester still has their own separate workspace, so their data and sample-number blocks stay theirs. Self-serve sign-up (D9) is switched on before any public release. |
| D14 | **The phone keeps its own tables and syncs into them with PowerSync raw tables** | Proven on the phone in the Sprint 4 spike: PowerSync opened the app's own encrypted database, downloaded a project into the existing tables, and the app showed it without any screen change. The fallback of moving the repositories onto PowerSync-managed tables is not needed. |
| D15 | **Five tiers: field geologist, QA/QC, laboratory, resident / project manager, admin** | These are the people who touch a hole's evidence, in the order the chain runs (the operations document says QA/QC starts in the field and continues through sampling, custody and the lab, so it is not one sign-off role). Admin is not a mining role: it looks after accounts. Only admin has extra rights today; the other tiers are stored and used to choose what each person sees and which guide they get. QA/QC is expected to be scoped to a stage (core and logging, sampling and custody, laboratory and assays); the scope is added with the QA/QC screens, after the field test. |
| D16 | **Testers install a signed APK sent directly, not through Google Play internal testing** (2026-09-23) | A tester may want to keep their own copy of the app going forward, and listing it on the Play Store could work against that. This is separate from, and does not require resolving, the unfunded Play developer account (E10-4 stays deferred either way). |
| D17 | **A team is the people working around one drill rig, not one hole** (2026-09-25, owner) | They work the rig's holes one after another. The real make-up is not known and is probably several parties with their own decision-making (for example the company's geologists, the drilling contractor, the laboratory and management) that appear as one team in the app. Only the people whose work touches CoreChain get an account, each with one role set by the admin. The app does not fix which roles or companies make up a team. There is no rig record yet; adding one (for example a rig on each hole) is a separate decision. |

---

## 4. Architecture

### Repository layout (after Sprint 0)

```text
CoreChain/
├─ apps/
│  ├─ web/        # current Next.js app, moved unchanged (Phase 1 demo + later desk features + API)
│  └─ mobile/     # Expo (React Native, TypeScript, Expo Router) field app
├─ packages/
│  └─ domain/     # shared types, zod schemas, validation rules, permission matrix
└─ package.json   # npm workspaces
```

`packages/domain` starts from `lib/domain/corechain.ts` and holds the logic both apps have to agree on:

- interval continuity (no gaps, no overlaps)
- recovery % and RQD calculation
- sample-overlap rules
- QC insertion reminders
- the future permission matrix

### Runtime

```text
 Android app (Expo)                          Cloud
┌──────────────────────────┐        ┌──────────────────────────────┐
│ UI (Expo Router)         │        │ Next.js API (apps/web)       │
│ Encrypted SQLite         │ upload │  ├─ Better Auth (sign-up/in) │
│  (PowerSync client)      │ ─────► │  ├─ write validation         │
│ Photo files (local)      │        │  └─ Prisma → PostgreSQL      │
│ Secure token storage     │ ◄───── │ PowerSync service            │
└──────────────────────────┘ stream │  (Postgres → device SQLite)  │
                                    │ Object storage (photos)      │
                                    └──────────────────────────────┘
```

### Sync rules (MVP)

- Every syncable table has `id` (UUID), `organization_id`, `project_id`, `created_at`, `updated_at`, `version`, `deleted_at` and `created_by`.
- The device only downloads projects the user belongs to. In the MVP, those are the user's own.
- Uploads are idempotent: replaying the same mutation is safe.
- The server rejects a stale version, and the record shows **needs attention** with both values side by side.
- Every write also creates an audit event (who, what, when, which device).
- Photos upload separately from records and are retried until they succeed.
- Sync status on each record is shown as **synced / pending / needs attention**.

### Device security

- Encrypted SQLite (SQLCipher key held in the Keystore).
- Auth tokens in secure storage.
- Sign-out and "remove this device" wipe the local database and photos, after warning if any unsynced records remain.
- The offline session expires after a configurable period (default 30 days). The server re-checks access on the next sync.

---

## 5. Scrum setup

### Roles

| Scrum role           | Who                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------- |
| Product Owner        | Project owner (Jorge). Owns the backlog order and accepts stories.                  |
| Development team     | Project owner + Claude Code                                                         |
| Scrum Master duties  | Shared: Claude keeps the ceremonies, the burndown and the Definition of Done honest |
| Stakeholders / users | Field geologists (reviewers from Sprint 3; testers in Sprint 6)                     |

### Ceremonies (sized for a very small team)

| Ceremony           | When                                           | Output                                                            |
| ------------------ | ---------------------------------------------- | ----------------------------------------------------------------- |
| Sprint planning    | Day 1 of each sprint, ~1 hour                  | Sprint goal + committed stories                                   |
| Daily log          | Each working day, 3 lines: done, next, blocked | Written in the sprint log                                         |
| Backlog refinement | Mid-sprint, ~30 min                            | Next sprint's stories meet the Definition of Ready                |
| Sprint review      | Last day                                       | Demo on a real Android device; with a geologist whenever possible |
| Retrospective      | Last day, after the review                     | One thing to keep, one to change                                  |

### Definition of Ready (a story can enter a sprint when…)

- It's written as "As a field geologist, I want… so that…".
- It has testable acceptance criteria.
- It's estimated, and no larger than 8 points (split it otherwise).
- The data fields and validation rules it needs are known.

### Definition of Done (a story is done when…)

- All acceptance criteria are met.
- Unit tests cover domain rules in `packages/domain`. Screens have at least one test for the happy path.
- Lint, typecheck and tests pass in CI.
- **It works in airplane mode on a real Android device.**
- No data is lost when the app is killed mid-edit.
- Sync-ready fields (`id`, `version`, `updated_at`, `deleted_at`) are present on any new table.
- The Product Owner has accepted it at the sprint review.

### Estimation and tracking

- Story points: Fibonacci (1, 2, 3, 5, 8). A story over 8 points gets split.
- Planning capacity: start at ~20 points per 2-week sprint, then adjust to the measured velocity after Sprint 2.
- The backlog lives in this document until Sprint 1 planning. After that, it is mirrored into GitHub Issues + a GitHub Project board for `jjtzoo/CoreChain`, with one issue per story and labelled by epic.

---

## 6. Product backlog

Format: **ID — story (points)**, followed by acceptance criteria. Stories are listed in priority order within each epic.

### E1 — Account and workspace

**E1-1 — Create a project on my phone (3)**
As a field geologist, I want to create a project with its name, commodity, location, coordinate system and sample-ID prefix, so that my drillholes and samples are grouped and correctly referenced.

- Works fully offline.
- Required: name and coordinate system (a picker offering WGS84 and the PRS92 / UTM zones used in the Philippines). Commodity, location and sample prefix are optional.
- The project appears in the project list straight away and survives an app restart.

**E1-2 — Project settings for sampling rules (3)**
As a field geologist, I want to set my sample-ID prefix, the next sample number and a QC insertion rate, so that the app follows my sampling procedure without an admin.

- The prefix and starting number produce IDs like `CC-000184`.
- QC insertion rate is "every N samples" (default 20) for standards, blanks and duplicates, each configured separately.
- Changing the settings doesn't renumber existing samples.

**E1-3 — Sign up and sign in (5)** _(Sprint 4)_
As a field geologist, I want to create an account with my email and password, so that my work is backed up and tied to me.

- Sign-up creates a personal workspace with me as its owner.
- Projects created before sign-up (offline alpha) are attached to the account on first sign-in.
- Clear error messages for a wrong password, no connection, or an email already in use.
- **Pilot (D13):** the owner creates each tester's account; the app has a sign-in screen and no "create account" screen until self-serve is switched on. One account per tester, never shared, so data stays separate and attributable.

**E1-4 — Stay signed in offline (3)** _(Sprint 4)_
As a field geologist, I want to keep working for weeks without signal after signing in once, so that the app never locks me out at the rig.

- The offline session lasts 30 days (configurable). The app warns 3 days before it expires.
- An expired session keeps local data readable, but it can't sync until I sign in again.

**E1-5 — Sign out and wipe the device (2)** _(Sprint 5)_
As a field geologist, I want signing out to remove my data from the phone, so that a shared or lost device doesn't leak project data.

- It warns and shows a count if unsynced records exist, and asks me to confirm.
- It deletes the local database, photos and tokens.

### E2 — Drillholes

**E2-1 — Create a drillhole (5)**
As a field geologist, I want to create a drillhole with its ID, collar location, planned azimuth, dip and depth, so that everything I log hangs off the right hole.

- The hole ID is unique within the project; a duplicate is blocked with a clear message.
- The collar comes from phone GPS (showing its accuracy) or manual entry in the project's coordinate system.
- Validation: azimuth 0–360, dip −90 to 90, planned depth > 0.
- Optional fields: drill type, contractor, core diameter and notes.

**E2-2 — Record actual hole details (3)**
As a field geologist, I want to record the start and end dates and the actual final depth, so that planned vs actual is captured.

- Planned and actual values are kept as separate fields and shown side by side.
- The actual final depth can't be less than the deepest recorded box, run or interval (the app warns if it is).

**E2-3 — Drillhole status (2), redesigned 2026-09-23**
As a field geologist, I want to see where each hole stands (planned → drilling → complete → logged), without having to remember to set it myself.

- Status is computed from what's actually recorded — a box, run or interval; actual dates or a final depth; full logging coverage — never picked by the geologist. See the S6 outcome log for why.
- Every status change is still recorded in the history, with the time.

**E2-4 — Drillhole list and search (3)**
As a field geologist, I want a list of holes with status, depth and logging progress, and search by hole ID, so that I can find a hole quickly.

- Logging progress = the logged metres ÷ the actual (or planned) depth.
- The list is usable one-handed and readable in sunlight (large targets, high contrast).

### E3 — Core boxes and runs

**E3-1 — Register core boxes (3)**
As a field geologist, I want to register each core box with its number and from/to depth, so that boxes are traceable to depth.

- "Next box" pre-fills from the previous box's end depth.
- The app warns about gaps and overlaps against the other boxes in the hole.

**E3-2 — Record core runs and recovery (5)**
As a field geologist, I want to enter each run's from/to depth and recovered length, so that recovery % is calculated for me.

- Recovery % = recovered ÷ drilled length, rounded to 1 decimal.
- A recovered length greater than the drilled length is flagged, not silently accepted.
- Run continuity warnings work the same way as for boxes.

**E3-3 — RQD per run (3)**
As a field geologist, I want to enter the total length of pieces ≥ 10 cm for a run, so that RQD is calculated.

- RQD % = sum of pieces ≥ 10 cm ÷ drilled length.
- The calculation lives in `packages/domain`, with unit tests including edge cases (0 recovery, full recovery).

### E4 — Core logging

**E4-1 — Starter code library (3)**
As a field geologist, I want ready-made pick-lists for lithology, alteration (type and intensity), mineralisation (mineral, style, %), weathering and structure type, so that I can log with no admin setup.

- Bundled with the app; works offline on first launch.
- Each code has a short code and a description (e.g. `AND` — Andesite).

**E4-2 — Edit my code library (3)**
As a field geologist, I want to add, rename or hide codes, so that the lists match my project.

- Hiding a code keeps it on existing intervals but removes it from new pick-lists.
- A code that's in use can't be deleted.

**E4-3 — Log an interval (8)**
As a field geologist, I want to log a from/to interval with lithology, alteration, mineralisation, weathering, structure notes and free text, so that my geological log is captured at the rig.

- From pre-fills from the previous interval's To.
- Pick-lists come from the code library, and free text is always allowed.
- Autosaves as I type; killing the app loses nothing.

**E4-4 — Continuity validation (3)**
As a field geologist, I want the app to show gaps and overlaps in my log, so that I can fix them before the hole is signed off.

- A visual strip of the hole shows logged, gap and overlap segments.
- Validation lives in `packages/domain` and is shared with the web app.

**E4-5 — Copy previous interval (2)**
As a field geologist, I want to copy the previous interval's codes into a new one, so that I don't re-enter repeated geology.

- Copies every code except from/to depth and free text.

**E4-6 — Graphic hole log (5)** _(built 2026-09-21, installed on the test phone; awaiting a geologist's review)_
As a field geologist, I want to see my hole as a picture, so that I can read the geology at a glance and spot mistakes without scrolling a list of codes.

- Added after owner feedback that the phone app "feels like just an input app": the core log is today a list of codes such as "AND · ARG3 · PY 1%".
- A vertical strip log by depth, with side-by-side columns for lithology, alteration and mineralisation, coloured from the code library, plus recovery and RQD bars from the core runs.
- Tap a segment to open that interval; pinch or scroll to move along the hole; works offline from the data already on the phone.
- Shown on the hole screen and as a landscape view; the shareable image of the log is a later option.
- Built: a compact "Hole log" card with three ribbons on the hole screen, and a full strip log (Overview, Standard and Detail scales; tap a stretch for its codes, descriptions and notes, then open it in the core log). Alteration and mineral bars are wider for stronger alteration or more mineral. Not yet built: pinch to zoom, landscape view, the shareable image.
- Best shown with the synthetic Cordillera porphyry sample (`apps/web/data/demo/synthetic-cordillera-porphyry`), where alteration and mineralisation change clearly with depth.

**Appearance switch (small, built 2026-09-21).** Account has Match phone, Light or Dark, remembered on the phone, so a geologist can force the light theme (tuned for bright sun) when the phone is in dark mode. Row actions on lists are now at least 52 dp with extra space before the delete button, which already asks for confirmation.

### E5 — Photos

**E5-1 — Take core tray photos (5)**
As a field geologist, I want to photograph a core box from inside the app, linked to that box, so that photos can't get separated from their depth.

- The camera opens in the app. The photo is saved against the box with its hole ID, box number, depth range and timestamp.
- It's compressed to a configurable size (default ~1–2 MB) and stored locally.

**E5-2 — Photo per interval (2)**
As a field geologist, I want to attach a close-up photo to a logged interval, so that notable features are evidenced.

**E5-3 — Photo sync (3)** _(Sprint 5)_
As a field geologist, I want photos to upload when I'm connected, so that they're backed up without me thinking about it.

- Uploads happen separately from records; each photo shows its own pending/synced state.
- Uploads resume after failures and don't block record sync.
- Optional setting: sync photos only on Wi-Fi.
- **Storage decision (2026-09-21):** photo files are kept in a private Vercel Blob store named `corechain-photos` (Washington region, free Hobby plan; nothing is reachable by link). Free-plan limits: 1 GB of storage (about 650 photos at 1.5 MB), 2,000 uploads a month, and if a limit is reached, uploads pause for up to 30 days without any charge. Fine for a small pilot; a paid plan is needed for the full field test. Before a paid pilot, check Vercel's terms on commercial use of the free plan.
- **Server half built and deployed 2026-09-21:** `PUT /api/photos/{id}/file` accepts the image after the photo's record has synced (type, 4 MB limit, truncated-upload and ownership checks) and records where it is kept in the existing `photos.storage_key` column, so no database change was needed; `GET` returns it to the owning account only. Sending the same photo again replaces it. If storage is not connected the answer is a clear "storage-not-configured". Not yet exercised with a real upload.
- **Phone half built 2026-09-21, not yet run on the phone.**
  - A local-only table `photo_uploads` (phone database version 12) keeps each photo's score: not tried, waiting, sent, failed, or no file on this phone. It is cleared by a wipe.
  - `sync/photoUploader.ts` sends up to five photos per pass with `PUT /api/photos/{id}/file`, after the photo's record has synced. The server answers "not found" until then and the phone tries again. It runs whenever the phone is connected and has finished its first download, right after each sync completes (ignoring any wait), and otherwise only for photos whose wait is over. Waits grow 20 s, 1 min, 5 min, 15 min, then 30 min.
  - The rules (what each server answer means, the waits, the plain-words summary) are in `packages/domain/src/photoBackup.ts` with tests. A refused file (wrong type or over 4 MB) is marked "Could not back up" and never retried; no answer at all is never held against the photo.
  - Each photo shows "Backed up", "Waiting to back up" or "Could not back up". The Account screen has a **Photo backup** card with a count line, the **Any connection / Wi-Fi only** choice (uses the new `expo-network` module, so it needs a new build), and **Back up now**.
  - The sign-out warning now counts only photos that are not backed up yet.
  - Known gap: deleting a photo on the phone does not yet remove its file from the storage (a small orphan; the 1 GB free allowance makes this minor for a pilot).
  - **Verified on the test phone 2026-09-21:** a photo taken against CDL-001 Box 1 showed "Backed up" about four seconds after the shutter. The server row for that photo then held the storage location and a size of 267,162 bytes, matching the 261 KB on the phone, so the sign-in cookie is accepted on the upload and the file reached the private store. The test photo was then deleted on the phone (its stored copy stays in the store, see the known gap). Then, on the same phone: a photo taken in airplane mode showed "Waiting to back up" and turned to "Backed up" by itself within a minute of the signal returning, and the server held it at the same size. With **Wi-Fi only** chosen and Wi-Fi switched off, a photo stayed "Waiting to back up" on mobile data (the Account card said "Waiting for Wi-Fi, as you chose") and went up about 9 seconds after Wi-Fi came back.
  - **Two problems found and fixed during that test.** (1) On the first run one upload was left hanging when the phone moved from mobile data to Wi-Fi, and because passes never overlap it held every later pass, including "Back up now", behind it. Each upload now gives up after 90 seconds and is retried. The hang did not happen again on the second run, so the time limit is a safeguard that has not yet been seen rescuing a stuck upload. (2) A chip that turns bold when chosen was cut short by Android ("Wi-Fi only" showed as "Wi-Fi"); chips now keep one label weight, which also stops them changing width when tapped. This affects every chip in the app.
  - Not yet tried: a refused file, and "Back up now" completing a real upload (it was pressed while the first hang was in progress). The test photos were deleted on the phone; five stored copies (about 1.6 MB) remain in the store.

### E6 — Sampling

**E6-1 — Create a sample from an interval (5)**
As a field geologist, I want to create a sample from a logged interval or a typed depth range, so that every sample is tied to its exact depth.

- It gets the next ID from the device's block (or I type the pre-printed tag number).
- A sample must fall inside the hole's depth; overlapping primary samples are blocked.
- Sample type: primary, standard, blank or field duplicate.

**E6-2 — QC inserts (5)**
As a field geologist, I want to insert standards, blanks and duplicates, with a reminder when one is due, so that my QC insertion rate is met.

- A standard records the reference material ID. A duplicate records its parent sample.
- The reminder follows the project's "every N samples" setting and can be dismissed with a reason.

**E6-3 — Sample register (3)**
As a field geologist, I want a list of samples per hole with type, depth, status and QC flag, so that I can check my sampling at a glance.

- Filters: hole, type, status. It shows the QC insertion rate achieved against the target.

**E6-4 — Device sample-number blocks (3)** _(Sprint 4)_
As a field geologist, I want my phone to hold a reserved block of sample numbers, so that two devices never create the same ID while offline.

- The block is reserved at sign-in or sync; the app warns when fewer than 20 numbers remain.
- Before sign-up (the offline alpha), numbers come from the project settings (E1-2).

### E7 — Custody and dispatch

**E7-1 — Record custody events (3)**
As a field geologist, I want to record when samples are bagged, sealed and handed over (to whom, where, when), so that the chain of custody is unbroken.

- Events can be recorded in bulk on selected samples.
- Events are append-only: a mistake is corrected with a new "correction" event, never an edit.

**E7-2 — Create a lab dispatch (5)**
As a field geologist, I want to group samples into a dispatch with its lab, preparation request and handover date, so that I know exactly what went to the lab.

- A sample can be in only one open dispatch.
- Dispatching adds a "Dispatched" custody event to every sample in it.

**E7-3 — Share a dispatch sheet (3)**
As a field geologist, I want to generate a dispatch sheet (PDF or CSV) and share it through the phone, so that the lab and my office get the same list.

- It lists every sample ID, type, hole, depth range and QC type, with the totals.
- It's shared through the Android share sheet (email, messaging, Drive).

**E7-4 — Sign-off on handover (proposed, not in a sprint yet)**
As a field geologist, I want the handover to a courier or laboratory to carry a sign-off tied to my account, so that the record shows who took responsibility for the samples.

- Bagging and sealing stay one tap plus a form; no signature is asked for them.
- Traceability is the account, not a drawn signature. The server already stamps the signed-in account on every custody record it receives, and the phone cannot set or change it.
- "Handled by" stays as the person who physically did the step (it defaults to the account holder, and can differ when a helper bagged the samples). "Recorded by" is the account, and is shown on each step and as a column on the dispatch sheet.
- Handover and dispatch show a confirmation statement ("I confirm these samples were handed over as listed") and record it against the account, with the time.
- Later, only if a laboratory or auditor asks for it: the person receiving draws their signature on the screen.
- To validate before building: ask the friendly geologist and the resident manager whether a signed handover is what their laboratories and auditors expect, and whether the receiver's signature is wanted.

### E8 — Offline and sync

**E8-1 — Encrypted local database (5)** _(Sprint 1)_
As a field geologist, I want my data stored encrypted on the phone, so that a lost phone doesn't expose project data.

- SQLCipher, with the key in the Android Keystore. Confirmed in the Sprint 0 spike.

**E8-2 — Initial download (5)** _(Sprint 4)_
As a field geologist, I want my projects downloaded to the phone after I sign in, so that I can work offline on any device I use.

**E8-3 — Upload sync (8)** _(Sprint 5)_
As a field geologist, I want my changes to sync by themselves when I'm connected, so that my work is backed up without effort.

- Syncs on reconnect and on app open, plus a "Sync now" button.
- Idempotent: interrupted syncs never duplicate records.

**E8-4 — Sync status badges (3)** _(Sprint 5)_
As a field geologist, I want each record, and the app overall, to show synced / pending / needs attention, so that I always know what's safe.

- The header shows "last synced" time and the number of pending records.
- **Built 2026-09-21 (the per-record part).** Home, the project's hole list, the samples list and the dispatch list show a small "Waiting to send" line under a record that has not reached the server, and "Needs attention" (in the warning colour) when the server refused a change to it. A sent record shows nothing, so the lists stay calm. A hole counts as waiting when it or anything filed under it is (a box, run, interval, photo, status change or sample); a sample when it or its custody steps or dispatch links are; a dispatch when it or its sample links are; a project when anything in it is. The rules are in `packages/domain/src/recordSync.ts` (tested); the query that finds the records is `apps/mobile/src/data/syncMarkersQuery.ts` (tested here against a scratch database for every one of those cases, not only on the phone). It refreshes every five seconds.
  - **Verified on the test phone:** in airplane mode a photo taken on CDL-001 made CDL-001 show "Waiting to send" and the other holes stayed clean; after the signal returned the line disappeared within 25 seconds. The overall line ("Working offline", "Up to date") already existed.
  - **Not yet checked on the phone:** the Home project row and the samples and dispatch lists while waiting, and the "Needs attention" colour (it needs a change the server refuses). Not built: a status line on a record's own screen (the wording exists as `recordSyncDetail`).

**E8-5 — Resolve conflicts (5)** _(Sprint 5)_
As a field geologist, I want to see and resolve records the server rejected, so that nothing is silently lost.

- Shows my version and the server version side by side; I pick one or merge the fields.
- **Built 2026-09-21.** The server now returns its current values when a change conflicts (code only, no database change). The phone keeps both versions in its local issue list. Account shows "Review and choose"; the Review changes screen lists each field that really differs with "Mine (this phone)" and "On the server", plus "Use all mine" and "Use all the server's". The server's version is preselected, so nothing is overwritten by accident. Saving writes the choice as a new edit one version above the server's, which uploads and wins cleanly.
- **Tested end to end on the real phone and server:** the phone was taken offline and a synthetic hole's status was changed to Complete; the same hole was set to Drilling on the server; on reconnect the phone showed the conflict, and choosing "mine" left the server on Complete at version 3. Not yet tried with two real phones.
- Known limit: a conflict recorded before this build has no saved versions, so it shows only the old "kept for review" note.

### E9 — Export

**E9-1 — CSV export (5)**
As a field geologist, I want to export collars, surveys (planned azimuth/dip), lithology log, runs (recovery/RQD), samples and dispatches as CSV, so that I can load them into Excel, Leapfrog or GEOVIA.

- One file per table with stable column names. Hole ID and from/to columns follow the conventions those tools import.
- It's shared through the Android share sheet and works offline.
- Not yet tried in Leapfrog or GEOVIA, so the app does not claim it. During the field test, ask a geologist to import a real export and record what needed changing.

### E10 — Test support

**E10-1 — First-run guide for the field geologist (8)**
As a new field geologist, I want a short guided walkthrough on my phone, so that I can start without training.

- Walks through a project, a hole, a box and run, an interval, a photo, a sample and the export, on a **practice project** the person can delete.
- Works with no signal, uses the real screens with short hints (no video), and can be replayed from the Account screen.
- The app picks the guide from the person's tier. Written after the friendly-geologist alpha, so it explains what a real person got stuck on. The field-day PDF stays linked.
- Guides for the other tiers (QA/QC, laboratory, resident / project manager) ship with their own screens after the field test: a guide for a screen that doesn't exist yet would be wrong.

**E10-2 — In-app feedback (3)**
As a tester, I want to send feedback from any screen, so that problems are reported in context.

- A "Send feedback" action on the Account screen and on every screen's menu. Choose bug, idea or question; type a message; a screenshot of the current screen is attached when the person allows it.
- The app adds what the tester should not have to type: app version, phone model, the screen, the person's tier, and the time.
- Queued offline and sent when connected (with a plain "will send when you have signal" note). Never blocks the screen the person was on.

**E10-3 — Crash reporting and version (2)**
As the Product Owner, I want crash reports with the app version and device, so that field failures can be fixed.

**E10-4 — Field-test release (3)**
As the Product Owner, I want signed builds on Google Play internal testing, so that testers install and update easily.

**E10-5 — Admin first-run checklist (2)**
As the admin, I want a short checklist on the Users page, so that I can set up my first testers without help.

- Steps: add a user, choose their tier, send them the login. It disappears once done and can be shown again.

**E10-6 — Tester feedback inbox (admin, web) (3)**
As the admin, I want to see everything testers send, in one place, so that I can triage it and tell testers what happened.

- A Feedback page in the admin area: newest first, filter by category, tier, app version and status. Each item shows the tester, tier, version, phone model, screen and screenshot.
- Status per item: new, seen, planned, done (with a note the tester can see later). Export to CSV for the field-test review.
- Counts by screen and category, so the screens people struggle with stand out (this feeds the field-test metrics in section 8).
- Web testers can send feedback from the admin and web pages with the same form.

**E10-7 — Over-the-air patches (3)**
As the Product Owner, I want to fix a screen, a wording or a bug on testers' phones without them reinstalling, so that a problem found in the field is fixed within a day, not a week.

- Uses `expo-updates` (Expo's own update service to begin with; a self-hosted server is possible later). Patches change the app's screens, logic and images only. Anything native (a new permission, a new library, an Android or Expo upgrade) still needs a new build through Play.
- The app checks when it opens, downloads quietly and applies the patch on the next start. If a patch fails to load, the app falls back to the version it shipped with.
- Patches are signed, so the phone only accepts ours. The signing key is an owner-held secret, like the Play upload key.
- A patch is only offered to builds it is compatible with (one runtime version per native build), and patches that touch the phone's database are forward-only and tested against a copy of an older database first.
- Needs one new native build that includes `expo-updates`, so it must land in the **first tester build**, not after. The owner creates a free Expo account and signs in; free-plan limits are to be checked before relying on it.

**E10-8 — Update prompt and minimum version (2)**
As a field geologist, I want to be told when my app is too old to sync, so that I never lose work to a silent failure.

- The server states the oldest app version it still accepts. Below it, the app says "Update CoreChain to keep syncing" and keeps working offline. It never locks anyone out of their own data.
- A phone that was offline for weeks and missed patches still syncs, because the server keeps accepting older versions for as long as its database changes stay compatible.

### Team release (originally "after the field test"; started early, 2026-09-22 — see decision below)

The project-manager dashboard and the QA/QC interface are part of the product, not an afterthought: the landing page and the tiers (D15) already promise them. They were originally planned to wait until real field data was flowing and testers had shown what a manager and a QA/QC reviewer need first. Each brings its own guide (E10-1), written when its screens exist.

**Decision, 2026-09-22 (owner):** a contact close to a resident-mine-manager hire reached out, so the owner chose to start E11 now rather than wait for field data, and to start E12 and E13 on the same basis — lack of field data is not, on its own, a reason to hold them back, especially with the open Alberta Geological Survey dataset (AGS DIG 2024-0022, already used for the Phase 1 demo and the sample project) available to build and demo QA/QC and laboratory screens against in the meantime. Real field data from actual testers still matters for validating that these screens match how a real manager, QA/QC reviewer or laboratory actually works — that validation is deferred, not the building. The mockup-before-build step for E11-2 (below) still applies to what the mockup covers; the two stories added below go beyond what the mockup or any written story described, and were scoped directly from the owner's own direction in conversation rather than from a mockup.

**E11 — Resident / project-manager dashboard (web; phone "Team" tab later)**

- **E11-1 — Teams (5). Built 2026-09-22; sync streams deployed 2026-09-22.** The admin groups accounts into a team (an organization, decision D9): geologists, QA/QC, laboratory and a resident / project manager. The sync streams change from "projects I created" to "projects my team owns", using the `organization_id` already on every row. The `with:` subquery form drafted earlier in the day did not validate as written: PowerSync only allows a subquery in an `IN (...)` position, not `= (...)`, and does not support `COALESCE`. Fixed to `organization_id IN (SELECT CASE WHEN organization_id IS NULL THEN id ELSE organization_id END FROM "user" WHERE id = auth.user_id())`, which validates and is now deployed as Sync Streams version 4. The owner also ran, in Neon: `GRANT SELECT ON "user" TO powersync_role;` and `ALTER PUBLICATION powersync ADD TABLE "public"."user";` (the `user` table had never been read by a sync rule before this). Still not checked on a real phone — the disconnected test phone needs to reconnect and re-sync to confirm a team member actually receives their team's projects, not just their own.
- **E11-2 — Team overview (5). Built 2026-09-22.** As a project manager, I want one screen of my team's holes with progress (metres logged of planned, core recovery, percentage logged), samples waiting to be bagged or dispatched, who logged what, and when each phone last synced, so that I know where things stand without chasing updates. Read-only; the data appears after a phone syncs. Mockup (overview and hole view, with questions for a resident manager): `docs/product/mockups/team-overview.html`; tried against the mockup's shape, not yet with a real manager. **Built:** metres logged vs. planned, the holes list with status, average core recovery per hole (reusing `recoveryPercent`, core.ts), samples waiting to bag vs. waiting to dispatch, who logged each hole (every geologist with a run, interval or sample on it), and a Devices card showing each phone's owner and last-synced time. **Verified in code** (typecheck, lint, the full test suite, and a production build all pass) but **not yet clicked through by the owner** — I cannot sign in myself (no password rule).
- **E11-3 — Activity feed (3). Built 2026-09-22.** `/team/activity`: what changed in the last 24 hours (every log interval, run, sample and custody event, newest first, who did it and on which hole), and a "Needs attention" side panel listing holes still being worked (planned or drilling) with no new evidence in over 7 days, plus devices quiet for more than 21 days (reusing `deviceStaleExceptions` from qaqc.ts — the same generous, offline-is-normal framing as QA/QC). **Verified in code**, not yet clicked through by the owner.
- **E11-4 — Hole view (3). Built 2026-09-22.** `/team/holes/[holeId]`: a read-only view of one hole — every core run with its recovery %, every logged interval, every sample with its full custody timeline (reusing `custodyTimeline` from custody.ts, so a voided/corrected step reads the same way it does on the phone), a photo count, and its QA/QC decision history. Linked from a hole's name on the team overview and from the activity feed. This also closes E12-5's remaining gap ("a dedicated per-sample and full custody history in one place"). **Verified in code**, not yet clicked through by the owner.
- **E11-5 — Semester and final-report export (5).** Sample locations, logs and assay tables in the shape the DAO 2010-21 reports need (see `docs/product/field-workflow-friction-and-design-principles.md`).
- **E11-6 — Dynamic hole assignment (3). Added and built 2026-09-22, not in the original story set.** As a project manager, I want to assign a hole to a specific person on my team and change that at any time, so that work is clearly owned without a fixed schedule. Account creation and team placement stay with the admin (D13); assignment itself is the manager's own call, changeable any time. Web-only: the assignment row is deliberately not synced to the phone, so a wrong or missing assignment can never block a geologist's own logging.
- **E11-7 — Urgent hole flag (3). Added and built 2026-09-22, not in the original story set.** As a project manager, I want to flag a hole as needing urgent attention, with a short note, so that a geologist sees it once their phone syncs. Deliberately a passive badge, not a push notification: the geologist sees "Urgent" and the note next time the app has synced and is open, not an alert on a closed app. The team overview lists urgent holes first (`ORDER BY priority DESC` on the Postgres enum) — the "priority queue" the owner asked for. Migration applied to the live database. **Verified in code** (typecheck, lint, tests, build all pass) but **not yet checked on a real phone** — the mobile build has not been rebuilt since this was added, and the phone was disconnected partway through this session.

**E12 — QA/QC interface (web first; phone later), scoped to a stage of the chain**

QA/QC starts in the field and runs through sampling, custody, the laboratory and assays, so a QA/QC account is limited to a stage: core and logging, sampling and custody, or laboratory and assays (decision D15).

- **E12-1 — Stage scope on the account (2). Built 2026-09-22.** The admin sets which stage a QA/QC account reviews, from a "Stage reviewed" field on the Users page (shown only for the QA/QC tier).
- **E12-2 — Exceptions queue (5). Built 2026-09-22.** For the person's stage: gaps and overlaps and recovery over 100% (core and logging); QC insertion rate below the project's own target and samples stalled before dispatch (sampling and custody); nothing yet for laboratory and assays, honestly labelled, since no laboratory data exists in the app yet (see E13). Devices quiet for more than three weeks are shown separately, worded as evidence freshness rather than a fault — this app is built to work offline for weeks. Exceptions are computed live from the same evidence a geologist already entered (`packages/domain/src/qaqc.ts`, reusing `analyseContinuity` and `qcAchievement`), never stored twice; each links to its evidence inline (a depth range or sample number, not yet a link to a hole-detail page, since E11-4 doesn't exist yet) and can be resolved with a reason.
- **E12-2a — Run past the final depth (2). Built 2026-09-25, checked in code only; not yet run on the test phone.** A core run ending deeper than the hole's recorded final depth is a warning on the phone when the run is saved (confirm, like the other run warnings), and a "Run past the final depth" exception for the core and logging reviewer. No final depth recorded yet: no warning. `runPastFinalDepthWarning` in `packages/domain/src/core.ts`.
- **E12-3 — Review decisions (3). Built 2026-09-22, ahead of its place in the backlog.** Accept, hold or reject a hole with a note, from the same page as its exceptions. Decisions are appended, never edited (`qaqc_review_decisions`), and show who decided and when.
- **E12-4 — Standards, blanks and duplicates (8). Built 2026-09-25, checked in code only; not yet run against the live database.** The rules live in `packages/domain/src/labQc.ts`: a standard passes within 2 SD of its certified value, warns between 2 and 3 SD and fails beyond 3 SD, or on the second reading in a row beyond 2 SD on the same side in one dispatch; a blank fails above its limit; a field duplicate fails beyond 30% relative difference; a returned batch missing a result is flagged. The certified values and blank limits are kept on a new "Standards and blanks" page (`/team/standards` for the project manager, `/qaqc/standards` for QA/QC; only the manager and the laboratory-stage reviewer can edit) in the web-only `qc_reference_values` table (migration `20260925000000_qc_reference_values`). The failures appear on the QA/QC screen for the laboratory and assays stage. Pass and fail are deliberately not shown to the laboratory, so the inserted standards stay blind. Demo data: OREAS 45e Cu 742 ± 20 and Zn 131 ± 6 ppm, blank limit 10 ppm, and the DSP-001 standard reads Cu 910 ppm, so it fails.
- **E12-5 — Audit trail (3). Partly built 2026-09-22.** A hole's past decisions (E12-3) and its resolved exceptions are both visible inline on the exceptions queue: resolved exceptions still show their original evidence when the same condition still recomputes, and when it no longer does (the data has since changed), the resolution stays visible with the kind of exception it was, who resolved it and why — never silently dropped, matching the append-only spirit of custody (D7). **The remaining piece** — a dedicated per-sample and full custody history in one place — is now covered by E11-4's hole view (built 2026-09-22), rather than its own page inside E12.

**Verified in code** (typecheck, lint, 614 tests, build all pass) and the migration (`qaqc_stage`, `qaqc_exception_resolutions`, `qaqc_review_decisions`) is applied to the live database. **Not yet checked by a real QA/QC reviewer signed in** — verification so far is an unauthenticated request to `/qaqc` confirming it redirects to sign-in like every other guarded page, not a signed-in walkthrough of the exceptions queue itself.

**E13 — Laboratory view (web). Expanded into stories 2026-09-22; E13-1 through E13-3 built the same day.** A dispatch inbox for laboratory personnel: receive a batch, confirm what arrived, return results against the batch. **Decision, 2026-09-22 (owner):** the laboratory is in-house — a laboratory account joins the mining company's own team exactly like every other tier (E11-1's organization model), rather than needing separate cross-team access. Chosen for speed now, with the schema left able to support an outside-contractor model later without a rebuild if that turns out to be needed.

- **E13-1 — Dispatch inbox (3). Built 2026-09-22.** `/laboratory` (new `requireLaboratory()` guard, `canReviewLaboratory` in roles.ts, its own login redirect): every dispatch with `status: "dispatched"` for the account's team, with its project, laboratory name, handover date and sample count.
- **E13-2 — Confirm receipt (3). Built 2026-09-22.** A laboratory reviewer checks off which of a dispatch's samples actually arrived and confirms; each checked sample gets a new `received` custody event (added to `CustodyEventType`, D7 append-only — no new "receipt" table). A sample left unchecked has no `received` event, which is how a missing or short shipment is detected: `receiptStatus` and `missingSampleIds` (new `packages/domain/src/laboratory.ts`, 11 tests) compute this live from the dispatch's samples against its `received` events, never storing a separate mismatch flag. Confirming again after a late arrival only records the newly-checked samples, never duplicates the earlier ones.
- **E13-3 — Enter and return results (5). Built 2026-09-22.** A laboratory reviewer enters analyte, value, unit and "below detection" per sample against a dispatch (new `AssayResult` model, web-only like the QA/QC and manager tables — not in `sync-streams.yaml`, so a geologist's phone is unaffected), then marks the batch complete (`Dispatch.resultsReturnedAt`) or reopens it to keep adding. QA/QC's own use of this data (E12-4) is still not built — only the assay shape this story needed decided is now in place.
- **E13-4 — Receive by scan and preparation queue (5). Built 2026-09-25, checked in code only; not yet tried with a real scanner.** The laboratory screen has a "Receive by scan" box. A USB or Bluetooth scanner types the bag's tag and presses Enter; typing the number works the same way. The box matches the number (ignoring capitals, or the last part of a link in a QR code) to a sample in any batch dispatched to the team, and records the same `received` custody event the checklist records. A bag already received, or not on any dispatch, is reported and nothing is written. Scans are queued, so a fast scanner never loses a bag. Received samples without results wait in a "Preparation queue": holes the project manager flagged urgent come first, then first received, first prepared. Only the hole, project and dispatch are shown, never the depth or sample type, so inserted standards and blanks stay blind. Rules in `packages/domain/src/laboratory.ts` (`scannedSampleNumber`, `matchScan`, `preparationQueue`). No database change. Next, not built: an urgent depth range on the manager's flag.
- **E7-4 — Scan bag tags on the phone (3). Built 2026-09-25, checked in code only; not yet run on the test phone.** "Scan tags" on the Samples screen opens the camera (expo-camera's own QR and barcode reader, so no new native module) with a typed fallback. Each tag is looked up in the phone's own samples, offline, and shows where the sample came from: hole and depth, or which control it is, so a tag on the wrong bag is caught at the core shed. A tag not in the project is flagged. The scanned bags are then bagged, sealed, handed over or put in a lab dispatch together, through the same custody steps as picking them from the list. Lookup rule `findSampleByTag` in `packages/domain/src/laboratory.ts`.
- **E7-5 — Print tags (2). Built 2026-09-25, checked in code only; not yet printed or scanned.** `/team/tags` (linked from the team overview and each hole's page) lays out one QR label per sample for a hole or a dispatch, printable on A4 (three across). The QR code holds the sample number, which the phone's Scan tags and the laboratory's Receive by scan both read. A tag shows only the sample number and project, never the hole, depth or type, so standards and blanks stay blind to the laboratory. Uses the `qrcode` package (MIT), rendered on the server as SVG.
- **E11-5 — Sample trace on the web (5). Built 2026-09-25, checked in code only; not yet opened in a browser.** `/team/samples/[sampleId]`, reached from "Find a sample" on the team overview (type the tag number; an exact match opens directly) and from each sample number on a hole's page. A progress rail (sampled, bagged, dispatched, received by the laboratory, results in) marks a step that was skipped as "Not recorded" rather than filling it in. Below: where it came from (depth, core box, the logged geology over that depth with code descriptions, and the core photos, shown when backed up), the full chain of custody with voided mistakes kept, and the dispatch and latest result per element. Controls link to their original or duplicate. Rail rule `sampleProgress` in `packages/domain/src/custody.ts`.

**Database migration applied 2026-09-22.** The owner ran `npx prisma migrate deploy` against the live database; `20260922075705_laboratory_assay_results` (adds `received` to `CustodyEventType`, `assay_results`, `Dispatch.resultsReturnedAt`) is now live, along with the four earlier migrations from this push (teams, hole assignments, drillhole priority, QA/QC stage reviews). No new PowerSync grant was needed: `assay_results` is deliberately web-only (not in `sync-streams.yaml`), and `custody_events` already had its grant and publication membership from Sprint 5, which covers the new `received` enum value automatically. No one has signed in as a laboratory, QA/QC or project-manager account to click through `/laboratory`, `/qaqc` or `/team` yet — everything above is still verified in code only (typecheck, lint, the full test suite including a schema-agreement fix for the `received` enum value, and a production build all pass), not on the deployed site.

**E14 — My work (phone), proposed 2026-09-21; E14-1, E14-2 and E14-3 built the same day and installed on the test phone, awaiting a geologist's review.** The geologist's own view of what they did, by date. It is calculated from the data already on the phone, so it works with no signal, and the same numbers per geologist feed the manager overview (E11-2). Mockup: `docs/product/mockups/my-work.html`; to be tried with a geologist before any build.

- **E14-1 — My work by date (5).** As a field geologist, I want to see what I did on a day, a week or any range of dates, so that I can check my progress and report it without adding it up by hand.
  - Today, Yesterday, Last 7 days or Pick dates; a week strip shows which days have work.
  - For the range: metres logged, core boxes and runs, photos, samples (and how many are QC), custody steps and dispatches, plus the holes worked on with their own numbers.
  - Counted by the date the work was done, not the date it synced. Editing an old interval does not count as new metres. A custody step counts on the day it happened.
  - Works offline; private to the geologist (no scores or rankings).
- **E14-2 — Share a day report (3).** A plain-text summary of one day or a range through the phone's share sheet, so it can go to a resident manager without typing. A PDF is a later option.
- **E14-3 — Today card on Home (2).** A one-line summary of today on the Home screen that opens the full view.

To answer with a geologist first: which number is reported at the end of a shift, and does the resident manager already ask for a daily or weekly summary?

### Proposed 2026-09-24, not scheduled

Collected from the owner's own testing and from the first geologist tester's suggestions. Nothing here is built or scheduled; each needs the owner's go-ahead (scope rule). Sizes are rough estimates in working sessions, not story points, and have not been checked against real velocity.

**E15 — Collar map (phone), suggested by the first geologist tester.** He proposed MapLibre. Compared on 2026-09-24:

- **Engine: MapLibre React Native** (`@maplibre/maplibre-react-native`, Expo config plugin, works in the existing native build). Free, no API key, built-in offline support. Not `react-native-maps` (Google Maps: needs a billing-linked key, no reliable offline) and not Mapbox (account and paid token).
- **Map data, the real decision.** OpenStreetMap's own tile servers and OpenFreeMap forbid bulk or offline downloading. Stadia allows offline caching only with an active paid subscription and at most 100 MB per device, which conflicts with the owner's no-ongoing-cost constraint. Chosen direction: cut one PMTiles file per project from the free Protomaps OpenStreetMap build (`pmtiles extract --bbox=...`), host it, and have the phone download it once. MapLibre Native reads `pmtiles://file://...`, but that source does not use MapLibre's own offline-pack system, so the app must download and manage the file itself.
- **What exists today:** each hole's single collar latitude and longitude (`collar_latitude`, `collar_longitude`, plus source, accuracy and capture time) already sync to the phone, and `expo-location` and `expo-file-system` are already dependencies. There are **no planned collar coordinates**: only planned azimuth, inclination and depth (`schema.prisma`, `Drillhole`).
- **E15-1 — Collars and a "you are here" dot on a plain background. Built 2026-09-25, with hole traces added the same day, and run on the test phone (see "Collar map, step 1" and "Collar map: hole traces" in section 7).** The owner chose to make the map how a geologist picks a hole: a project first, then its holes as a List or a Map. It is drawn with ordinary views, not MapLibre, so it needs no new APK and can ship as an over-the-air patch. MapLibre (11.4, which lists Expo 54+ and React Native 0.80+ as supported) is kept for E15-2, where a real background map needs it. Not built: the small map on the hole screen.
- **E15-2 — Offline background map per project (about 3 to 5 sessions).** An extract script, somewhere to host the file, a new project field for its location (migration run by the owner), a Wi-Fi-only download with progress on the phone, the map style, and the required "© OpenStreetMap contributors" credit. Hidden cost: a vector style also needs its fonts and icon sprites available offline, either bundled in the APK or downloaded with the map. Caveat to tell testers: OpenStreetMap coverage around remote Philippine sites can be thin, so the map may show little beyond the collars.
- **E15-3 — Planned collar positions (about 2 sessions), only if wanted.** New planned latitude and longitude on the drillhole: migration, the phone and web forms, and the upload rules in `apps/web/lib/sync/tables.ts`.
- **E15-4 — Satellite or contours.** Not sized. Most imagery providers restrict offline use; licensing research first.
- **To ask the tester before building:** is the map for checking collars and seeing holes relative to each other (E15-1 may be enough), or for finding planned drill pads (needs E15-3)?

**E16 — Import a code scheme from a spreadsheet (web, about 1 to 2 sessions).** A project manager uploads the company's existing lithology, alteration, mineralisation, weathering and structure codes from CSV or Excel, previews them, and adds them to the project's code library. Web only, since geologists only use the phone; `code_library` already syncs per project (`sync-streams.yaml`), so no new APK is needed. Today codes can only be added one at a time on the phone's Code library screen. Company schemes often run to hundreds of codes, which nobody will type on a phone.

**E17 — Device limits and approval by the team leader (web and phone, about 2 to 3 sessions).** Backlogged by the owner on 2026-09-24 in favour of more important work. Today any account can sign in on any number of phones, and each phone registers itself on first sync with no approval (`apps/web/lib/devices.ts`). A device can be blocked (`revoked_at`: the server then refuses its uploads and new sample-number blocks), but no screen sets it; only the database can. Proposed:

- **Limits per account:** a field geologist has at least 1 and at most 2 active phones (a main phone and a spare); a team leader (resident / project manager) has at least 1 and at most 3. Web sign-ins are not counted, because a browser holds no offline data or sample-number blocks; a "Signed-in browsers" list with "Sign out everywhere" covers them instead.
- **Approval:** a new phone registers as "Waiting for approval" and gets no team data or sample numbers until the team leader approves it under Team overview, Devices. Approve, Refuse, and Remove (which uses the existing `revoked_at` block, for a lost phone). The admin can act on any team. Removing a phone never deletes what it already synced; custody stays append-only.
- **Needs:** a migration (approval status on devices, a per-team limit), which the owner applies; the web approve and remove screens; a phone screen "Waiting for your team leader to approve this phone" (new APK); and a sync-rule change so an unapproved phone downloads nothing.
- **To decide before building:** the limits above, and whether a phone may keep logging offline while it waits for approval.

**Smaller items, not sized:**

- **Delete with a confirmation step**, on the web admin and possibly the phone. Must respect the existing rules: sample numbers are never reused, and custody events are never edited or deleted (a mistake is a correction step).
- **Photos from the camera roll**, as well as the camera.
- **Mark guide entries as practice or official.** A geologist following the first-run guide may be entering made-up data; let them say so, so practice holes stay out of real exports and the team views.
- **Bug: a phone keeps the workspace it first registered in.** `registerDevice` stores the account's team (`organization_id`) only when the phone first registers, and never updates it. A phone that signed in before its account was put on a team stays in the personal workspace: it does not count under the team's Devices, and its uploads are written to the personal workspace. Seen 2026-09-24: the owner's team overview showed "Devices 0" with a phone connected. Fixed in code the same day: registration and every upload now move a phone to its account's current workspace (`currentDeviceWorkspace` in `apps/web/lib/devices.ts`); reproduced and verified against a local database, not yet on the test phone. A second team bug, fixed with it: sample-number blocks were only issued for projects the requesting geologist had created (`apps/web/lib/sampleBlocks.ts`), so a teammate's phone was refused on a shared team project and fell back to the project counter, which two phones can share. Blocks are now issued for any project in the account's workspace; verified locally (the teammate got 101 to 200 after the creator's 1 to 100), not yet on phones.
- **Guide copy: say planned depth is required.** The new-drillhole step never mentions it, but "Create drillhole" stays disabled until it is filled.
- **Admin Users: scroll to the top after "Reset password".** The new password appears in a box at the top of the page, which is off screen when the admin clicked from a row further down, so it looks as if nothing happened (owner, 2026-09-24). After a reset (and after creating an account), scroll the page to the top so the box is in view. Web only, small.

### Later backlog (not in the MVP)

| Epic                                   | Notes                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| Assay import and matching (web)        | CSV/Excel import; match by sample ID; the Phase 1 views become real                           |
| QA/QC review (web)                     | Now epic E12 in the team release above                                                        |
| Teams, invites and roles               | Client admin, project geologist, core-yard technician, QA/QC reviewer, viewer, platform admin |
| Approvals and sign-off                 | Once real approval workflows are validated                                                    |
| QR/barcode scanning and label printing | Started 2026-09-25: scan tags on the phone (E7-4), print tags (E7-5), receive by scan at the laboratory (E13-4). Hardware still to validate with testers |
| iOS build                              | Once Android is proven                                                                        |
| Web trace view of synced data          | Built 2026-09-25 for the project manager: `/team/samples/[sampleId]` and "Find a sample" (see E11-5 below) |
| Maps and planned-vs-actual traces      | Drillhole plan map, collar-to-target view; first steps proposed as E15 above                  |
| Work plans and deadlines               | Once managers are users                                                                       |

### Backlog totals

| Epic                     | Points  |
| ------------------------ | ------- |
| E1 Account and workspace | 16      |
| E2 Drillholes            | 13      |
| E3 Core boxes and runs   | 11      |
| E4 Core logging          | 19      |
| E5 Photos                | 10      |
| E6 Sampling              | 16      |
| E7 Custody and dispatch  | 11      |
| E8 Offline and sync      | 26      |
| E9 Export                | 5       |
| E10 Test support         | 10      |
| **Total**                | **137** |

---

## 7. Sprint plan

Sprints last 2 weeks (Sprint 0 is 1 week). Capacity starts at ~20 points per sprint; the plan is re-checked against real velocity after Sprint 2.

| Sprint                                | Goal                                                            | Stories                                                                                                                                                                             | Points       | Demo (on a real Android device)                                                                                    |
| ------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| **S0** Foundations (1 wk)             | The repo and tooling are ready for mobile                       | Monorepo (`apps/web`, `apps/mobile`, `packages/domain`); Expo skeleton; fix the Prisma 8-rc vs `@prisma/client` 6 mismatch; CI; **spike**: PowerSync local-only on encrypted SQLite | —            | The empty app opens on a device; the web app still builds with all its routes                                      |
| **S1** Holes offline                  | Create projects and drillholes with no signal                   | E8-1, E1-1, E1-2, E2-1, E2-2, E2-3, E2-4                                                                                                                                            | 24           | Airplane mode: create a project and a hole with a GPS collar, kill the app, reopen, data intact                    |
| **S2** Log a hole                     | A full hole can be logged at the rig                            | E3-1, E3-2, E3-3, E4-1, E4-2, E4-3, E4-4, E4-5                                                                                                                                      | 30           | Log a complete hole offline, with boxes, runs, recovery/RQD and a continuity strip                                 |
| **S3** Sample it — **internal alpha** | A full field day works offline end to end                       | E5-1, E5-2, E6-1, E6-2, E6-3, E9-1                                                                                                                                                  | 25           | Installable APK: log, photograph, sample with QC inserts and export CSV — shown to one friendly geologist          |
| **S4** Accounts and backup            | Sign up, and data reaches the cloud                             | Backend: Postgres + Prisma schema, Better Auth, PowerSync service; E1-3, E1-4, E6-4, E8-2                                                                                           | 16 + backend | Sign up, and alpha projects attach to the account; a second device downloads them                                  |
| **S5** Safe sync and custody          | Offline work always syncs safely; the custody chain is complete | E8-3, E8-4, E8-5, E5-3, E1-5, E7-1, E7-2, E7-3                                                                                                                                      | 32           | Two devices edit the same record offline, and the conflict is resolved; a dispatch is created and its sheet shared |
| **S6** Field-test release             | Testers can install, learn and report                           | E10-1, E10-2, E10-3, E10-4, E10-5, E10-6, E10-7, E10-8 + fixes from alpha feedback                                                                                                                              | 26 + fixes   | A Play internal-testing build installed by testers. **The field test starts.**                                     |

S2 and S5 are over capacity by design. At S2 planning, split E4-3 and move E4-5 or E4-2 to S3 if velocity is under 30. At S5 planning, E7-3 is the first story to slip to S6.

**Target timeline:** S0 starts next, and the field test begins at the end of S6 (about 13 weeks, velocity permitting).

### S0 outcome (2026-09-19)

Done, with one gap: **there is no Android SDK, emulator, `adb` or JDK on the development machine**, so "opens on a real Android device" could not be literally demonstrated this sprint. Everything short of that was verified:

- Repo restructured into `apps/web`, `apps/mobile`, `packages/domain` as npm workspaces. `apps/web` builds, lints, typechecks and tests exactly as before the move (same 10 routes).
- `apps/mobile` scaffolded with Expo SDK 57 + Expo Router, wired to `@corechain/domain` as a workspace dependency (verified by both `tsc` and a real Metro bundle — see below).
- Prisma version mismatch fixed: `prisma` and `@prisma/client` are now both pinned to `^6.19.0` (was `prisma@8.0.0-rc` vs `@prisma/client@6.16`).
- A monorepo React version conflict was found and fixed: Expo pins an exact React version while `apps/web` uses a floating range, which without a fix silently installs **two copies of React** inside the mobile app — a classic cause of "Invalid hook call" crashes. Fixed with a root `overrides` block pinning `react`/`react-dom` to one version repo-wide; `expo-doctor` (21/21 checks) confirms no duplicates remain.
- `.github/workflows/ci.yml` added: install, typecheck, lint, test and build on every push/PR, plus `expo-doctor` as a config sanity check.
- **PowerSync spike, verified as far as possible without a device:**
  - `@powersync/react-native` (2.2.1) has a built-in `op-sqlite` storage adapter; the separate `@powersync/op-sqlite` adapter package is legacy and was removed after it pulled in a conflicting old `op-sqlite` range.
  - `@op-engineering/op-sqlite` bundles SQLCipher as a compile target (confirmed in its source and docs) and is added as a dependency of `apps/mobile`.
  - SQLCipher was first enabled via `"op-sqlite": { "sqlcipher": true }` in the **root** `package.json` (which op-sqlite's docs suggested for a monorepo). **That was wrong** — see the S1 outcome: on Android, op-sqlite reads that flag from `apps/mobile/package.json`, so the database was silently _unencrypted_ until it was corrected and checked on a real device.
  - The encrypted-open API is confirmed: `open({ name, encryptionKey })` from `@op-engineering/op-sqlite`.
  - **Hard requirement discovered: op-sqlite cannot run in Expo Go at all** ("you cannot use this library on an expo-go app, you need to pre-build your app"). `npx expo prebuild --platform android --clean` was run and succeeded, generating a real native Gradle project — confirming the toolchain fits together. The generated `android/` folder was then deleted (it's regenerable and gitignored; CNG-style projects don't commit it).
  - `npx expo export --platform android` succeeded independently, bundling 1,606 modules into a real Hermes bytecode `.hbc` file — proof Metro resolves the whole dependency graph, including the cross-workspace `@corechain/domain` import, correctly.
  - **Not done in S0, because there was no device:** actually opening an encrypted database, writing and reading a row, and confirming it survives an app kill. This moved to Sprint 1's E8-1 and is now done (see the S1 outcome).
- **New consequence for the team:** once E8-1 lands, **Expo Go stops being usable for this app** for anyone testing it. Development and the S3 alpha / S6 field-test builds need an EAS development build or `expo run:android` with a real Android SDK installed.

**Resolved during Sprint 1:** the Android toolchain (JDK 17, SDK, NDK, CMake, Gradle) was set up from the command line and the app was built and installed on a physical phone over USB debugging — see the S1 outcome.

### S1 outcome (2026-09-19)

All seven stories (E8-1, E1-1, E1-2, E2-1 through E2-4) are coded, typechecked, linted and bundle-verified, and most were then **verified on a real phone (Infinix GT 30 Pro, Android, USB debugging)**. Specifics:

**On-device verification (2026-09-19):**

| Story                       | Result on the device                                                                                                                                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E8-1 encrypted local DB     | Database opens, migrations run, reads and writes work, data survives a force-kill and relaunch. **Encryption was initially NOT active** (see below); after the fix, the file on disk is ciphertext and the app still reads it back with the key from the Keystore-backed SecureStore. |
| E1-1 create project         | Created "Sipalay Test Prospect" (WGS84); survives a force-kill.                                                                                                                                                                                                                       |
| E2-1 drillhole + GPS collar | Real GPS fix captured (14.613951, 121.032869, ±100 m, an indoor/coarse fix as expected) and saved as a `gps` collar; Create is disabled until the required fields are valid.                                                                                                          |
| E2-2 actual details         | Start date and actual final depth (152.5 m) saved and shown in the list.                                                                                                                                                                                                              |
| E2-3 status                 | Planned → Drilling saved; list shows the new status.                                                                                                                                                                                                                                  |
| E2-4 list                   | Row shows status, depth and % logged. Search by hole ID works: "rc" matched only RC-07 (case-insensitive) and a non-matching term shows "No holes match ...".                                                                                                                         |
| E1-2 project settings       | Changed prefix CC to SIP and standard-sample rate 20 to 25; both persisted across a force-kill.                                                                                                                                                                                       |

- **Not yet verified:** airplane-mode operation as an explicit test. The app makes no network calls today, so it is expected to pass, but it should be demonstrated for the Sprint 1 demo. It is a system setting, so the developer toggles it on the phone.
- **Bug found only by inspecting the file on the device:** the SQLCipher flag `"op-sqlite": { "sqlcipher": true }` had been placed in the **root** `package.json`. op-sqlite's Android Gradle script reads it from the Gradle root's parent, `apps/mobile/package.json`, so the database was being written as plain SQLite (`SQLite format 3` header, table names and project names readable) even though the app passed an `encryptionKey` — **the key was silently ignored, and nothing crashed or warned.** Fixed by moving the flag to `apps/mobile/package.json`; verified after a native rebuild (`[OP-SQLITE] using sqlcipher.` in the Gradle log, file header now random bytes, no plaintext markers, and a write → force-kill → relaunch → read round trip still works). Any device that ran a pre-fix build has a plaintext database that cannot be opened with the key, so pre-fix installs must be wiped (uninstall or clear data). **Lesson: "encrypted" needs a test that reads the file bytes, not just a successful open.**
- **UI polish found on the device, then fixed and re-checked on it:** the selected chip is now a solid blue fill with a bold white label (it was a barely-lighter grey); buttons have horizontal padding so "New project" is no longer cramped; "Use GPS" is an outlined button; and a search with no matches shows "No holes match ..." instead of a blank screen.

**Implementation details:**

- **Domain layer** (`packages/domain/src/field.ts`): `Project`, `FieldDrillhole`, `Collar`, coordinate systems, and every validation rule (hole ID uniqueness, azimuth/inclination ranges, planned-depth, actual-depth warning, logging progress, search matching) as pure, storage-free functions — **these are the one part of Sprint 1 with real automated proof**: 24 new vitest tests, all passing, added to `packages/domain/src/field.test.ts` and wired into the root `test` script and CI.
- **Local database** (`apps/mobile/src/data/`): an encrypted op-sqlite connection (key generated once via `expo-crypto` and held in `expo-secure-store`), a versioned migration list creating `projects`, `drillholes`, and an append-only `drillhole_status_history` table, and two repositories (`projectsRepository.ts`, `drillholesRepository.ts`) implementing every story's data operations. Written against op-sqlite's actual exported TypeScript types (`DB`, `Scalar`, `SQLBatchTuple`), not just its docs, after those docs undersold a couple of real API details. Run against a real encrypted database on a phone — see the on-device table above.
- **Six screens**, replacing the template's tab shell with a `Stack` (projects → project → drillhole is a drill-down, not tab sections): a projects list, a new-project form, per-project settings (E1-2), a project detail screen with search (E2-4), a new-drillhole form with GPS-or-manual collar capture (E2-1), and a drillhole detail screen with a status control (E2-3) and an actuals form (E2-2). No new native UI dependencies were added — coordinate system and status pickers are a small hand-rolled `ChipSelect`, not a native picker library, to avoid adding more untested native surface than op-sqlite already is.
- **Two more real toolchain gaps found and fixed**, the same way as Sprint 0's PowerSync findings:
  - Expo Router's typed-route declarations (`.expo/types/router.d.ts`) are gitignored and only regenerate when the interactive dev server runs — CI's fresh checkout never does that, so `tsc` failed on every route helper (`router.push`, `<Link href>`) until fixed. Fixed with a `pretypecheck` script (`expo customize tsconfig.json`, which regenerates the routes file as a side effect without touching the real `tsconfig.json`) so it self-heals on every `npm run typecheck`, locally and in CI.
  - **op-sqlite cannot bundle for the web target at all** without also installing `@sqlite.org/sqlite-wasm` (a "Worker chunk not found" Metro error) — confirming decision D2 more concretely than Sprint 0's spike did. This also means the "export a web bundle and curl its SSR output" verification trick from Sprint 0 no longer works once a screen actually calls the database — it's an Android-only app from E8-1 onward, not just by choice but because the web target now hard-fails at bundle time. Verification for anything past this point relies on `expo export --platform android` (confirmed: 1,614 modules, including every new file, bundle cleanly) plus `tsc`/`eslint`/vitest, not a browser.
- **Known simplifications, not gaps to silently carry forward:** dates in the actuals form are plain ISO-format text fields rather than a native date picker (avoids yet another native dependency before a device can verify any of them); `actualDepthWarning` is always computed against a hardcoded 0m "deepest recorded depth" placeholder, because there's no core logging yet (E3/E4) to measure against for real. **Update:** the depth-warning placeholder was replaced in Sprint 2 with the real deepest recorded box/run depth.

### S2 progress (2026-09-19)

**Slice 1 — E3 core boxes and runs: done and verified on the phone.**

- **Domain** (`packages/domain/src/core.ts`, 37 new tests, 61 total): one shared `analyseContinuity` for gaps and overlaps in any set of depth ranges (used by boxes and runs now, and by log intervals in E4-4); `recoveryPercent` and `rqdPercent` (1 decimal; RQD divides by the _drilled_ length, per the story); `validateBoxInput` and `validateRunInput`; `nextBoxDefaults` / `nextRunDefaults`; `deepestRecordedDepthM`. Float noise (1.1 + 2.2 vs 3.3) is absorbed by a 5 mm tolerance, and the first record's start is never reported as a gap.
- **Warnings vs errors:** a duplicate box number, non-positive depths, or RQD pieces longer than the recovered core are _errors_ (blocked). Overlaps, gaps and recovery above the drilled length are _warnings_ that need a second tap, "Save anyway" — a geologist can be entering boxes out of order, and over-100% recovery is physically possible.
- **Data:** migration v2 adds `core_boxes` and `core_runs` (sync-ready columns, soft delete). Deleting a box or run is a soft delete.
- **On the phone (Infinix, Android):**
  - E3-1: "next box" pre-fills the number and start depth (box 2 started at 4.2 m, where box 1 ended); a deliberate 8.4–9.5 m gap showed "Leaves a gap of 8.4–9.5 m next to this box", saved via "Save anyway", and the list shows "Gap: 8.4–9.5 m".
  - E3-2: live "Recovery: 96.7%" for 2.9 m of 3 m; 3.4 m of 3 m showed "113.3%" and the warning "Recovered 3.4 m is more than the 3 m drilled", and saved via "Save anyway".
  - E3-3: live "RQD: 70%" for 2.1 m of pieces in a 3 m run.
  - E2-2 (completing Sprint 1's placeholder): entering a 5 m final depth now warns "shallower than the deepest depth already recorded (12 m)" using the real box/run depth.
- **Found on the device:** the keyboard covered the "Save anyway" button on Android, so the forms now dismiss the keyboard when a warning appears. **Fast Refresh can leave a form in a stale state**, so a fix to a screen with local state should be re-tested after a full app restart before trusting the result.
- **Found in code:** the domain package already exported a web-demo `CoreBox` type from the Phase 1 dataset, and a duplicate `export *` name silently loses to the local one. The new types are `FieldCoreBox` / `FieldCoreRun`, following the `Field` prefix convention already used for `FieldDrillhole`.
- **Not yet built:** editing an existing box or run (delete and re-add for now), and the rest of the E4 stories (see slice 2 below).

**Slice 2 — E4 code library and core logging: done and verified on the phone.** All of Sprint 2's stories (E3-1..3, E4-1..5) are now built.

- **Domain** (`packages/domain/src/logging.ts`, 27 new tests, 88 total): the starter code library (provisional and generic hard-rock; the Philippine code lists remain an open item), code validation (unique per category, ignoring case), `visibleCodes`, `validateIntervalInput`, `copyIntervalCodes` (everything except depths and free text), `isCodeInUse`, `loggedLengthM` (overlaps counted once) and `continuityStrip`.
- **Data:** migration v3 adds `code_library`, `log_intervals` and `log_drafts` (device-local, never synced). The library seeds itself from the starter set the first time a project's library is read, so it works offline on first launch with no setup; soft-deleted rows still count, so deleting every code never re-seeds.
- **Design choices:** interval fields are plain text, so a pick-list chip and free text are the same thing (the story: "free text is always allowed"). Autosave writes a per-hole draft 500 ms after the last change, and only once the form differs from how it loaded, so an untouched form never leaves a stale draft.
- **On the phone (Infinix, Android):**
  - E4-1: the starter library appeared as chips for every category, and a selection shows its description ("PY — Pyrite").
  - E4-3: a full interval (AND · PROP 2 · PY DISS 3% · SW · VEIN) saved, and the interval's "from" pre-filled from the previous interval's end. **A force-kill mid-entry restored every field** with "Restored your unsaved entry."
  - E4-4: a 4.5–6 m gap showed as an amber segment in the strip, in the list ("Gap: 4.5–6 m") and as a "Leaves a gap of 4.5–6 m" warning with "Save anyway".
  - E4-5: "Copy previous interval" carried over AND, PROP and intensity 2 while keeping the new depths.
  - E4-2: deleting AND, which is used by two intervals, was refused ("AND is in use… Hide it instead"); BAS could be hidden and then disappeared from the pick-list; a new custom code (RHY — Rhyolite) appeared in the pick-list.
  - E2-4: the hole list's "% logged" is now real (7.5 m of 80 m shows 9%).
- **Found on the device:** a restored draft still popped the keyboard, because `autoFocus` only applies on mount and the draft hadn't loaded yet; the form now renders only after loading. (Fixed after the last device check; worth a re-test.) Tapping chips shifts the layout as each selection adds its description line, which makes scripted testing fiddly and is a small real-world annoyance too.
- **Not yet built:** editing an existing box, run or interval (delete and re-add for now), renaming a code's short code, and per-hole log export (Sprint 3). With E3 and E4 done, Sprint 2's goal — log a complete hole offline — is met, but it has only been exercised on short test holes.

### S3 progress (2026-09-19)

**Slice 1 — E6 sampling (E6-1, E6-2, E6-3): done and verified on the phone.** Photos (E5-1, E5-2), CSV export (E9-1) and the internal-alpha build are next; those need new native modules (camera, image compression, file sharing), so they will share one native rebuild.

- **Domain** (`packages/domain/src/sampling.ts`, 32 new tests, 120 total): `validateSampleInput`, `qcReminders`, `qcAchievement`, `filterSamples`, `sampleDepth` and a provisional `formatSampleNumber` (`SIP-00001`; the real tag-book format is to be confirmed with testers). The web-demo `Sample` name is taken, so the type is `FieldSample`.
- **Modelling choices:**
  - A primary sample needs a depth range inside the hole (actual final depth, else planned) and may not overlap another primary; touching end to end is fine.
  - A standard needs a reference material ID and has no depth; a blank has no depth; a field duplicate must name a primary sample in the same hole and takes that sample's depth.
  - A QC control is "due" once N primaries have been created since the last control of that type _or_ since its reminder was dismissed. A rate of 0 switches a reminder off. Dismissing needs a reason, which is stored.
  - Sample numbers are never reused, even after a delete (a unique index spans deleted rows), because the number is a physical tag. A primary that a duplicate points at can't be deleted until the duplicate is.
  - Numbers come from the project's counter (E1-2) until Sprint 4's device-issued blocks (E6-4). The counter only moves when the geologist keeps the suggested number; typing a pre-printed tag leaves it alone.
- **Data:** migration v4 adds `samples` and `qc_dismissals`.
- **On the phone (Infinix, Android), with QC rates temporarily lowered to 2 / 3 / 4 to trigger reminders quickly:**
  - E6-1: a sample past the hole's depth was refused ("must fall inside the hole's depth (0–5 m)"); an overlapping primary was refused ("Overlaps a primary sample at 1–2 m"); numbers ran SIP-00001 to 00004; a typed tag (TAG-777) saved and the next suggestion stayed SIP-00005.
  - E6-2: "A standard is due" appeared after 2 primaries; dismissing without a reason was refused and dismissing with one cleared it; a standard (reference OREAS 45e) and a duplicate (of SIP-00002, taking its 1–2 m depth) saved; a duplicate without a parent was refused; "A blank is due" then appeared after 3 primaries.
  - E6-3: the register shows type, depth, status and a QC flag, filters by hole/type/status, and shows the achieved QC rate against each target ("Standards: 1 (1 per 2 samples, target 1 per 2)").
- **Not device-tested:** refusing to delete a primary sample that has a duplicate (unit logic is straightforward, but it was not exercised on the phone). Stale field errors now clear as soon as the field is edited (fixed after the last device check).
- **Not yet built:** editing a sample (delete and re-add for now), and bagging/dispatch statuses (E7).

**Slice 2 — E9-1 CSV export and E5 photos: built; export verified on the phone, photos partly verified.** Adding the camera, image-manipulator, file-system and sharing modules needed one native rebuild.

- **E9-1 export** (`packages/domain/src/export.ts`, tests in `export.test.ts`): one CSV per table (collars, surveys, log, runs, samples), RFC 4180 escaping, CRLF line ends, `HOLEID`/`FROM`/`TO` columns. GPS collars are labelled WGS84; manually typed collars use the project's coordinate system. Each file goes through the Android share sheet. _On the phone:_ the share sheet opened and the CSV content was correct.
- **E5 photos** (`packages/domain/src/photos.ts`, tests in `photos.test.ts`): a photo is taken against a core box (E5-1) or a logged interval (E5-2) and its record carries the hole ID, box number, depth range and timestamp. The photo is compressed down a fixed ladder until it fits the project's "largest photo size" (default 1.5 MB, 0.2–10 MB, editable in project settings). Data: migration v5 adds `photos` and `projects.photo_max_mb`.
- **Photos on the phone:** the camera permission prompt appeared and was granted by the tester; a box photo was captured, filed as "DDH-01 · Box 1 · 0–4.2 m" (1920×2560, 58 KB), showed in the photo list, and moved the box's count to "Photos (1)". The 58 KB file was a black frame (the camera was facing a dark surface), so this did **not** exercise compression on a real, detailed photo.
- **Not yet device-tested:** compression of a detailed photo to the size limit, deleting a photo, photos against a log interval (E5-2), and the "largest photo size" setting.
- **Airplane mode:** a tester created a project ("Masbate") and a GPS-collar hole in airplane mode; both were still there after the app was force-stopped and restarted. Logging boxes and intervals in airplane mode was not observed.
- **Keyboard covering the field being typed into (found by the tester in airplane-mode testing):** the app draws edge to edge on Android, so the keyboard sat on top of the form. Every form screen now uses `FormScrollView` (`apps/mobile/src/components/form/form-scroll-view.tsx`), which measures how much of the screen the keyboard covers, shortens the scroll area by that amount, and Android then scrolls the focused field into view (a manual scroll step was tried and removed: it raised a React Native warning and wasn't needed). React Native's built-in `KeyboardAvoidingView` was tried first and under-padded by the height of the screen header, so it was dropped. _Checked on the phone:_ the lowest field on the drillhole screen now shows its text above the keyboard. Still to check: the other forms with more text fields (sample, log interval).
- **Dates (found in the same test):** a hole's started/completed dates were free text, so `2026/09/19` was saved although the label asked for `2026-09-19`. They are now picked from the phone's calendar (`DateField`, using the native Android date dialog from `@react-native-community/datetimepicker`, which needed another native rebuild). The calendar opens on today's date; the field itself stays "Not set" until a date is chosen, so the app never records a start date that didn't happen. The Completed calendar greys out days before the started date. Dates saved earlier in a looser format are tidied when the screen loads, and the domain package (`dates.ts`, 14 tests) refuses impossible dates and a completed date before the started date. Final depth now refuses non-numbers and zero or negative values instead of saving them. _Checked on the phone:_ the calendar opens on today and the earlier days are greyed out; the "Sep 19, 2026" display and the old-format tidy-up both worked.
**Slice 3 — design pass (owner feedback: the app was functional but plain, and did not feel traceable or easy).** The owner reviewed the field app on the phone and asked for a much higher UI/UX bar. The answer so far:

- **A small design system** (`apps/mobile/src/constants/theme.ts`, `components/ui/*`): colour tokens for light and dark (a bright-light theme with strong status colours: accent, success, warning, danger), rounded bordered `Card`, `StatusPill`, `ProgressBar`, `ActionTile`, `AlertRow` (a problem with a "Fix" button), `Chip`, `TraceChain`, and an icon set (`@expo/vector-icons`, JavaScript-only, so no native rebuild). Buttons and text fields are at least 52 px tall so gloved hands can hit them, and every screen picks up the tokens.
- **Home** answers "where was I, and what next?": a "Continue where you left off" card for the hole last touched (any change to its boxes, runs, log, samples or photos), then the projects with progress bars, and a reminder that everything is saved on the phone.
- **Hole screen:** logging progress, a depth strip that shows logged stretches and gaps, problems worded plainly with a "Fix" button that opens the right list, one big next action, and icon tiles with live counts (including overall core recovery).
- **Sample trace** (new screen, `samples/[sampleId]`): the chain hole → core box (with photo count) → logged interval → sample → bagged → dispatched → assay, with what is done, what is next, and anything that _should_ exist but doesn't (flagged in amber with a fix button). Rules are pure and tested in `packages/domain/src/overview.ts` (13 tests). Bagging and dispatch steps show as "next" but cannot be marked yet; that arrives with custody and dispatch (E7), so it can be an append-only record.
- **Checked on the phone** with the owner's real data: Home, project, hole (including the trace flagging a real gap: a sample with a core box and photo but no logged interval), sample register and sample trace.
- **Data-entry forms redesigned** (new project, hole, box, run, interval, sample): fields sit in titled cards; the **Save button is pinned above the keyboard** (`StickyActions`, with any "Save anyway" warnings) so it is never hidden while typing; From/To depth sit side by side; **quick-length chips** (box 3/4/5 m, run 1.5/3/4.5/6 m, interval 1/2/3/5 m, sample 0.5/1/2 m) fill the To depth from the From depth with one tap; a run shows recovery % and RQD live as the geologist types; a new sample's From depth **starts where the last primary sample ended**; "Full recovery" is one tap. List rows use big tinted **`RowAction` buttons** (Sample, Photos (n), delete) instead of tiny text links. Field labels are unchanged, so the field-day guide still matches. _Checked on the phone:_ box, interval and sample forms (sticky Save, chips, From-depth prefill), and the box and interval lists. Typecheck, lint and all 198 domain tests pass.
- **Official branding applied (app and web).** The owner added the CoreChain logo system in `assets/brand/` (graphite `#182321`, warm limestone `#EEEAE1`, muted copper `#A66A43`; README lists the files and rules: no shadows, gradients, outlines or extra colours). The phone app now uses it everywhere: launcher icon (square, round, Android adaptive and themed/monochrome), a splash screen in limestone (light) or graphite (dark) with the symbol, the horizontal logo in the Home header, the symbol on the empty Home screen, and the colour tokens (`theme.ts`: graphite buttons and text on limestone in light mode, limestone on graphite in dark mode, copper reserved as the brand accent; success, warning and danger stay as the only other hues). The Expo template art (chevron logo, tab icons, blue splash) was deleted. The web app got the same palette, the logo in its landing and workspace headers, and a favicon. The blue in the earlier screenshots and the field-day guide text is gone.
- **Alpha APK built and checked (Sprint 3 goal).** A release build (`cd apps/mobile/android && ./gradlew.bat app:assembleRelease -PreactNativeArchitectures=arm64-v8a`, about 11 minutes, needs roughly 5 GB free disk) produces `app/build/outputs/apk/release/app-release.apk`: 61 MB, package `ph.corechain.field`, "CoreChain Field" v0.1.0, Android 7+ (SDK 24), 64-bit ARM phones only. It is signed with the debug key, so it is for internal testers only (Play needs its own upload key in Sprint 6). _Checked on the phone:_ installed over the dev build, it starts with no computer connected (JavaScript is bundled in) and the existing projects and holes were all still there, so updating keeps a tester's data. Testers install it by opening the file and allowing "install unknown apps".
- **Checked on the phone (forms):** the run form (chips, live recovery 95% for 2.85 of 3 m, pinned Save above the keyboard) and the new-hole form.
- **Still to do:** check the photo screens and light mode on the phone; a bottom tab bar (Home, Photo, Samples, Export) is designed but not built; the bagging action; the same care for empty states and the settings, codes and export screens.

- **Dev-workflow lesson:** after the phone has been in airplane mode, the app's live-reload connection to Metro is dead; edits do not appear until the app is force-stopped and reopened.

### S3 status and S4 start (2026-09-19)

**Sprint 3 is built.** All six stories (E5-1, E5-2, E6-1..E6-3, E9-1) are done and the installable alpha APK exists. What is left is owner-run and is not code: the airplane-mode day (the field-day guide), and showing the alpha to one friendly geologist. The bottom tab bar and "Mark as bagged" are deferred (bagging arrives with custody, E7).

**Sprint 4 (Accounts and backup) has started with the parts that need no cloud account:**

- **E1-4, staying signed in offline: rules done** (`packages/domain/src/session.ts`, 10 tests). A session lasts 30 days from the last time the server confirmed it (sign-in or a successful sync), and the app warns 3 days before. Expired means the data stays readable but can't sync. The wording tells the geologist their data is safe on the phone. Both numbers are configurable.
- **E6-4, device sample-number blocks: rules done** (`packages/domain/src/sampleBlocks.ts`, 12 tests). The server issues each device a contiguous block (default 100 numbers), starting after every block already issued and after the numbers the project used offline before it had a server. Blocks never overlap, a device uses the lowest free number across its blocks, and the app warns when fewer than 20 are left. The server side of this (an endpoint and a database constraint) comes with the backend.
- **Backend data model drafted** (`apps/web/prisma/schema.prisma`, checked with `prisma validate`). It mirrors the phone's tables column for column, because PowerSync will stream them down. It adds `organization_id` and `created_by` everywhere, `project_id` on the tables under a drillhole (so sync can be limited to my projects), a devices table, the sample-number blocks table and an append-only audit log. The sign-in tables are not in it yet: Better Auth generates them when sign-in is wired up.
- **Note on the alpha data:** the offline alpha data on the phone (test-only so far) will attach to the account on first sign-in (E1-3), so the server's first number block starts after the project's own "next sample number".

**Needs the owner before the rest of S4 can start (the decision the risk table lists as "due before S4"):**

1. **Create a managed PostgreSQL database.** Recommended: Neon or Supabase, free tier, in a region close to the Philippines (Singapore).
2. **Create a PowerSync Cloud account and instance** (free tier) and connect it to that database.
3. **Choose where the API runs.** Recommended: Vercel (the web app is already Next.js); the phone must be able to reach it over the internet.
4. **Put the secrets in an environment file, not in chat.** I will add the variable names to a `.env.example` and read them from a local `.env` that is never committed.

I can't create accounts or handle credentials, so this step is the owner's. Everything after it (Better Auth sign-up and sign-in, the upload API, PowerSync sync rules, the phone's sign-in screens) I can build.

**A design risk to settle first (a spike, before the phone's sync code):** the phone's tables are plain SQLite tables the repositories already read and write. PowerSync's default is to manage its own tables. The likely answer is PowerSync's "raw tables", which sync into existing tables, but it must be tried on a device before the sync stories are estimated. If raw tables don't fit, the repositories move onto PowerSync's own tables (more work, no data loss).

### S4 cloud setup done (2026-09-20)

The owner created the accounts, and the server side is standing:

- **Neon Postgres** (`corechain`, AWS Singapore) holds the 13 tables from the first Prisma migration. Two rules Prisma can't express are enforced in SQL: sample-number blocks can never overlap within a project, and a sample number stays unique per project (case-insensitive, deleted rows included). Migrations use Neon's direct connection (`DIRECT_URL`); the running app uses the pooled one (`DATABASE_URL`).
- **PowerSync Cloud** (`corechain` / Development, region **Japan**: it has no Singapore region, and Japan is the closest to both the database and the Philippines) is connected to Neon through a read-only `powersync_role` and a `powersync` publication. Logical replication is switched on in Neon (permanent).
- **Sync Streams** are drafted in `apps/web/powersync/sync-streams.yaml`: a geologist gets the projects they created and everything under them; audit events stay on the server. It is not deployed yet; the owner pastes it into the dashboard.
- Secrets live only in `apps/web/.env` (git-ignored); `.env.example` names the variables.

The live server and sign-in are also up: the web app is on Vercel (`corechain-orpin.vercel.app`) with Better Auth sign-in, three tiers (admin, project manager, geologist), open sign-up switched off (D13), and a token endpoint that PowerSync trusts (Client Auth points at the server's public keys; audience `corechain-powersync`). Tokens last one hour and carry only the user id and tier.

### Sync spike result (2026-09-20, on the phone)

**Raw tables work on the existing encrypted database.** From the app's own build on the Infinix, signed in as a tester:

- PowerSync opened the app's own `corechain.sqlite` (SQLCipher key from the keystore) and left the app's `user_version` (5) and tables alone. The "inferred" raw-table mode reads the existing columns, so **no table on the phone had to change** and the repositories keep their SQL.
- The project and drillhole placed on the server for that user downloaded into the app's own `projects` and `drillholes` tables, and the **app's Home screen showed them** through its normal database connection. First sync took about 4 seconds.
- Timestamps arrive as ISO 8601 text with microseconds (`2026-09-20T05:55:28.964000Z`), compatible with the phone's text columns.
- A local write to a synced table was captured for upload (`PUT projects`).

**Decision D14: the phone keeps its own tables and syncs into them with PowerSync raw tables.** The fallback (moving the repositories onto PowerSync-managed tables) is not needed.

**What the real stories must handle (found or expected, not yet all tested):**

1. **One connection only.** The capture triggers call a function that only exists on connections PowerSync has set up, so once triggers are installed the app's own separate connection can no longer write those tables. The fix is small and mechanical: `database.ts` should hand every repository PowerSync's connection (53 `execute`, 2 `executeBatch`, 1 `transaction` call sites). The spike removed its triggers at the end for exactly this reason. Expected from how SQLite works; confirm in E8-3.
2. **A delete after an upload was not seen.** The insert was offered for upload, but the follow-up delete of the same row was not, within 6 seconds. Cause unknown (timing of the upload loop, or the delete trigger). Re-test insert, update and delete explicitly at the start of E8-3.
3. **Columns the server adds** (`organization_id`, `created_by`, `project_id` on child tables) are ignored by the phone; the upload API fills them (as the schema already assumes).
4. The developer spike screen and its code were **removed on 2026-09-20** (commit history keeps them), and the test project it downloaded was deleted from the server. The test phone still holds the downloaded copy until its app data is cleared.

### S4 sign-in built (2026-09-20)

- **Phone:** sign-in screen (no self sign-up, D13), session in the keystore, 30-day offline session with a warning banner on Home and an account screen with sign-out. Sign-out keeps local data until sync exists; "sign out and wipe" stays with E1-5 in Sprint 5. The server's sessions last the same 30 days.
- **Web admin area** (`/login`, `/admin/users`): the admin signs in, sees everyone, creates a user with a tier (admin, project manager, field geologist) and an easy starting password, changes a tier, resets a password (which also signs out that person's phones), and switches an account off or on. The credentials are shown once for the admin to pass on. Every action re-checks that the caller is an admin, and an admin can't change their own tier or switch themselves off. The operations were tested against the live database: a geologist is refused every admin call.

**Workflow and design principles:** `docs/product/field-workflow-friction-and-design-principles.md` mirrors the real core-handling workflow (with the Philippine reporting rules, DAO 2010-21 and PMRC 2020), maps where it hurts, and sets twelve design principles. Its first finding, from our own alpha, is that the same core depths are typed again for every run, box, interval and sample; the fix (depth shortcuts, then a run-first flow) is sized in section 4 of that document and is to be mocked up and tried with a real geologist before it is built.

**Sync server APIs built (2026-09-20), tested against the real database, not yet called by the phone:**

- **`POST /api/devices`** registers a phone under the account (a device id can't be claimed by another account; a removed device is refused).
- **`POST /api/sample-blocks` (E6-4, server side).** Issues a device a reserved run of sample numbers for one of the account's projects. The project row is locked, so 8 simultaneous requests produced 8 non-overlapping blocks; the database constraint backs it. A device may hold at most 20 blocks per project; sizes 1 to 500.
- **`POST /api/sync/upload` (E8-3, server side, pulled forward from Sprint 5).** Applies the changes a phone made offline: only the ten synced tables and their known columns, every value type-checked, owner and project filled in by the server, retried uploads harmless (duplicates), hard deletes refused (soft delete only), append-only records never changed, one bad change never blocks the others (each has its own savepoint), and every applied change written to the audit log with who and which device. **Two phones editing one record offline produce a recorded conflict, not an overwrite**: the server keeps what it has and stores the incoming change in full. A found-and-fixed bug: asking about another account's record first answered "conflict", which would have confirmed it exists; lookups are now limited to the caller's organization and answer "not found". The phone's connector (E8-3 phone side), the conflict screen and the "needs attention" badge (E8-4) come with the device.

### S4 phone sync wired (2026-09-20)

- **One database connection.** The app's database now opens through PowerSync, and every repository goes through a small adapter over it (`execute`, `executeBatch`, `transaction`), so no screen changed. Migrations run in one transaction each, and a new `sync_issues` table (migration 7) keeps changes the server refused.
- **Connector.** Downloads the account's records on sign-in and uploads local changes to `POST /api/sync/upload` in batches of 50, registering the phone first (`POST /api/devices`). Changes fixed at creation are stripped from edits before sending. Every change is answered, so one refused change never blocks the queue; refused and conflicting ones are recorded and counted.
- **First sign-in adopts existing work.** A phone that already holds alpha data queues it for upload when its first account signs in. Verified on the test phone: 82 records reached the server and the audit log. A phone handed to a different account is cleared at that sign-in, and refused if it still holds unsent work.
- **Status wording** (`packages/domain/src/syncStatus.ts`, tested): "Up to date", "Working offline", "Waiting for signal", "Sending your work", "N changes could not be sent". Out of signal is never presented as a problem. Shown under the greeting on Home and in full on the Account screen.
- **Found and fixed:** the server function ran in the US (`iad1`) while the database is in Singapore, so each query paid a long round trip and a batch of offline changes ran past the platform's time limit. The function is now pinned to Singapore (`apps/web/vercel.json`) and the upload route may run 60 s.
- **Verified on the test phone (2026-09-20):** a new project made on the phone reached the server within seconds; an edit arrived as an update (version 3 after two saves); a project created on the server appeared on the phone; a change made with Wi-Fi and mobile data off showed "Waiting for signal · saved on this phone" and reached the server by itself when the connection came back; a project deleted on the server disappeared from the phone.
- **Found and fixed while verifying:** when the server removed records, the phone queued the removals as if the geologist had made them, the server refused them, and the app showed "82 changes could not be sent". The phone now never sends removals (the app only ever marks records removed), and the Account screen lists why any change was refused. The feedback screen's Save button sat under the Android navigation bar; it now clears it.
- **Sample-number blocks on the phone (E6-4, built and verified 2026-09-20).** The phone asks the server for a run of 100 numbers per project once everything is sent and the first download is done, and again when fewer than 20 are left. The next number comes from the run, skipping numbers already taken (including hand-typed tags); the project counter is used only until the first run arrives, and stops moving once a run is held. If a run is used up there is no suggestion, and the form says to connect for more. Verified: the server issued numbers 1–100 to the test phone and the new-sample form suggested AGS-00016 after 15 samples.
- **Sample project.** `npm run sample:seed -- <email>` loads the Alberta sample project (official AGS DIG 2024-0022 holes and intervals; illustrative boxes, runs and samples) into an account, for demos.
- **Depth shortcuts verified on the phone (2026-09-20):** the "known depths" chips (logged to, run or box end, planned depth) and the quick-length chips (0.5, 1, 2 m) fill the depth fields correctly in the sample form.
- **Not yet verified on the phone:** sign-out then sign-in on the same phone, the low-numbers warning and the used-up-run case. Still to do in S4: nothing else. Production PowerSync instance: added before the field test (the free plan includes two instances; it switches projects off after a week of inactivity, so the field test should use the $49/month plan).

### S5 started: sign out and remove data (E1-5, 2026-09-20)

- **What it does.** The Account screen has a red "Sign out and remove my data" button below the normal "Sign out". Before removing anything it counts what exists only on the phone (changes not sent, changes the server refused, photos, unsent feedback) and lists them in plain numbers (`packages/domain/src/signOut.ts`, tested). If nothing is at risk it says so and that everything comes back at the next sign-in; otherwise it defaults to Cancel and the button reads "Remove anyway". The wipe removes the records, queued changes, unsent feedback, photo files, the data-owner marker and the sign-in, and tells the file to give back the freed space.
- **Photos.** A photo counts as "only on this phone" until its file has been backed up (E5-3, phone half built 2026-09-21).
- **The same wipe now runs when a phone changes account**, so a second account never inherits the first one's photos or unsent feedback.
- **Verified on the test phone:** after the wipe and a fresh sign-in the Alberta sample project came back from the server, and the server's counts were unchanged (one project, six holes, 27 intervals, 15 samples), so nothing was duplicated.
- **Found and fixed:** after that sign-in Home kept showing "Start your first project" until the app was restarted, because screens loaded their lists once, on opening. The sync layer now counts each completed sync and every list screen reloads when it changes (`useFocusReload`). Verified on the test phone with a second wipe and sign-in: the project appeared on Home by itself, with no restart.

### S5: custody and dispatch built (E7-1, E7-2, E7-3, 2026-09-20)

- **Custody record (E7-1).** Each sample has a chain of custody: bagged, sealed, handed over (to whom, where, when, by whom). Steps are only ever added. A mistake is corrected with a new "correction" step that says who found it and why; the wrong step stays on the record marked "Voided". Only the latest step can be corrected, so a correction never leaves a seal with no bagging under it. A sample's status (created, bagged, dispatched) is worked out from the steps that still count. Steps can be recorded on many samples at once from the register's new "Select samples" mode; any that cannot take the step (already bagged, not bagged yet) are skipped and listed, never half-recorded. A sample with a custody record cannot be deleted.
- **Lab dispatch (E7-2).** A dispatch groups bagged samples for one laboratory (DSP-001, DSP-002 ...), with a preparation request and note. While open, samples can be added and taken out, and a sample can be in only one open dispatch. Handing it over asks first, then writes a "dispatched" step on every sample in it and closes the dispatch. All of it is one transaction.
- **Dispatch sheet (E7-3).** A CSV with the dispatch, laboratory, request, handover date and who handed over, a count by type, then one line per sample (ID, type, hole, from, to, QC note such as the reference material or "Duplicate of ..."), shared through the Android share sheet.
- **Dispatch sheet as a PDF (E7-3, 2026-09-21).** The dispatch screen now offers **Share dispatch sheet (PDF)** as the main button and the CSV as **Share as spreadsheet (CSV)**. The PDF is one A4 page built from the same data: dispatch number, laboratory, request, handover date and who handed over, a count by type, a numbered sample table (ID, type, hole, from–to, QC note, a blank "Rec'd" box for the lab to tick) and three signature lines (handed over by, received by, date and time received). The page is made by `dispatchSheetPdf` in `packages/domain/src/custody.ts` (5 tests; typed text is escaped) and turned into a PDF on the phone with `expo-print`. **Verified on the test phone:** the button makes `dsp-001-sheet.pdf` and opens the share sheet with that name (nothing was sent). The layout was checked in a desktop render of the same page; the phone's own PDF was not opened, and a long list running onto a second page is untested.
- **Rules are tested** in `packages/domain/src/custody.ts` (28 tests). Server tables `custody_events` (append-only), `dispatches` and `dispatch_samples` have upload rules with tests, and an additive database change in `apps/web/prisma/migrations/20260920120000_custody`.
- **Database change applied (2026-09-21).** The owner ran `npx prisma migrate deploy` against the live database. The updated PowerSync streams are not deployed yet, and nothing has been tried on the phone: the app builds, type-checks and lints.
- **Order matters.** Apply the database change first, then let PowerSync read the new tables (next point), then deploy the streams, then install the app. A phone that sends custody records before the server has the tables would have them refused, and refused changes are not retried.
- **A server bug found in the first phone test (2026-09-21), and how it is now guarded.** The handover date was created as a real database date, but the upload rules send days as text (like a hole's start and end dates), so Postgres refused every handover: the dispatch stayed "open" on the server while its samples were dispatched. Three layers now stop this class of bug: (1) the column is text like the other days (migration `20260921040000_dispatch_handover_day_text`, applied to the live database on 2026-09-21); (2) a test compares the upload rules with the database schema for every synced table and column, and checks the phone and server agree on which tables sync and which columns are fixed, which also caught a second bug (taking a sample out of a dispatch would have been refused); (3) the Account screen shows the refusal code and offers **Send again**, which puts a refused record back in the queue, so a refused change is never lost for good. Verified on the phone and server the same day: DSP-001 was finished with a repeat handover (which no longer duplicates custody steps), the server shows it Dispatched with its handover day and exactly one dispatched step per sample, and the phone reports Up to date.
- **Every new table needs a PowerSync grant.** The `powersync_role` user only reads tables it has been granted, and the `powersync` publication only covers tables added to it, so a migration alone is not enough. The dashboard says "permission denied" and "not part of publication" until the owner runs, once, in the Neon SQL editor: `GRANT SELECT ON ALL TABLES IN SCHEMA public TO powersync_role;`, `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO powersync_role;` and `ALTER PUBLICATION powersync ADD TABLE custody_events, dispatches, dispatch_samples;`. The default-privileges line means later tables are readable automatically, but each still has to be added to the publication.

### S6 started: first-run guide and feedback (E10-1, E10-2, 2026-09-22)

- **E10-1, first-run guide.** An 8-step coachmark walkthrough (`apps/mobile/src/guide/`, `components/guide/coachmark-overlay.tsx`) that creates a real "Practice project" and walks the geologist through it screen by screen: a step only advances once the geologist does the real action the step asks for (create the hole, save the box, and so on), not just by dismissing the tip. Replaying the guide deletes the previous practice project first, so it never leaves more than one behind. Account shows "Not completed yet" / "Replay guide" and a "Delete practice project" action.
- **E10-2, in-app feedback — two gaps found and closed this sprint.** The feedback screen itself, its queue and its admin inbox were already built in an earlier session, but the entry point only existed on Home and Account, and there was no way to attach a screenshot. Closed both: a small message-bubble icon now sits in the header on every screen (`components/feedback-header-button.tsx`), and opening it captures a screenshot of the screen the geologist came from (`react-native-view-shot`, pinned to `5.1.0` to match Expo SDK 57) with a thumbnail preview and a "Remove" option on the feedback form. The upload is a single best-effort attempt (never retried) once the message itself sends, unlike photos' full retry queue, since the screenshot is an optional extra, not the report. Server side: `feedback.storage_key` column (migration `20260921050000_feedback_screenshot`, applied to the live database 2026-09-21), a private-Blob upload/download route with ownership checks, and the screenshot shown inline in the admin feedback list and counted in the CSV export.
- **Verified on the test phone (Infinix, Android, 2026-09-22), after a full native rebuild for the new `react-native-view-shot` dependency:** the first-run guide's card appears on Home, "Start guide" creates the practice project and opens it with the step-2 coachmark; "Got it" dismisses the tip without losing the screen; tapping "New drillhole" both advances the guide to step 3 and opens the real form; the guide's progress survives a force-stop and relaunch (resumed on the same step with the practice project intact). The feedback header icon opens the form with a screenshot thumbnail attached from every screen tried (Home, a project); "Remove" clears it; a real test message ("Device verification test for E10-2 feedback screenshot upload") was sent with the screenshot attached and appeared under "Your recent messages" as New — confirming the migration and upload route work end to end against the live server, not just in code.
- **A testing-tool pitfall, not a product bug, cost real time and is worth recording.** Driving the phone over `adb` by reading button positions off `screencap` screenshots and computing tap coordinates by hand looked exactly like a frozen app: taps at the visually-read position of "Start guide" and the coachmark's "Got it" did nothing at all — no crash, no ANR, CPU not pegged, and even the hardware back key did nothing, for several minutes, until the app was force-stopped and relaunched. Pulling the real on-screen element bounds with `adb shell uiautomator dump` showed the true tap targets were hundreds of pixels away from where they were being eyeballed in the screenshot for those two specific buttons (other buttons on the same screens matched the eyeballed position closely). Tapping the coordinates `uiautomator dump` actually reported worked immediately and every time after. **Lesson: when driving this app over adb, get tap coordinates from `uiautomator dump`'s `bounds`, never by reading pixel positions off a `screencap` image** — the two are not reliably the same coordinate space on every device/ROM, and the mismatch reads exactly like a hung app until it's ruled out.

### S6 continued: crash reporting (E10-3, 2026-09-22)

- **E10-3, crash reporting.** Uses Sentry (`@sentry/react-native`, free tier — the owner created the account and a `corechain-field` project themselves; Claude cannot create accounts) rather than a self-hosted outbox like feedback's, because Sentry captures JS exceptions, unhandled promise rejections and native (JVM/NDK) crashes on its own, queues them on the phone when offline and sends them once connected, and attaches app version and device model automatically from the native build — none of that needed reinventing. `initSentry()` and a `useSentryScreenTracking()` hook (tags every report with the current screen, the same `useSegments()` idea as E10-2 feedback) live in `apps/mobile/src/crash/sentry.ts`, wired into the root layout (`Sentry.wrap(RootLayout)`, `initSentry()` at module load). The DSN is not a secret (Sentry's own design — it ships inside client apps) so it sits as a plain default in `apps/mobile/src/config.ts`, `SENTRY_DSN`, with the usual `EXPO_PUBLIC_…` override for a different project later. Source-map upload (readable stack traces in the Sentry dashboard) was left for later — it needs a second, real secret (a Sentry auth token) that the free DSN setup does not.
- **Verified on the test phone (Infinix, Android, 2026-09-22), after a full native rebuild for the new `@sentry/react-native` native module:** confirmed via `adb logcat` that the SDK initialised with the correct DSN and installed its crash/error-handling integrations on launch. To prove capture actually works, a temporary forced JS exception was added, the app force-stopped and relaunched, and the device log showed `Sentry Logger: Captured error event 'E10-3 verification crash…'` — the SDK caught and queued the real, unhandled exception, not just a manually-reported one. The temporary crash and the verbose `debug: true` logging used to see that line were both removed immediately after, and the app was relaunched a final time to confirm normal startup (home screen renders, no errors in the log) on the exact code being committed. **Confirmed end to end by the owner (2026-09-22):** the same crash appears in the Sentry dashboard's Issues list for the `corechain-field` project — "E10-3 verification crash — TEMPORARY, remove before commit", Unhandled, pointing at the `setTimeout` in `_layout.tsx`, 4 events from 1 user. The full path from an unhandled exception on the phone to a readable issue in Sentry works.

### S6 continued: feedback inbox filters (E10-6, 2026-09-22)

- **E10-6, tester feedback inbox.** The admin feedback page (`apps/web/app/admin/feedback/page.tsx`) already had category and status filter chips from an earlier session; this closes the story's remaining two, tier and app version. Tier uses the same fixed `USER_ROLES` set as the rest of the app (so it reads "Field geologist", not "geologist"); app version has no fixed set, so its chips are the distinct versions actually present in the data, newest first, and the whole filter row disappears if no feedback has a version yet. All four filters compose (the URL carries all of them at once) and each existing chip link was updated to keep the other three selected when you switch one.
- **Verified in code and confirmed on screen by the owner.** Typecheck, lint, the full test suite and the production build all pass. A read-only query against the live database (the one this project's dev environment points at — there is no separate local database) confirmed the real shape the new filters need to handle: one feedback row so far, tier `"geologist"` (a valid `USER_ROLES` value) and app version `"0.1.0"` (a plain string, not an enum), both routed through the same code path as the UI. The admin area needs a password sign-in, which is not something Claude does even with the password provided, so the owner checked the deployed site (`corechain-orpin.vercel.app/admin/feedback`, 2026-09-22): all four filter rows render — kinds, status, and the two new ones, tier (Field geologist, QA/QC, Laboratory, Resident / project manager, Admin) and version (v0.1.0, the one version logged so far) — with the existing feedback item still showing underneath.

### S6 continued: admin first-run checklist (E10-5, 2026-09-22)

- **E10-5, admin first-run checklist.** A "Set up your first tester" card on the Users page (`apps/web/app/admin/users/users-workspace.tsx`) listing the three steps the story asks for — add a user, choose their tier, send them the login — each checked off as it actually happens: the first two the moment a non-admin account exists (they're one step in the existing form, since a tier is chosen as part of creating the account), the third once the admin has clicked "Copy email and password" on a set of credentials at least once. The whole card disappears once all three are done, or if hidden early, and a small "Show setup checklist" link brings it back any time — matching "it disappears once done and can be shown again" exactly. Whether it's done and whether it was hidden early are both per-browser (`localStorage`), not server state: nobody else needs to see the owner's own onboarding progress, and it doesn't need a database migration.
- **A real lint failure, not a false alarm, changed the implementation.** The first version read `localStorage` in a `useEffect` and called `setState` from it — the standard-looking way to avoid a server/client hydration mismatch for browser-only data. The project's ESLint config (`react-hooks/set-state-in-effect`) flags that as an anti-pattern and failed CI on it. The fix was `useSyncExternalStore`, React's own mechanism for exactly this case (a getServerSnapshot of `false` matches the server's render with no crash, then the client re-renders with the real stored value on its own, with no manual effect needed) — the correct fix, not a suppressed warning.
- **Verified in code and confirmed on screen by the owner (2026-09-22), same as E10-6.** Typecheck, lint (including the rule above) and the full test suite pass, and the production build succeeds. On the deployed site, with existing tester accounts already present, the card correctly opened with "Add a user" and "Choose their tier" already checked and only "Send them the login" open; after creating an account and clicking "Copy email and password" on its credentials card, the whole checklist disappeared, replaced by a "Show setup checklist" link. Every branch the story asks for — partially done, freshly done, and brought back afterward — was seen working on the real page, not just reasoned about in code.

### S6 continued: update prompt and minimum version (E10-8, 2026-09-22)

- **E10-8, update prompt and minimum version.** The server now states the oldest app version it still accepts (`MIN_APP_VERSION`, `apps/web/lib/minAppVersion.ts` — an environment variable the owner can raise later without a code change, defaulting to `0.1.0` so every phone shipped so far is accepted). The phone learns it from `POST /api/devices`, the existing "this device is mine and still in use" call (already sent at sign-in, before the first upload of a session, and whenever sample numbers run low), which now also returns `minAppVersion` in its response; the phone keeps the last value it learned in the keystore, so it shows the right thing immediately at open, even offline. A new domain function, `versionStatus` (`packages/domain/src/appVersion.ts`, 8 tests), compares the phone's own version (`Constants.expoConfig?.version`, read once as `APP_VERSION` in `apps/mobile/src/config.ts`) against that minimum with plain dotted-numeric comparison (`0.10.0` > `0.9.0`, not string order). Below the minimum, syncing stops exactly the way an expired sign-in already stops it — local data stays fully readable and keeps saving, nothing is deleted or locked — and the Account screen shows "Update CoreChain to keep syncing" both as its own alert and as the main sync-status card's title (`syncSummary` in `packages/domain/src/syncStatus.ts` gained an `outdated` fact so the two cases read differently: an expired sign-in says "sign in again", an old app says "update").
- **The second half of the story — a phone that missed weeks of patches still syncs — is a promise about how the owner uses `MIN_APP_VERSION`, not new code:** the default only ever accepts, and raising it is meant to happen only when a database change actually breaks older phones, never on every release. There is nothing to verify on the phone for that half; it is a discipline to follow later, noted here so it is not forgotten.
- **Verified in code.** Typecheck, lint, the full test suite (`appVersion.test.ts`'s new cases plus the updated `syncStatus.test.ts` cases) and the web production build all pass, and `npx expo export --platform android` bundles the app cleanly with the new code path.
- **Verified end to end on the test phone (Infinix, Android, 2026-09-22), against the real deployed server, no native rebuild needed since this added no new native module.** After committing and pushing so the live server actually returns `minAppVersion`, `APP_VERSION` was temporarily hardcoded below it (the same "temporary, remove before commit" approach used to verify E10-3's crash capture) and the app relaunched: Home's status changed to "Update CoreChain to keep syncing", and the Account screen showed both the dedicated alert ("Your data is safe on this phone and keeps saving here — it just cannot reach the server until you update") and the same title on the main sync card, while the sign-in card above it still correctly read "Signed in" — confirming the two are tracked separately, an expired sign-in and an old app read differently. Every project and its progress kept rendering on Home throughout, showing local data is untouched. The temporary override was then reverted and the app relaunched a final time on the exact code being committed: status returned to "Up to date. Last synced just now." `git diff` on the reverted file showed no changes, confirming the test left nothing behind.

### S6 continued: over-the-air patches (E10-7, 2026-09-22)

- **E10-7, over-the-air patches.** Uses `expo-updates` with Expo's own free EAS Update service, exactly as the story asks ("Expo's own update service to begin with; a self-hosted server is possible later"). The owner created a free Expo account and organisation (`corechain`) and signed in with `eas login` themselves — Claude never saw the password, only verified success afterward with `eas whoami`. `app.json` gained `extra.eas.projectId`, `runtimeVersion: {"policy": "appVersion"}` (ties patch compatibility to the app's own version string, giving "one runtime version per native build" for free), and an `updates` block pointing at the project's EAS Update URL with `checkAutomatically: "ON_LOAD"` and `fallbackToCacheTimeout: 0` — the documented defaults that produce exactly "checks when it opens, downloads quietly, applies on the next start", with no custom code needed. A `requestHeaders: {"expo-channel-name": "production"}` entry stands in for the channel tag `eas build` would normally inject automatically, since this project builds locally with Gradle, not through `eas build`. `npm run publish-update` (`apps/mobile/package.json`) runs `eas update --channel production --environment production`, the one command needed to ship a patch.
- **The signing-key requirement in the story ("patches are signed, so the phone only accepts ours; the signing key is an owner-held secret, like the Play upload key") could not be met.** EAS Update's custom code signing, which lets an app verify patches against a certificate baked into the native build using a key only the owner holds, is an EAS Enterprise feature — `eas update` refused to publish with `--private-key-path` set, with "EAS Update code signing requires a subscription to the EAS Enterprise plan. This account (corechain) currently does not have a subscription plan." Enterprise pricing is not published (contact-sales only), so, the same as the unfunded Play developer account, this was treated as a real budget constraint rather than routed around. What ships instead: the app only ever fetches patches from this project's own EAS Update feed over HTTPS, so nobody can push a patch to a tester's phone without control of the `corechain` Expo account — real protection, just not the owner-held key the story describes. If the owner later takes an EAS Enterprise plan (or a self-hosted update server, which the story allows for "later"), `codesigning:generate` + `codesigning:configure` plus one more native rebuild would add it; nothing in this implementation blocks that.
- **Needed one new native build that includes `expo-updates`, landing in the first tester build as the story requires.** `npx expo prebuild --platform android --clean` followed by `npx expo run:android` added the module; `AndroidManifest.xml` confirmed to carry the expected `expo.modules.updates.*` configuration afterward.
- **Free-plan limits, checked before relying on it (per the story):** EAS Update's free tier covers 1,000 monthly active users, 100 GiB of update bandwidth and 20 GiB of stored update assets, with unlimited published updates and no pay-per-use overage charges — comfortably enough for a 2–5-tester field pilot.
- **Verified end to end on the test phone (Infinix, Android, 2026-09-22), with a genuine published patch, not just a code review.** A debug build first confirmed the app still installs and opens correctly with `expo-updates` present. Getting a real signal required a **release** build — a debug build stays connected to Metro and `expo-updates` never checks for patches while it is — so `assembleRelease` (signed with the existing debug keystore for this local test) was built and installed. On the very first check, the server correctly returned nothing new, because that build's own embedded bundle was already byte-identical to the one already published (both built from the same source). To prove an actual patch, the Home screen's greeting was temporarily changed to "Good morning (OTA test)" (same "temporary, revert before commit" technique as E10-3 and E10-8) and published. Device logs (`adb logcat`, the app's own `dev.expo.updates` state-machine messages) showed the full sequence on the next open — `Check` → `CheckCompleteAvailable` → `Download` → `DownloadComplete` (`isUpdatePending=true`) — while the screen still read the old text that same launch, exactly as promised ("applies on the next start", not immediately). Force-stopping and reopening once more showed "Good morning (OTA test)" on screen, and the app's own manifest ID in the logs matched the ID `eas update` had reported when publishing. The change was then reverted (`git diff` confirmed no changes left behind) and republished — the exported Android bundle hash for the reverted publish was byte-identical to the very first, unpatched publish, confirming the revert was clean — and the same download-then-apply cycle was watched a second time, ending on the correct, real Home screen with no leftover test text. No custom code exists yet to exercise "falls back to the version it shipped with" on a failed patch (`expo-updates`' automatic rollback-on-repeated-crash is a built-in default, not something this story added) or the forward-only database-patch rule (no patch published so far touches the database) — both remain unverified until a real patch needs them.

### Team-release push toward an MVP demo (2026-09-22)

**Decision, 2026-09-22 (owner):** a contact is willing to bring CoreChain into their geology team if it can be demoed; the owner asked to build out the remaining team-release scope (E11, E12, E13) rather than stop at Sprint 6, and confirmed the laboratory is in-house (see E13 above). The owner is also currently between paid work, so anything with an ongoing dollar cost (a funded native iOS build, a Play developer account) stays deferred; see `ios-support-deferred` in the assistant's own memory for the related, narrower decision about a temporary browser-based fallback for iPhone-only field volunteers, tracked separately from this MVP push since it hasn't been built yet.

- **Native Android dev build reinstalled and confirmed running** on the test phone (Infinix, Android) after `npx expo run:android` (the `--device <serial>` flag does not accept a raw adb serial and must be omitted to auto-select the one attached device). Confirmed via `adb`-pulled screenshots: the app opened straight to a signed-in Home screen with real synced data, including a project ("Alberta sample project", 6 holes with real-looking hole IDs) that is not the seed/demo project — the basic PowerSync pipeline through the new sync streams (E11-1) is genuinely working.
- **The specific thing E11-1 was built for — one teammate's phone receiving a project a* different* teammate created — is still unverified.** Checked directly against the live database: every account's `organizationId` is still null (nobody has actually been placed on a team yet), so the project seen on the phone only synced because of the personal-workspace fallback (a solo user's own effective org is their own id), not a real cross-teammate share. Testing the real scenario needs the owner to create a team and add two accounts to it on `/admin/users` (the picker already exists, built with E11-1), then either re-pair a device or have the other teammate create a project and check whether it reaches the first phone after a sync — schema comment on `Organization` in `prisma/schema.prisma` notes joining a team only takes effect on a device's *next* registration, not retroactively.
- **E12-5 audit trail, finished.** Resolved exceptions now show inline on the QA/QC queue, keyed by a stable string so a resolution still applies if the same condition recomputes later; when it no longer does, the resolution stays visible with a kind-based label rather than being dropped (`QAQC_EXCEPTION_KIND_LABELS`, `exceptionKindFromKey`, `packages/domain/src/qaqc.ts`).
- **E11-2, E11-3, E11-4 and all of E13 built** (see each story above for detail). A new shared `DismissibleHint` component (`apps/web/components/dismissible-hint.tsx`, same per-browser localStorage pattern as the E10-5 admin checklist) gives `/laboratory` and `/team/activity` a short "how this screen works" tip, since neither has a guided walkthrough of its own yet — a lighter version of the phone's first-run guide (E10-1), not a full coachmark tour.
- **Caught before it shipped:** the new `received` custody event type (E13-2) would have rendered as blank/`undefined` on the phone's own custody timeline (`apps/mobile/src/components/custody-timeline.tsx` reads `CUSTODY_LABELS` for every event type it receives from sync), since that table syncs to the phone regardless of the fact geologists never write this event type themselves. Fixed by adding it to `CUSTODY_EVENT_TYPES` and `CUSTODY_LABELS` in the shared domain package (not to `RECORDABLE_EVENT_TYPES`, since the phone still never writes it) rather than only to the web-side type.
- **All five migrations from this push applied to the live database 2026-09-22** (the owner ran `npx prisma migrate deploy` from `apps/web`): teams, hole assignments, drillhole priority, QA/QC stage reviews, and `20260922075705_laboratory_assay_results` (adds `received` to `CustodyEventType`, the new `assay_results` table, `Dispatch.resultsReturnedAt`). No new PowerSync grant was needed for this one — `assay_results` stays web-only and deliberately out of `sync-streams.yaml`, and `custody_events`'s existing grant and publication membership already cover the new enum value.
- **Committed and pushed to `main` in four commits 2026-09-22**, grouped by story (foundation/teams/assignment/priority; QA/QC; team overview/activity/hole-view/laboratory; scrum-plan doc), CI green on each.
- **Verified in code only for everything built today:** typecheck, lint (both apps), the full test suite (627 tests: 228 web + 399 domain, including 11 new for `packages/domain/src/laboratory.ts` and a fix to the existing schema-agreement guard test for the new enum value), and a production build all pass. Nothing above has been clicked through signed in as a project manager, QA/QC or laboratory account yet — Claude does not enter the owner's password into any login field, so that verification, and the real teammate-to-teammate sync test, are still the owner's own next step.

### S6 continued: cross-account team sync verified, and sync reliability fixes (2026-09-23)

- **The open question from 2026-09-22 is resolved: one teammate's phone receiving a project a *different* teammate created now works, verified on two real accounts.** The owner added both test accounts to Test Team on `/admin/users`; after a second phone registered signed in as `teamteam2@corechain.test`, `SYNCTEST-01` (created by the other teammate) synced down and showed "Up to date · saved on this phone" — the first genuine cross-account team sync of the project, not the personal-workspace fallback line 891 above was actually testing.
- **Root-caused and fixed a stuck-sync bug** ("57 changes left to send" with no way to tell why): a phone's device id was permanently bound to a different account (device identity is claimed for good on first registration, by design), and `registerDevice()` failed silently with no log and no timeout, so sync retried forever with nothing visibly wrong. Fixed with request timeouts on every sync network call (`connector.ts`, `device.ts`) and a `resetDeviceId()` path so a phone can mint a fresh identity when it changes hands or an owner switches test accounts.
- **Fixed drillhole creation being silently refused:** `toWireOperation()` only stripped manager-only columns (`priority`, `priority_note`) on `PATCH`, never on the initial create, so every new hole failed the server's upload rule the moment priority shipped. Now stripped on every outgoing operation (`PHONE_READ_ONLY_COLUMNS`).
- **Found and fixed a genuine PowerSync bug affecting two sprints' worth of columns.** `wipeDevice()` (account switch, or "remove my data") calls PowerSync's `disconnectAndClear()`, which was silently reverting a raw table's physical columns back to whichever shape PowerSync first inferred for it — with no effect on SQLite's own `user_version`, so the migration system had no way to notice a column it had already added was gone. This had already cost `priority`/`priority_note` from Sprint 6 and now `created_by` (migration 16, added this session for E7 custody traceability and this card). Fixed by re-checking every column any migration has ever added via `PRAGMA table_info` after a wipe (and on every normal open, as a safety net), re-adding whatever is missing, then re-running `updateSchema()`. Verified on the test phone: a real "remove data" wipe now keeps `created_by`, where before it silently lost it.
- **"Continue where you left off" now scoped to the signed-in person's own holes.** With `created_by` reliably surviving a wipe, `getMostRecentDrillhole()` filters by the signed-in user's own `created_by` (treating `NULL` as "mine" too, since a hole this phone just created has no `created_by` until the next sync round-trip stamps it). Verified on the test phone: the card correctly disappeared once the signed-in account had no holes of its own, instead of claiming a teammate's freshly-synced work as the viewer's own day.
- **Found and fixed a request storm while testing the above:** `sync-context.tsx`'s `refresh()` calls `topUpSampleBlocks()` on every PowerSync `statusChanged` event, which turns out to fire several times a second even while idle — far more than the function's own "safe to call as often as you like" comment assumed. A refused sample-block request (404: project not provisioned, 409: no runs left) was retried on every single one of those, hammering `/api/devices` and `/api/sample-blocks` indefinitely. Fixed with a 60-second per-project cooldown after any attempt. Verified on the test phone: `registerDevice` calls dropped from dozens per second to two in 30 seconds.
- **Also fixed:** a harmless but noisy `"POP_TO_TOP" not handled` navigation warning on sign-out, caused by a redundant `router.dismissAll()` racing the `Stack.Protected` guard's own navigation.
- **Deferred to next session:** a synced roster (id → name) so the phone's custody timeline can show "logged by [name]" — the `created_by` id is stored but the phone never syncs the `user` table, so there is nothing yet to turn an id into a name.
- **Verified on the real test phone:** all of the above, end to end (cross-account sync, the wipe/column-repair fix, the home-card scoping, the request-storm fix), not only in code. Typecheck, lint and the full 627-test suite also pass. Committed and pushed to `main` in two commits.

### S6 continued: guide copy, export prefix, and a redesigned drillhole status (2026-09-23)

- **First-run guide copy fixed to match the real button labels**, found by running the guide live on the test phone rather than only reading the screen source: the new-drillhole, add-box and log-interval steps told the geologist to tap buttons that don't exist under those names (e.g. "Add box" vs. the real "Add first core box"). Verified live by replaying the guide after each fix.
- **E9-1 export gained an optional "File name prefix" field**, session-only (nothing persisted), so a geologist can hand a client- or lab-labelled copy of the CSVs without renaming the project. Verified live: typing a prefix live-updated every filename in the list.
- **E2-3 redesigned: drillhole status is now derived, not picked.** The manual status chip routinely went stale, since nothing required the geologist to update it — and the web Team overview's stale-hole alert (`ACTIVE_STATUSES`, `app/team/page.tsx` and `app/team/activity/page.tsx`) reads this same field, so a forgotten chip was silently breaking that alert too. `deriveDrillholeStatus` (`packages/domain`) now computes status from what's actually recorded — a box, run or interval; actual dates or a final depth saved; full logging coverage — and it's reconciled after every box, run, interval or actuals save, and whenever the hole screen loads (so a teammate's synced-in work reconciles too). The status card and chip picker are gone from the drillhole screen; only the read-only pill remains.
- **Verified on the real test phone, all four states:** a freshly created hole (`DDH-COMPLETE-TEST`, 0 boxes, 0 intervals) showed Planned; adding a first core box to another hole moved it to Drilling with no chip tapped; saving a Completed date on `DDH-COMPLETE-TEST`, with still no core recorded at all, moved it straight to Complete; logging a hole's full planned depth moved it to Logged. Typecheck, lint and the full test suite (228 web + 418 domain) pass. Committed and pushed to `main` in four commits.

### S6: a mandatory first-login orientation, a named custody log, and the first APK sent to testers (2026-09-23)

**Decision, 2026-09-23 (owner):** distribute to testers today as a signed APK sent directly, not through Google Play internal testing — a tester may want to keep their own copy of the app, and listing it on the Play Store could work against that.

- **New: a mandatory first-login orientation** (`apps/mobile/src/app/orientation.tsx`). The first time an account signs in on a phone, it's held on a short, un-skippable screen before Home is reachable (`Stack.Protected` in `app/_layout.tsx`, the same mechanism that already gates sign-in): confirm or edit the name the admin set when creating the account, then two short cards pointing out the feedback icon and how sync status works. The name is saved through a new self-service `PATCH /api/account/name`; `useSession()` gained `updateName()` to keep the phone's cached session in step. This is separate from the full guided walkthrough (E10-1), which still covers the actual field workflow and remains opt-in from Account.
- **New: a synced-team roster so custody shows who logged it.** `GET /api/roster` (id + name only, for the signed-in account's team, or just themselves if not on one) is cached in a new local-only table (`apps/mobile/src/data/rosterRepository.ts`, not PowerSync-synced — the phone/server table-agreement test requires every synced table to also be a formal upload target, which a read-only roster shouldn't be). The custody timeline now shows "Logged by [name]" under a step, resolved from the record's `created_by`, closing the gap noted in the 2026-09-23 entry above ("the `created_by` id is stored but the phone never syncs the `user` table").
- **"No photos yet" card redesigned** to match the richer empty-state pattern already used on the samples list (icon, heading, a line of help text) instead of one plain line of body text, per the owner's request while reviewing the phone screens.
- **A real bug found while verifying live, not a false alarm: the orientation screen could hang forever.** The first build showed "Opening your data..." indefinitely on a freshly signed-in phone — the local orientation-status check had no timeout and no error handling, so a rejected or never-settling promise left the screen frozen with nothing logged (a release build swallows an unhandled rejection silently). Fixed with a 5-second watchdog and a catch that falls through to orientation rather than hang, the same pattern already used for the network timeouts in `sync/device.ts` and `sync/connector.ts`. Also dropped an unneeded `CHECK` constraint from the new local table while narrowing this down.
- **A second real bug found live: the custody timeline showed a raw account id.** Confirming a lab receipt (`laboratory/actions.ts`) stamped the custody event's `handledBy` with the lab account's internal id instead of its name, so a step read "Received by laboratory · 4XFbuAp0jqYnxr8GjQVrWJ0g8VhyzvaL" on the phone. Fixed to use the signed-in account's name, the same as every other custody event already does. (The one existing test-data event with the old value was left as is — custody events are append-only and this is test data, not production.)
- **A build-only issue, not a product bug:** the release build failed outright with "Auth token is required for this request" — Sentry's Gradle plugin tries to upload readable source maps on every release build, which needs a second secret (a Sentry auth token) beyond the free DSN already configured. Built with `SENTRY_DISABLE_AUTO_UPLOAD=true` instead of routing around it; crash capture itself is unaffected, only the dashboard's stack traces stay un-symbolicated until that token exists.
- **Verified on the real test phone, a full clean run:** uninstalled and freshly installed the signed release APK, signed in as a Test Team account (`teamteam2@corechain.test`) — orientation appeared with the name pre-filled from the account, editing it to "Test2 Verified" and continuing saved it (confirmed afterwards on the Account screen), the tour cards read correctly, "Start working" reached Home, and relaunching the app went straight to Home with no repeat. Opened a real dispatched sample and confirmed its custody timeline now reads "Logged by lab1" for the lab's receipt step, resolving a *teammate's* name, not just the signed-in account's own. Typecheck, lint and the full test suite (228 web + 418 domain) pass. Committed and pushed to `main` in two commits; the APK built from the second (fixed) commit is the one handed to the owner for today's tester rollout.
- **"No photos yet" verified live too, and one more real bug found in the process: photo backup silently never worked for any team account.** Taking a real test photo on `teamteam2@corechain.test` (a Test Team account, not a personal workspace) left it stuck on "waiting to back up" forever — no error shown, `PUT /api/photos/[photoId]/file` answered 404 "photo-not-found" every retry, ignoring Wi-Fi and repeated manual "Back up now" taps. Root cause: the route looked the photo's record up by the caller's raw account id, but a photo's `organization_id` is always the uploading device's *resolved* organization id (a team's shared workspace if the admin put the account on one, per `lib/devices.ts` — otherwise the account's own id). Those two ids only match for a solo, personal-workspace account, so any photo from a teamed account — which is now most of today's test accounts — could never be found. Fixed to resolve the same effective organization id everywhere in the route, confirmed by diagnostic logging (added, read, then removed before committing) showing the exact 404 before the fix and a clean upload after. The Account screen's photo-backup section was also tidied: the "Back up photos on" chips now line up with the status text above them (they read as flush-left and jagged before), and "Back up now" stays full width like every other button on the screen.
- **Verified end to end on the real test phone:** after the server fix deployed, the same stuck test photo backed up automatically with no further tap — Account read "1 photo backed up · Every photo is safe on the server." Typecheck, lint and the full test suite (228 web + 418 domain) pass throughout. Committed and pushed to `main` in three more commits. No new APK was needed for the org-id fix (it's server-only); the tester APK already handed to the owner is still the current, fully verified build.

### S6: the guide teaches the route instead of driving it, and test data cleared (2026-09-23 evening to 2026-09-24)

- **A new hole's first sample now defaults to start at 0 m** (`42b0e5a`).
- **First-run guide: the geologist was stranded after saving an interval and after saving a sample**, with nothing saying where the next step was. A first fix made the guide navigate there automatically (`ab51012`); the owner rejected it because jumping for the geologist does not teach them how to use the app on their own. **Replaced by a breadcrumb trail** (`e7d463e`): when the next step's button is on the current screen it gets an accent border and every other control is greyed out and disabled; when it is on another screen, an info banner repeats the step and offers "Back", with the rest of the screen greyed out. Wired into the hole screen, the samples list (which had no guide wiring before) and the project home. `ActionTile`, `Card` and `Chip` gained `disabled` (and `ActionTile` a `highlighted`) prop for this. The export step's coachmark now closes with "Got it" so the geologist can look over the CSVs, and a card on the export screen holds the "Finish guide" button.
- **The interval screen's quick-length chips skipped 4 m** (`[1, 2, 3, 5]`); now `[1, 2, 3, 4]` (`73a40dd`).
- **Back on Home no longer exits the app at once** (`73a40dd`): the first press shows "Press back again to exit" and a second press within 2 seconds exits. Home only; other screens still go back normally.
- **Verified on the real test phone:** the full guide route with the new breadcrumb trail, the 4 m chip, and the two-press exit. A release APK built from `73a40dd` was handed to the owner.
- **Test data cleared, with the owner's confirmation:** the test phone's app data was wiped, and the two practice projects in `jjtgeo@corechain.test`, with all their child rows, were deleted from the live database in one transaction. Wiping the app data also signs the phone out, so the owner signed back in.
- **Demo data for screenshots:** the synthetic Cordillera porphyry sample (`npm run sample:cordillera`) was loaded into `jjtgeo@corechain.test`; it must be labelled synthetic wherever it is shown. That account also still holds a "Practice project" from the owner's walkthrough recording and an empty "Copper Ridge Project" created by mistake; deleting the empty one was blocked by the session's safety check and is left for the owner to decide.
- Items proposed during this work and during the first tester's feedback are listed, unscheduled, under "Proposed 2026-09-24, not scheduled" above.
- **Every loading state now uses the opening splash's filling "C"** (owner's request).
  - The drawing moved into `components/brand-fill.tsx`, and the splash itself uses it.
  - The 12 screens that went blank while their data opened, and "Opening your data…" after sign-in, now show `components/screen-loader.tsx`: the same 160 px symbol. It appears only if loading takes longer than 200 ms, so fast local loads don't flash it.
  - Buttons (32 px) and the camera shutter (76 px) show a small looping version in place of the spinner.
  - A screen whose record never loads (removed, for example by a teammate's change that synced in) used to stay blank for good. After 8 seconds it now says "This could not be opened" with a "Go back" button. "Opening your data…" is exempt, since it has its own failure message.
  - **Verified on the real test phone (dev build, 2026-09-24):**
    - The app still opens through the splash to a signed-in Home.
    - A missing dispatch opened by link (`adb shell am start -a android.intent.action.VIEW -d "corechain-field://projects/check/dispatches/missing"`) showed the filling C at 1.5 s, then "This could not be opened" with "Go back" by 9.5 s. "Go back" returned to the previous screen.
    - Export on the Cordillera sample opened, and Share brought up the share sheet with the right file name.
  - **Not seen on the phone:** the small looping C inside a button, because Share finished too quickly to catch it. Typecheck, lint and the Android bundle also pass.

### Change register, first batch: laboratory QA/QC and server checks (2026-09-25)

An engineering change register reviewed the code at `d25db2f`. This batch covers its items that need no database change. **Checked in code only (tests, typecheck, lint, build); nothing here runs on the phone.**

- **Units (item 1).** A standard, blank or duplicate is compared only when both sides are in the same unit (case and spacing ignored). Nothing is converted. A different or missing unit raises a new `unit_mismatch` exception ("Units don't match") showing both values and units, and the result is not scored until someone fixes it. A standards-and-blanks line now needs a unit.
- **Blank limits (item 3).** A blank that names its material uses only that material's limit. A blank that names none uses the team's limit for the element only when there is exactly one; if there are several, it is raised as `qc_reference_missing` ("Which blank limit applies?") instead of being checked against a guess.
- **Batch order (item 4).** "Two warnings in a row" now follows the dispatch sheet's order: sample numbers compared as numbers, so S-2 comes before S-10. The rule and the sheet share one `compareSampleNumbers`. It stays within one dispatch, and a corrected result keeps its sample's place. A stored sequence per batch is not needed while the sheet sets the laboratory's order.
- **Server checks (item 6).**
  - The upload now refuses any record that breaks a rule the phone also refuses (`apps/web/lib/sync/rules.ts`). For a change to part of a record, it checks the stored record with the change applied. The rules are:
    - depths of 0 m or more, with "to" past "from";
    - RQD pieces no longer than the core recovered;
    - box number 1 or higher;
    - angles, latitude/longitude and mineral % in range;
    - a primary sample has both depths.
  - References must stay in the record's own project (for a photo, its own hole): a duplicate's original, a dispatch's samples, and custody events' samples, dispatch and corrected step.
  - New refusal codes `invalid-record` and `reference-not-found` have plain descriptions on the phone's Account screen. Older builds show the generic text, with the code and the rule as detail.
- **Overlaps are not refused, on purpose.** Two offline phones can each bag the same core, and both bags are real. A refused change is not sent again by itself, so refusing one would lose a real record. Overlapping primary samples are a new `sample_overlap` exception in the sampling-and-custody queue. Run gaps, overlaps and runs past the final depth were already exceptions.
- **Tests for who may edit standards and blanks (item 5):**
  - the project manager and the laboratory QA/QC reviewer can edit, and only their own team's lines;
  - other QA/QC stages, geologists and laboratory accounts cannot;
  - a signed-out person or one with no team is refused;
  - values that aren't numbers or are infinite, and a line with no unit, are refused;
  - a second line with the same name and element gets a clear message.
- **CI and deploy (items 9, 10).**
  - The workflow's token is read-only (`permissions: contents: read`).
  - The actions are pinned to their v4 commits.
  - The build gets placeholder sign-in settings, so auth errors fail CI instead of being logged and ignored.
  - Expo Doctor runs the version pinned in `apps/mobile` (1.20.4), with no download.
  - `apps/web/scripts/check-env.mjs` stops a Vercel production build when `DATABASE_URL` or `BETTER_AUTH_SECRET` is missing, so the previous deployment stays live. Elsewhere it only warns.
- **Not in this batch:**
  - Versioned standards and blanks (item 2) need a migration, on their own branch.
  - Licence, security policy and code owners (item 11), and the GitHub settings (item 12), are the owner's to decide or click.
  - The two-phone test (item 7) needs two devices.
  - The dependency advisories (item 8) are a separate, reviewed upgrade.
- Automated tests went from 698 to 719.

### Change register item 2: standards and blanks keep their history (2026-09-25)

**Needs the migration `20260925120000_qc_reference_history` applied before it is merged. Checked in code only; not yet opened in a browser.**

- **Standards and blanks.** A line is never edited in place or deleted.
  - "Change line" asks why, retires the current revision and adds the next one, recording who, when and why, and which revision it replaces.
  - "Stop using" asks why and retires the line. It moves to a "No longer used" list and is no longer used to check results.
  - Each line has a history showing every revision and its values, including for read-only reviewers. Revised lines show "rev N".
  - Only current lines are used to check results. A partial unique index keeps one current line per team, kind, name and element.
- **Resolved exceptions** keep the hole, summary and evidence they were resolved on, including the certified value and ± used. If the data or a certified value changes later, the resolution still shows what it was.
- **Accept, hold and reject decisions** keep the reviewer's stage and the exceptions open for the hole at that moment. They show in the decision history as "Open at the time". Decisions made before this change show "Not recorded".
- The QA/QC exception calculation moved to `apps/web/lib/qaqc/stage-exceptions.ts`, so the QA/QC screen and its actions use the same code.

### Change register items 8 and 11: dependency advisories and repository policy (2026-09-25)

- **Added `SECURITY.md`** (report privately through the Security tab's "Report a vulnerability") **and `.github/CODEOWNERS`** (`* @jjtzoo`).
  - The reporting button only appears once the owner turns on private vulnerability reporting (Settings, Security, "Private vulnerability reporting").
  - Don't turn on "Require review from Code Owners" in branch protection: with one maintainer it would block every merge, since nobody can approve their own pull request.
- **Licence: not added. The owner decides** between an open licence, source-available for evaluation, or all rights reserved. Until then no licence means all rights reserved by default, but a written notice is clearer.
- **Production dependency audit, 22 advisories (4 high, 18 moderate). None is exploitable in how CoreChain uses the package today:**
  - **PostCSS, high, via Next.js.** The flaws need attacker-written CSS or source maps. PostCSS here only processes CoreChain's own stylesheets at build time.
  - **deepmerge-ts, high, via Prisma's command-line tool.** The flaw needs a recursive object graph. The tool only reads CoreChain's own schema and config, on the developer's machine and in CI; it doesn't run in the live site.
  - **decode-uri-component, via Expo Router's query-string.** It can slow down on a malformed link. Only links into the app itself reach it.
  - **uuid.** Only affected when a buffer is passed in, which CoreChain never does.
  - The other moderate advisories come from Expo SDK packages (expo, expo-router, expo-sharing, expo-splash-screen, datetimepicker, Sentry) and are inherited from the items above.
  - `npm audit fix --force` would force major version changes, some of them downgrades to years-old versions (for example expo@46, and Next.js 16 without the migration work), so it must not be run.
  - **Tried and undone:** a version override for deepmerge-ts broke Prisma's install step (`prisma generate` could no longer load its config). Overrides for these are not safe.
  - **Plan:** take the fixes with the next planned framework upgrades: Next.js 15 to 16 (it ships a fixed PostCSS), Prisma 6 to 7, and Expo SDK patch releases through `npx expo install --check`. Each is its own branch, with the full checks and a phone build for Expo.

### Collar map, step 1 (E15-1, 2026-09-25)

**Checked in code only** (typecheck, lint, domain tests, Android bundle). **Not yet run on the test phone, and not published as an over-the-air patch.** Mockup: `docs/product/mockups/collar-map.html`.

- **Owner's decision (2026-09-25):** the map is how a geologist selects drillholes, after first choosing the project. The project screen's drillholes now switch between **List** (the default, still best in the core shed and with gloves) and **Map**. The choice is remembered per project while the app is open. The switch is hidden while the first-run guide is running, because the guide walks through the list.
- **The map** (`apps/mobile/src/components/collar-map.tsx`, geometry in `packages/domain/src/collarMap.ts`):
  - Collars sit on a plain grid in metres, coloured by status; an urgent hole is ringed in red.
  - Holes within 10 m of each other are one pad marker with a count.
  - It has a north arrow and a scale bar.
  - Drag, pinch, and 52 px buttons for Fit all, Show where I am, and zoom in and out.
  - Tapping a collar opens a card: depth, progress, status, urgent note, how far away and which way ("260 m E of you"), the collar's source and accuracy, and "Open". A pad lists its holes in 52 px rows.
  - Holes with no collar are listed under "No location yet", never dropped.
- **You are here** comes from the phone's GPS, with no signal needed, and a halo shows its accuracy. It is shown straight away only if the app already has location permission; otherwise "Show where I am" asks for it. More than 5 km from the collars, the map says how far away they are instead of zooming out.
- **No background map** (roads, terrain). That is E15-2.
- **Verify on the phone:**
  - drag and pinch inside the scrolling screen;
  - tapping small collars with gloves;
  - the GPS prompt;
  - light and dark themes.

### Collar map: hole traces, and first run on the phone (E15-1, 2026-09-25)

- **Run on the test phone** (Infinix, development build 0.1.1, on the synthetic Cordillera project), in dark theme:
  - the List / Map switch;
  - collars and labels, the north arrow, the scale bar and the legend;
  - dragging the map without scrolling the page;
  - zoom in;
  - tapping a collar opens its card, and "Open" goes to the hole;
  - "Fit all";
  - "you are here" more than 5 km away shows the distance instead.
- **A bug found on the phone and fixed:** "Fit all" used the map's full width, so the easternmost collar (CDL-006) sat behind the buttons. Fitting now leaves the button column clear.
- **Owner's decision:** the plain grid looked too empty. Rather than a background map now (E15-2: a new APK, map files to host, 3 to 5 sessions), each angled hole gets its **trace**:
  - a line from the collar in the planned azimuth, as long as the depth (final, else planned) times the cosine of the dip, with a short bar at the end of the hole, as on a drill plan;
  - a vertical hole, or one with no azimuth, dip or depth, stays a dot;
  - it shows the planned direction only; there is no downhole survey;
  - the map fits around where the holes end, not just the collars;
  - the tapped hole's trace is drawn bolder and the others fade;
  - the card shows "Azimuth 90° · dip -55°".
  - The geometry is `traceOffset` and `collarMapLayout(...).traces` in `packages/domain/src/collarMap.ts`, with 3 new tests. Also run on the test phone.
- **Not yet checked on the phone:**
  - pinch to zoom (it needs two fingers; the phone was driven over USB);
  - tapping with gloves;
  - the first-time GPS prompt (location was already allowed);
  - light theme.
- Still JavaScript only, but main is app version 0.1.1 while testers have 0.1.0, so the map reaches testers in the next APK, not as an over-the-air patch.

### An email for every feedback message (E10-6, 2026-09-25)

- **Owner's request:** an email for each piece of feedback a tester sends.
- **How:** when feedback is saved (phone or website, `app/api/feedback/route.ts`), the server emails the owner through Resend's free tier, after answering the phone, so the tester never waits for it.
  - The email carries the message, who sent it and their role, phone or website, app version, phone model, screen, and a link to the feedback inbox.
  - Screenshots stay in the inbox; the email doesn't carry them.
  - A retry never sends a second email (Resend idempotency key), and a failed email never stops the feedback being saved.
  - Code: `apps/web/lib/feedback/email.ts`, with 6 tests.
- **Off until the owner switches it on:** create a Resend account with the address that should receive the emails, then set `RESEND_API_KEY` and `FEEDBACK_NOTIFY_EMAIL` in Vercel.
- **Note:** the feedback text passes through Resend on its way to the owner.

### Lithology dictionary and rock units (phone, 2026-09-25)

**Owner's request, for the showcase:** a lithology dictionary, and aggregating depths of the same rock and properties. Mockup: `docs/product/mockups/lithology-dictionary.html`, with every number calculated from the synthetic Cordillera logs.

- **Lithology, from the project screen.** A card shows the core's make-up as one bar ("AND 45% · PORP 34% · DIO 15%").
  - It opens the project's dictionary: every rock type logged, most first, with metres, share of core, holes, units, depth range, and a rock group (volcanic, intrusive, cover...).
  - A link at the bottom opens the code library, where the team adds or renames its own codes.
- **One rock type:**
  - a short starter description;
  - metres, holes, units, and the thickest unit;
  - typical alteration by length, with the usual intensity;
  - mineralisation where logged, as length-weighted percentages;
  - "where it occurs": each hole to scale, with this rock's units marked. Tapping a hole opens its rock units.
- **Rock units, a new tile on each hole.** Touching intervals of the same lithology merge into units. For example, CDL-001's 13 intervals read as 7 units.
  - "Lithology + alteration" splits them again wherever the alteration type changes (12 domains).
  - A gap in the log, or an interval with no lithology, ends a unit. The log itself is never changed.
- **Rules and code:**
  - Everything is calculated on the phone from its own data, so it works offline. There's no database change.
  - The descriptions and rock groups exist only for the starter codes. A team's own codes show their code-library name and no group; editing groups would need a synced field (a migration).
  - Code: `packages/domain/src/lithology.ts` (`rockUnits`, `lithologyDictionary`), with 8 tests. Screens: `lithology/index.tsx`, `lithology/[code].tsx` and `drillholes/[drillholeId]/units.tsx`.
- **Run on the test phone** (development build, dark theme, synthetic Cordillera project):
  - the card;
  - the dictionary;
  - Porphyry;
  - "where it occurs" through to a hole's units;
  - both unit modes;
  - the hole tile;
  - the code-library link.
- **Not checked:** light theme, and a project with nothing logged (the empty state).

### Terrain on the collar map (E15-2, first step, 2026-09-25)

**Owner's decision:** build terrain now (the first part of E15-2), instead of a full background map with MapLibre.

- **Server:** `GET /api/projects/[projectId]/terrain` (`apps/web/lib/terrain/render.ts`) renders shaded relief and 20 m contours (heavier every 100 m) as a transparent north-up PNG.
  - The area is the collars and planned hole ends plus 1.5 km.
  - The data is the free Copernicus DEM GLO-30 (30 m), read in place from its public AWS copy by range requests. There's no key, no storage and no ongoing cost.
  - Only the project's own workspace can fetch it.
- **Phone** (`apps/mobile/src/data/terrainFiles.ts`):
  - It downloads the image once and keeps it in the app's documents folder, so the map has terrain with no signal.
  - It fetches a new copy only when there is none, or a collar has moved outside the kept area.
  - The image is drawn under the grid and collars and moves and zooms with them. The legend adds "Contours every 20 m" and the required Copernicus credit.
  - "Sign out and remove my data" deletes the kept images.
- **Run on the test phone** (development build, dark theme, synthetic Cordillera project, against the live server):
  - the terrain downloaded and lines up under the collars;
  - fit, zoom out and selecting a hole all work with it.
- **Not checked:**
  - light theme;
  - offline after download (the map with airplane mode on);
  - a project spanning two elevation tiles, or at sea;
  - contour lines look stepped when zoomed well in (the image is about 3 m per pixel); sharper contours when zoomed in are a later step.
- Roads, rivers and imagery would still need the full background map (the rest of E15-2).

---

## 8. Field-test plan

Adapted from `docs/discovery/day-1-to-day-30-pilot.md`.

### The official test script: "A day in the field"

Before any tester uses their own data, everyone runs the same scripted day so results are comparable: `docs/product/field-day-mockup/CoreChain-Field-Day-Guide.pdf` (regenerate with `node docs/product/field-day-mockup/build-guide.mjs`).

- **The scenario:** one fictional hole, `MB-DDH-001` (45.3 m, Masbate Gold Pilot): 15 core runs, 9 core boxes, 11 photos, 12 logged intervals and 25 samples (22 primary, plus a standard, a blank and a field duplicate), then a CSV export. About 4 h 25 min of entry, with target times per part and a sign-off sheet for the tester's own times and ratings.
- **Built to be trusted:** the data lives in `packages/domain/src/fixtures/mb-ddh-001.json` and `field-day.test.ts` runs every record through the app's own validation, QC-reminder, trace and export rules, so the guide cannot tell a tester to type something the app would refuse, and the figures it quotes (94.5% recovery, the QC reminders appearing after the 20th primary, five export files with 1, 1, 12, 15 and 25 rows) are checked by tests.
- **Also covers:** 16 deliberate mistakes on a scratch hole with the exact message the app should give, and field-conditions checks (airplane mode all day, sunlight, gloves, interruption, battery, dark and light mode).
- **Known gaps the script works around:** editing an existing entry (delete and re-add), core boxes and photos not in the export yet, and "Bagged" / "Dispatched" not yet tappable (custody and dispatch, E7).

### Testers

- 2–5 field geologists, each working alone (no admin, no manager).
- Android devices they already carry.
- At least one of them works in a site with no signal for multiple days.

### What testers do

1. Install from Play internal testing, sign up and create their project.
2. Run the app alongside their usual paper/Excel method for **at least one full hole**.
3. Log boxes, runs, intervals and photos, create samples with QC inserts, record custody and a dispatch.
4. Sync whenever they reach signal, and export CSV at the end.
5. Send feedback in the app whenever something is confusing or wrong.

### Measures

| Measure                      | How it's measured                                                       | Target                                    |
| ---------------------------- | ----------------------------------------------------------------------- | ----------------------------------------- |
| Time to log one hole         | Tester's own estimate vs paper + Excel transcription                    | Faster than paper + evening transcription |
| Missing or incorrect records | Compare the app export with the tester's paper log                      | Zero sample-to-depth mismatches           |
| Sync reliability             | Records pending more than 24 h after reconnect; conflicts; lost records | **Zero lost records**                     |
| Offline survival             | Days worked without signal with no blocking error                       | Full field rotation                       |
| Adoption                     | Would they keep using it without the paper log?                         | ≥ 3 of 5 testers say yes                  |
| Must-fix issues              | Feedback items that are blocking or cause data loss                     | Resolved before the next build            |

### Feedback loop

- A weekly build during the test, with release notes.
- A short weekly call or message check-in with each tester.
- Findings go into the backlog and are ordered by the Product Owner at the next sprint planning.

### Test-end decision

Stop, revise, or proceed to the team features (roles, invites, assay import, QA/QC), based on the measures above.

---

## 9. Risks and open decisions

| Item                                       | Type                    | Due                   | Recommendation / mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------ | ----------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No Android SDK/emulator/JDK on dev machine | Risk (new, found in S0) | Before S1 is verified | Install Android Studio + an emulator, or use a real device with USB debugging. `expo prebuild` and `expo export` both succeeded without it, but nothing has run on an actual device or emulator yet.                                                                                                                                                                                                                                                                    |
| Hosting and Postgres provider              | Decision                | Before S4             | Managed Postgres + PowerSync Cloud for the pilot; revisit self-hosting before paying clients                                                                                                                                                                                                                                                                                                                                                                            |
| SQLCipher working with PowerSync           | Resolved in S0          | —                     | Confirmed on a real phone in Sprint 1: `@op-engineering/op-sqlite` (PowerSync's built-in storage adapter) bundles SQLCipher; the flag `"op-sqlite": {"sqlcipher": true}` must be in **`apps/mobile/package.json`** (not the root — the root placement silently produced a plaintext DB). Requires `expo prebuild` — **op-sqlite cannot run in Expo Go.** Still to verify when PowerSync is wired (S4/S5): that PowerSync's own connection uses the same encrypted file. |
| Standard code lists for the Philippines    | Data gap                | Before S2             | Start from common lithology and alteration codes; ask the first tester for their project's code sheet                                                                                                                                                                                                                                                                                                                                                                   |
| Coordinate systems (PRS92 / UTM zones)     | Data gap                | Before S1             | Confirm which systems testers use; store the raw input plus the system it was entered in                                                                                                                                                                                                                                                                                                                                                                                |
| Tester recruitment                         | Risk                    | Before S3             | Line up one friendly geologist for the S3 alpha review and 2–5 for the S6 field test                                                                                                                                                                                                                                                                                                                                                                                    |
| Photo storage cost and size                | Risk                    | S5                    | Compress on the device; offer Wi-Fi-only sync; keep originals only if testers ask                                                                                                                                                                                                                                                                                                                                                                                       |
| Scope creep toward desk features           | Risk                    | Ongoing               | Anything outside the field chain goes to the later backlog, not the current sprint                                                                                                                                                                                                                                                                                                                                                                                      |
| Solo-team velocity                         | Risk                    | After S2              | Re-plan S3–S6 on measured velocity; the internal alpha date matters more than the full scope                                                                                                                                                                                                                                                                                                                                                                            |

---

## References

- `docs/product/corechain-website-overview.md` — product overview
- `docs/product/corechain-phase-1-masterplan-prompt.md` — Phase 1 plan and data model
- `docs/product/mining-operations-context-and-roles.md` — who does what
- `research/core-workflow-primer.md` — drill core to trusted assay workflow
- `docs/discovery/mvp-validation-brief.md` — what to build first, validate, or defer
- `docs/discovery/day-1-to-day-30-pilot.md` — pilot canvas
