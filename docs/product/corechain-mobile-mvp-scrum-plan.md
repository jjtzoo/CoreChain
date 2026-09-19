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
| D2  | **Android first**; iOS later                                                                                                                                     | Matches the devices of the target users and removes App Store friction from the pilot.                                                                                                                                                                                                |
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

**E2-3 — Drillhole status (2)**
As a field geologist, I want to set a hole's status (planned → drilling → complete → logged), so that I can see where each hole stands.

- Every status change is recorded in the history, with the time.

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

**E8-5 — Resolve conflicts (5)** _(Sprint 5)_
As a field geologist, I want to see and resolve records the server rejected, so that nothing is silently lost.

- Shows my version and the server version side by side; I pick one or merge the fields.

### E9 — Export

**E9-1 — CSV export (5)**
As a field geologist, I want to export collars, surveys (planned azimuth/dip), lithology log, runs (recovery/RQD), samples and dispatches as CSV, so that I can load them into Excel, Leapfrog or GEOVIA.

- One file per table with stable column names. Hole ID and from/to columns follow the conventions those tools import.
- It's shared through the Android share sheet and works offline.

### E10 — Test support

**E10-1 — First-run onboarding (3)**
As a new tester, I want a short walkthrough to my first project and hole, so that I can start without training.

**E10-2 — In-app feedback (2)**
As a tester, I want to send feedback with a screenshot from any screen, so that problems are reported in context.

- Feedback is queued offline and sent when connected.

**E10-3 — Crash reporting and version (2)**
As the Product Owner, I want crash reports with the app version and device, so that field failures can be fixed.

**E10-4 — Field-test release (3)**
As the Product Owner, I want signed builds on Google Play internal testing, so that testers install and update easily.

### Later backlog (not in the MVP)

| Epic                                   | Notes                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| Assay import and matching (web)        | CSV/Excel import; match by sample ID; the Phase 1 views become real                           |
| QA/QC review (web)                     | Standard, blank and duplicate charts and alerts; decisions recorded                           |
| Teams, invites and roles               | Client admin, project geologist, core-yard technician, QA/QC reviewer, viewer, platform admin |
| Approvals and sign-off                 | Once real approval workflows are validated                                                    |
| QR/barcode scanning and label printing | After validating what hardware the testers use                                                |
| iOS build                              | Once Android is proven                                                                        |
| Web trace view of synced data          | A read-only "trace this sample" view for office staff                                         |
| Maps and planned-vs-actual traces      | Drillhole plan map, collar-to-target view                                                     |
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
| **S6** Field-test release             | Testers can install, learn and report                           | E10-1, E10-2, E10-3, E10-4 + fixes from alpha feedback                                                                                                                              | 10 + fixes   | A Play internal-testing build installed by testers. **The field test starts.**                                     |

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
- **Dev-workflow lesson:** after the phone has been in airplane mode, the app's live-reload connection to Metro is dead; edits do not appear until the app is force-stopped and reopened.

---

## 8. Field-test plan

Adapted from `docs/discovery/day-1-to-day-30-pilot.md`.

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
