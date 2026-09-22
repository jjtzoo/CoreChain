# How the web app is built

A plain-language map of `apps/web`, written so it can be explained out loud —
to an interviewer, a collaborator, or anyone asking "so how does this
actually work?" It covers what each piece is, why it was chosen, and how a
request moves through the system. CoreChain Field (the phone app) is covered
separately in [mobile-app-architecture.md](mobile-app-architecture.md); this
file is the desk/web side: sign-in, the manager and QA/QC and laboratory
screens, and the API the phone talks to.

The web app is in development testing, not yet released.

## The one-line version

Next.js (App Router, TypeScript) renders the pages and also serves as the
API. It talks to a single Postgres database (hosted on Neon) through Prisma,
and to a hosted sync service (PowerSync) that mirrors a slice of that
database down to each phone's local, encrypted SQLite database. Sign-in is
handled by Better Auth. Photos are stored in Vercel Blob. Everyone shares
one deployment; a "team" (Postgres `organization`) is how one company's data
stays fenced off from another's.

## The stack, and why each piece is there

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router | One codebase for both the pages people see and the JSON API the phone calls. Server Components read straight from Prisma with no separate API layer for the desk screens. |
| Language | TypeScript everywhere | The same types (drillhole, sample, custody event, role) are shared with the phone app and the domain rules through `packages/domain`, so a change to a shape breaks the build instead of shipping a bug. |
| Database | PostgreSQL, hosted on Neon | One durable source of truth both the web app and PowerSync read from. |
| ORM | Prisma | Schema-first: `prisma/schema.prisma` is the one place a table's shape is defined, and it generates the TypeScript types Prisma queries return. |
| Auth | Better Auth (with the Prisma adapter) | Handles password hashing, sessions (cookies for the browser), admin-managed accounts (no public sign-up), and also issues the short-lived JWTs PowerSync uses to decide what a phone is allowed to download. |
| Phone sync | PowerSync (hosted) | Reads Postgres through a set of declared "sync streams" (`powersync/sync-streams.yaml`) and mirrors the matching rows to each phone's local database. The web app never talks to PowerSync directly for reads — it is a parallel pipe out of the same Postgres tables. |
| File storage | Vercel Blob | Private object storage for photo files. Photo *records* (who, when, which hole) live in Postgres and sync normally; the image bytes are uploaded separately over HTTP and referenced by a storage key. |
| Styling | Hand-written CSS with design tokens in `app/globals.css`, Tailwind v4 available | Design tokens (`--forest`, `--ink`, `--surface`, `--success`, `--danger`, …) keep the web app's palette consistent with the phone app's theme constants. |
| Tests | Vitest + Testing Library | Runs in CI on every push, alongside typecheck, lint and build. |

## Repository shape

```text
apps/web/
├─ app/                    Next.js App Router: one folder per route
│  ├─ admin/               admin-only: accounts, tiers, teams, feedback inbox
│  ├─ team/                the manager's team overview (project manager tier)
│  ├─ qaqc/                the QA/QC exceptions queue
│  ├─ laboratory/          the laboratory dispatch inbox
│  ├─ login/               sign-in (no public sign-up — an admin creates every account)
│  ├─ api/                 routes the phone calls: auth, sync upload, photo upload/download, devices
│  └─ actions/, */actions.ts   Server Actions: form submissions that run on the server, no hand-written API route needed
├─ lib/
│  ├─ auth.ts               Better Auth configuration
│  ├─ prisma.ts             the one shared Prisma client
│  ├─ session.ts            "is this person signed in, and what can their tier do" guards for every page
│  ├─ repositories/         server-side data access grouped by feature, used by the API routes
│  ├─ photos/               photo upload validation and the Vercel Blob storage key scheme
│  └─ sync/                 the write path the phone's changes come through: validation, idempotency, conflict handling
├─ powersync/
│  └─ sync-streams.yaml     which rows each phone is allowed to download, deployed by hand into the PowerSync dashboard
└─ prisma/
   ├─ schema.prisma          every table, in one file
   └─ migrations/            one dated folder per schema change, applied by hand against the live database
```

## How a request actually flows

**Someone opens `/team` in a browser (a desk screen, no phone involved):**

1. Next.js renders the page on the server. The page component calls
   `requireProjectManager()` from `lib/session.ts`, which reads the
   Better Auth session cookie and checks the account's tier — if it isn't a
   resident/project manager, they're bounced back to `/login` before any
   data loads.
2. The page queries Prisma directly (`prisma.user.findMany`,
   `prisma.drillhole.findMany`, …), scoped to that account's
   `organization_id` so one team never sees another team's holes.
3. The result is rendered to HTML on the server and sent down — no
   client-side fetch, no loading spinner for the first paint.
4. Anything the manager clicks that changes data (assign a hole, flag it
   urgent, create a team) runs through a **Server Action**: a plain
   `async function` in an `actions.ts` file, marked `"use server"`, that the
   browser calls like a normal function but Next.js actually executes on the
   server, re-checks the session, writes through Prisma, and tells the page
   which parts to re-render.

**A geologist's phone syncs (the offline-first path):**

1. The phone already holds a short-lived JWT (see
   [mobile-app-architecture.md](mobile-app-architecture.md)), fetched from
   `/api/auth/token`, which is verified against Better Auth's public keys
   (`/api/auth/jwks`) — the web app never has to be reachable for PowerSync
   to check a token.
2. **Downloads** happen entirely between the phone and the hosted PowerSync
   service, following the rules in `powersync/sync-streams.yaml`: a person
   only ever receives rows whose `organization_id` matches their own team
   (or, if they're not on a team, their personal workspace). The Next.js
   app is not in this path at all — PowerSync reads Postgres on its own.
3. **Uploads** go the other way, straight to the Next.js app:
   `POST /api/sync/upload`. That route runs each change through
   `lib/sync/`, which re-validates it (the phone is never trusted blindly),
   checks it isn't a stale edit of something already changed elsewhere
   (optimistic-concurrency versioning), and writes it through Prisma. Every
   write also creates an audit event: who, what, when, which device.
4. Photo files upload separately, after their record has synced, straight
   to a Vercel Blob-backed route — image bytes never go through Postgres or
   PowerSync.

## Multi-tenancy: how one team's data stays separate

Every syncable table carries an `organization_id`. An "organization" here
just means a team the admin created and put people on — the schema comment
in `prisma/schema.prisma` explains that changing a person's team does not
move their existing records with them, on purpose. Every Prisma query on a
desk screen, every PowerSync sync-stream query, and every write through
`/api/sync/upload` filters or checks against that column. There's one
database and one deployment; the isolation is enforced in the query layer
and the sync rules, not by separate infrastructure per customer.

## Why this shape, if someone asks "why not X"

- **Why Server Components/Actions instead of a separate REST or GraphQL API
  for the desk screens?** Only the phone app needs a real network API
  (`/api/*`); the desk screens are read by the same process that renders
  them, so there's no serialization boundary, no separate client-side data
  library, and no risk of the UI and the API type drifting apart.
- **Why PowerSync instead of hand-rolled sync?** Conflict handling, delta
  sync, and a local SQLite mirror on the phone are the hard, easy-to-get-
  subtly-wrong part of an offline-first app. PowerSync owns the download
  side; this codebase only had to write the upload validation and the rules
  for which rows go to which phone.
- **Why one shared `packages/domain` instead of duplicating logic?** Recovery
  percent, interval continuity, sample-overlap rules and the role/permission
  matrix have to agree between the phone and the web app, or a QA/QC review
  on the web could disagree with what the phone showed the geologist in the
  field. Pure TypeScript with no framework dependency means both apps import
  the same functions and the same test suite covers both.
