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

| #   | Decision                                                                                                                                                         | Why                                                                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | The field product is a **native mobile app** (Expo / React Native), not a web app or PWA                                                                         | Offline reliability in core yards with no signal is the core promise. A native app gets a real local database, encryption at rest, background sync and the camera.                 |
| D2  | **Android first**; iOS later                                                                                                                                     | Matches the devices of the target users and removes App Store friction from the pilot.                                                                                             |
| D3  | **Two apps, one backend.** Mobile for field roles; the existing Next.js web app for desk roles (admin, assay import, QA/QC review)                               | Field roles work offline on phones; desk roles work online on laptops. There's no point rebuilding desk screens on mobile.                                                         |
| D4  | **PowerSync** for sync: Postgres to on-device SQLite; uploads go through our own API                                                                             | The server validates every write and re-checks permissions, and we don't build sync plumbing ourselves. The fallback if it's rejected is `expo-sqlite` + Drizzle + our own outbox. |
| D5  | **Better Auth**, with its Expo integration; tokens in Android Keystore via secure storage                                                                        | Organisations and roles are available when needed later. Sign in once online, then an offline session with an expiry applies.                                                      |
| D6  | **IDs are generated on the device** (UUIDs). Human-readable sample numbers come from **pre-issued blocks per device**                                            | A phone with no signal can't ask a server for the next number. The blocks work like the paper sample-ticket books core yards already use.                                          |
| D7  | **Custody events are append-only.** Edited records carry a `version`; a stale edit becomes **"needs attention"** instead of overwriting                          | Traceability can't tolerate last-write-wins data loss.                                                                                                                             |
| D8  | **Offline-first with cloud backup, in two stages.** Sprints 1–3 are offline-only on a schema ready for sync; Sprints 4–5 add sync before any tester relies on it | Losing a phone must not mean losing a hole's log. Staging still gets an installable build onto a device early.                                                                     |
| D9  | **Self-serve MVP**: personal workspace, bundled editable code library, per-project settings                                                                      | The testers are field geologists working alone, with no admin.                                                                                                                     |
| D10 | **The whole field chain is in the MVP**; assay and QA/QC stay on the web                                                                                         | The geologist does all the field steps personally, so a partial chain wouldn't test the real day.                                                                                  |
| D11 | **Encrypted local database** (SQLCipher)                                                                                                                         | Exploration data is commercially sensitive, and phones get lost in the field. Whether it works with PowerSync is confirmed by the Sprint 0 spike.                                  |
| D12 | **2-week sprints**, each ending in a demo build on a real Android device                                                                                         | Standard cadence, and it proves every increment on real hardware.                                                                                                                  |

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

| Item                                    | Type     | Due       | Recommendation / mitigation                                                                           |
| --------------------------------------- | -------- | --------- | ----------------------------------------------------------------------------------------------------- |
| Hosting and Postgres provider           | Decision | Before S4 | Managed Postgres + PowerSync Cloud for the pilot; revisit self-hosting before paying clients          |
| SQLCipher working with PowerSync        | Risk     | S0 spike  | If unsupported, use `expo-sqlite` (SQLCipher) + our own outbox (D4 fallback), decided in S0           |
| Standard code lists for the Philippines | Data gap | Before S2 | Start from common lithology and alteration codes; ask the first tester for their project's code sheet |
| Coordinate systems (PRS92 / UTM zones)  | Data gap | Before S1 | Confirm which systems testers use; store the raw input plus the system it was entered in              |
| Tester recruitment                      | Risk     | Before S3 | Line up one friendly geologist for the S3 alpha review and 2–5 for the S6 field test                  |
| Photo storage cost and size             | Risk     | S5        | Compress on the device; offer Wi-Fi-only sync; keep originals only if testers ask                     |
| Scope creep toward desk features        | Risk     | Ongoing   | Anything outside the field chain goes to the later backlog, not the current sprint                    |
| Solo-team velocity                      | Risk     | After S2  | Re-plan S3–S6 on measured velocity; the internal alpha date matters more than the full scope          |

---

## References

- `docs/product/corechain-website-overview.md` — product overview
- `docs/product/corechain-phase-1-masterplan-prompt.md` — Phase 1 plan and data model
- `docs/product/mining-operations-context-and-roles.md` — who does what
- `research/core-workflow-primer.md` — drill core to trusted assay workflow
- `docs/discovery/mvp-validation-brief.md` — what to build first, validate, or defer
- `docs/discovery/day-1-to-day-30-pilot.md` — pilot canvas
