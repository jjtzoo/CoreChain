# CoreChain: guidance for Claude

CoreChain is an offline-first workflow platform for exploration and mining teams: a native Android field app (Expo / React Native) plus a Next.js web app, sharing pure TypeScript rules in `packages/domain`. The product owner is a non-technical mining engineer. Read `docs/product/corechain-mobile-mvp-scrum-plan.md` first: it is the source of truth for scope, decisions (D1 to D15), architecture and a dated outcome log per sprint.

## How to work with the owner

- Give specific, plain, step-by-step instructions for anything the owner must do (accounts, dashboards, phone settings). Say exactly where to click.
- Never ask the owner to paste secrets into chat, and never print, log or commit them. Secrets live in git-ignored files under `apps/web`.
- Follow the sprint plan. Ask before changing scope or order.
- Show a mockup before redesigning several screens; do not ask open design questions.
- Commit or push only when asked. Ask before anything hard to reverse or outward-facing (push, publish, delete, post).
- Report verification honestly: say what was checked on a real phone, what was only tested in code, and what was not checked. Record device results in the sprint plan.

## Wording rules for anything an outsider reads

- Describe CoreChain Field as "in development testing, not yet released". Never claim it is released, proven or "being tested now" unless it has been run on a phone.
- Do not write that geologists volunteered or are testers unless that is true. Ask before stating any number or relationship.
- List unfinished features as unfinished. A feature is "what the app does today" only after it has run on the test phone.
- Do not claim the CSV export imports into Leapfrog or GEOVIA; it has not been tried there.

## Product and design rules

- Users are geologists, QA/QC, laboratory staff and project managers. The app must look and read as a serious professional tool: restrained, precise, metres and industry terms, no playful copy or emoji. Design quality is a requirement from the first screen of a feature.
- Design for a geologist in bright sun, wearing gloves, working alone and offline: tap targets of 52 px or more, plain words, visible progress, and traceability (hole, box, depth, sample, photo) visible at a glance. Prefer native pickers and bottom sheets over free text where a mistake is possible.
- Every entry screen should give something back: a graphic log, progress, "My work". An app that only collects data reads as a chore.
- No developer-only screens, placeholder names such as "Spike project", or `.test` email addresses anywhere a professional will look.
- Principles for the phone app: `docs/product/field-app-design-principles.md`. Field workflow context: `docs/product/field-workflow-friction-and-design-principles.md`.

## Repository rules

- The repository is the product: code, the sprint plan, product design documents and mockups. Marketing posts, promotional screenshots, outreach and recruiting drafts, and personal checklists do not belong here. Never stage them or mention them from committed docs. Ask the owner where such material should be saved.
- Developer tools that create demo data (the seed scripts) are code and may stay.
- Check `git status` before every commit. Some `.md` files under `docs/` and `research/` can show line-ending-only changes; leave those unstaged.
- Commit messages are plain and factual, in the style of `git log`. Follow the attribution line the environment gives you.

## Commands

```bash
npm install
npm run dev            # web, http://localhost:3000
npm run dev:mobile     # Expo dev server (Expo Go does NOT work for this app)
npm test               # web and domain tests
npm run typecheck
npm run lint
npm run build          # web
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests, build and `expo-doctor` on every push. All of it must pass.

- **Phone builds** need a real native build because op-sqlite cannot run in Expo Go: `npx expo run:android` for a development build. For the release APK, run `npx expo prebuild --platform android` first (`apps/mobile/android/` is git-ignored), then `cd apps/mobile/android && ./gradlew.bat app:assembleRelease -PreactNativeArchitectures=arm64-v8a`.
- **Database changes:** the owner runs `npx prisma migrate deploy` against the live database. Order: apply the migration, let PowerSync read new tables, deploy the sync streams, then install the app.
- **Every new synced table** needs a PowerSync read grant and `ALTER PUBLICATION powersync ADD TABLE ...`, run by the owner in the Neon SQL editor (see the plan, section 7, "Every new table needs a PowerSync grant"). A schema-guard test compares the upload rules with the database schema; keep it passing.

## Gotchas that have already cost time

- The op-sqlite `sqlcipher` flag must live in `apps/mobile/package.json`, not the root, or the database is silently unencrypted. "Encrypted" needs a test that reads the file bytes.
- The app opens its database through PowerSync, and every repository goes through one adapter. Keep one connection.
- op-sqlite cannot bundle for web. Verify mobile work with `npx expo export --platform android`, `tsc`, `eslint`, vitest and the real phone.
- After airplane-mode testing, the live-reload connection is dead: force-stop and reopen the app. Fast Refresh can leave forms stale; re-test form fixes after a full restart.
- The root `overrides` block pinning `react` and `react-dom` prevents two copies of React in the mobile app. Do not remove it.
- Expo Router typed routes are regenerated by the `pretypecheck` script. Do not disable it.
- A refused sync change is not retried by itself; the Account screen shows the reason and a "Send again" button.
- Sample numbers are physical tags: never reuse one, even after a delete.
- Custody events are append-only. A mistake is a correction step, never an edit or delete.

## Current status

The status snapshot is kept in the sprint plan (section 7) and updated as each story is verified. As of 2026-09-21: Sprints 0 to 5 are built (offline logging, samples, photos, custody, dispatch, sync, conflicts, "My work"); Sprint 6 (first-run guide, version and crash reporting, signed build, Play internal testing, over-the-air patches) is next.
