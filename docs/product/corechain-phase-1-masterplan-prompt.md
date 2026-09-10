# CoreChain Phase 1 masterplan prompt

## How to use this document

This is the governing build prompt for the first phase of CoreChain. Give it to the coding agent at the beginning of a build task. Execute one milestone at a time, verify the result, and review meaningful screen changes with the project owner before moving forward.

---

## Master prompt

You are building **CoreChain**, an early workflow application for exploration and mining teams. Work inside the existing CoreChain project and preserve all research, outreach, and source-data files.

### Product mission

Build a trustworthy field-to-decision evidence layer for the workflow:

`Project -> drill programme -> drillhole -> core interval -> core box -> geological log -> sample -> custody -> dispatch -> assay batch -> QA/QC decision`

CoreChain should make it easy for a geological team to answer:

> Can we find, trace, and explain the evidence behind this drill interval and assay result?

The application supports geological work. It does not replace professional judgment, geological modelling, mine planning, resource estimation, or a Competent Person.

### Phase 1 outcome

Produce a polished, functional local web application that demonstrates one thin, connected workflow using the licensed Alberta public dataset while Philippine pilot data is unavailable.

At the end of Phase 1, a user must be able to:

1. Open one demo exploration project.
2. See its drillholes and their current data completeness.
3. Open a drillhole and inspect collar details, planned versus actual information, geological intervals, and available assay results.
4. Follow at least one clearly labelled synthetic sample through custody and dispatch.
5. See how an assay is matched to a sample and whether it needs QA/QC review.
6. See the source and audit history behind important records.

This is a pilot-quality product demonstration, not a production deployment.

### Design read

Read this as a **trust-first B2B field-operations application for exploration geologists, core-yard personnel, chief geologists, and operations leadership**, using an industrial, evidence-led visual language.

Use these interface dials:

- `DESIGN_VARIANCE: 4` - calm hierarchy, slight asymmetry, no experimental layout.
- `MOTION_INTENSITY: 2` - motion only for state transitions and feedback.
- `VISUAL_DENSITY: 6` - efficient technical information without becoming a cockpit.

The interface should feel credible beside serious geological and engineering software, while remaining easier to understand than a spreadsheet.

### Visual system

- Keep one light theme for Phase 1.
- Use Geist and Geist Mono through `next/font`.
- Use a cool stone canvas, white working surfaces, dark mineral green text/accent, and restrained semantic colours for warning, error, and success.
- Use dark mineral green as the single brand accent. Semantic status colours are allowed only when they communicate a real status.
- Avoid purple gradients, glassmorphism, sci-fi styling, gaming motifs, fake maps, decorative charts, and generic startup-dashboard cards.
- Use cards only when they express containment or hierarchy. Prefer spacing, alignment, section dividers, and table structure for dense information.
- Shape rule: 12px radius for panels, 8px for controls, and full pills only for real statuses or compact filters.
- Use the existing `lucide-react` dependency for icons. Keep one icon family and a consistent stroke width.
- Every displayed number must come from source or explicitly labelled synthetic data. Do not create fake performance metrics.
- Use the words `Not recorded` for missing values. Never present source markers such as `-9999` as real measurements.
- Build full loading, empty, error, and successful states for data-driven screens.
- Meet WCAG AA contrast, keyboard access, visible focus, and touch-target requirements.
- Optimise first for laptop and tablet use. Phone layouts must remain readable, but offline entry is not part of Phase 1.

The design-taste skill may guide the public-facing introduction and visual discipline. Do not use marketing-page patterns as substitutes for product navigation, technical tables, forms, or QA/QC workflows.

### Users and responsibilities

Design around responsibilities rather than assuming every company uses the same titles.

| User | What they need from CoreChain |
| --- | --- |
| Project or exploration geologist | Coordinate drilling records, logging, samples, issues, and technical review. |
| Logging geologist or core-yard technician | Record intervals, core boxes, recovery/RQD, geology, photos, and samples quickly. |
| Laboratory coordinator or data manager | Track dispatches, import results, reconcile missing records, and prepare QA/QC review. |
| Chief geologist or exploration manager | See programme status, exceptions, technical evidence, and approvals. |
| Operations or mine leader | See a concise progress and risk picture without editing technical records. |

The drill contractor executes drilling and supplies operational information. CoreChain must keep the geological team accountable for validation without implying that every drill-crew task occurs inside the app.

### Phase 1 information architecture

Use a persistent product shell with these primary areas:

1. **Overview** - project status, incomplete work, recent activity, and genuine exceptions.
2. **Drillholes** - searchable drillhole register and completeness status.
3. **Samples** - sample identity, source interval, current status, and traceability.
4. **Dispatches** - custody hand-offs and laboratory dispatch records.
5. **Assays & QA/QC** - result imports, matching status, controls, alerts, and review decisions.

Keep project configuration and permissions available as secondary settings, not primary navigation.

Suggested routes:

```text
/
/projects
/projects/[projectId]
/projects/[projectId]/drillholes
/projects/[projectId]/drillholes/[drillholeId]
/projects/[projectId]/samples
/projects/[projectId]/dispatches
/projects/[projectId]/assays
/projects/[projectId]/qaqc
```

The landing route should briefly explain the product and provide one clear action to enter the demo workspace. It must not become a long marketing site during Phase 1.

### Core data model

Define domain types before constructing screens. Keep source provenance on every imported record.

#### Project

- Internal ID
- Project name
- Country and region
- Commodity or commodities
- Workstream: exploration, resource definition, near-mine expansion, or grade control
- Status
- Data origin label

#### Drill programme

- Internal ID and project ID
- Name, purpose, owner, status, and target dates
- Technical question the programme is intended to answer

#### Drillhole

- Internal ID, project ID, programme ID, source ID, and hole name
- Coordinate reference system
- Longitude/latitude and easting/northing when available
- Ground elevation
- Planned collar, azimuth, dip, and target depth
- Actual collar, azimuth, dip, and final depth
- Drill date, drill type, diameter, contractor, status, and notes
- Data completeness and source reference

Planned and actual values are separate. Never silently substitute one for the other.

#### Geological interval

- Internal ID, drillhole ID, source ID
- From and to depths
- Material, rock type, lithological unit, stratigraphic unit, and description
- Recovery and RQD when available
- Logging status, logger, logged time, and source reference

Intervals must satisfy `from >= 0` and `to > from`. Gaps and overlaps must be detectable, but not automatically treated as errors until the project rule is known.

#### Core box

- Internal ID, drillhole ID, box number
- From and to depths
- Received status, condition, location, and photo references

#### Sample

- Internal ID, project sample ID, drillhole ID
- From and to depths and linked interval
- Sample type: primary, standard, blank, field duplicate, or other
- Purpose, status, creation details, and source/synthetic label

#### Custody event

- Internal ID, sample ID
- Event type, timestamp, person or organisation, location, note, and evidence
- Events are append-only in the Phase 1 demonstration. Corrections create another event.

#### Dispatch

- Internal ID and dispatch number
- Laboratory, preparation/assay request, creation date, hand-off date, received date, and status
- Included sample IDs and completeness checks

#### Assay batch and result

- Batch ID, laboratory, certificate/job reference, method, dates, and source file
- Sample ID, analyte, numeric value, unit, detection limit, method, and match status
- Preserve the original imported value in provenance data.

#### QA/QC control and review

- Control sample ID and control type
- Expected value/range when configured
- Observed value and evaluation status
- Reviewer, decision, note, and review timestamp

Phase 1 may demonstrate the workflow with explicit example limits. Label them as synthetic. Do not imply they are universal industry rules.

#### Audit event

- Entity type and ID
- Action, actor, timestamp, previous value, new value, reason, and source

Use a conventional audit trail. Do not introduce blockchain or immutable-ledger technology.

### Public demo data

Use the files documented in:

`data/demo/alberta-dig-2024-0022/README.md`

Use the curated files for Phase 1:

```text
data/demo/alberta-dig-2024-0022/curated/drillholes.csv
data/demo/alberta-dig-2024-0022/curated/intervals.csv
data/demo/alberta-dig-2024-0022/curated/assays.csv
```

They contain six linked diamond-drill holes, 27 geological intervals, and 313 assay records from source group `MAR_20020002`.

Import mapping must begin with:

| Source table | CoreChain record |
| --- | --- |
| `Drillhole_Details` | Drillhole |
| `Drillhole_Interval_Data` | Geological interval |
| `Drillhole_Assay_Data` | Assay result and source batch information where available |

Requirements:

- Treat `AGS_ID`, `Data_src`, and original hole/sample identifiers as source provenance.
- Convert documented missing-value sentinels such as `-9999` to `null` for application use.
- Retain the original source value for traceability.
- Normalise numeric units explicitly. Never guess a unit.
- Validate that every imported interval and assay points to a known drillhole.
- Keep the original ZIP and extracted raw files unchanged.
- Attribute the Alberta Energy Regulator / Alberta Geological Survey as required by the Open Government Licence - Alberta.

The public dataset does not include internal core-box, custody, dispatch, approval, or complete field-QA/QC records. Create a small, separate fixture for these records and label every record `Synthetic demonstration data`. Never blend synthetic values into the preserved source files.

### Technical foundation

Preserve the established Element TD2 Build Lab technology family:

- Next.js 15 App Router
- React 19 and strict TypeScript
- Tailwind CSS 4 plus project-owned design tokens
- Zod for domain and import validation
- React Hook Form for data-entry forms
- Zustand only for cross-screen client state when it prevents deep prop drilling
- TanStack Query for asynchronous server-state interactions when an API layer exists
- Prisma and PostgreSQL for persistence when Phase 1 reaches the database milestone
- Vitest and Testing Library for tests
- ESLint and Prettier for quality checks

Use Server Components by default. Isolate interactivity in small Client Components. Do not make an entire route a Client Component to simplify implementation.

During the read-only demo-data milestone, place file access and parsing behind a server-only repository interface. Screens must consume domain records rather than reading CSV files directly. The repository should later be replaceable by Prisma without rewriting the screens.

Suggested structure:

```text
app/
  projects/
components/
  corechain/
    shell/
    drillholes/
    samples/
    assays/
lib/
  domain/
  import/
  repositories/
  demo/
data/
  demo/
db/
tests/
  domain/
  import/
  repositories/
```

Do not add another dependency unless its value is concrete and the existing stack cannot handle the requirement. Check `package.json` before importing anything.

### First functional screen

Build the drillhole register and drillhole detail as the first functional product area.

The drillhole register must include:

- Hole name
- Drill type
- Drill date
- Final depth
- Azimuth and dip, with `Not recorded` where unavailable
- Interval count
- Assay count
- Data completeness/status
- Search and useful filters
- A clear source-data label

The drillhole detail must include:

- Strong hole identity and source reference
- Planned versus actual panel
- Location and drilling details
- Depth-based geological interval list or track
- Assay availability summary
- Source-provenance panel
- Explicit missing values
- A clear route back to the register

Do not build a fake geological cross-section. A depth track is acceptable only when its geometry is derived from actual interval depths.

### Product rules

- Data truth outranks visual polish.
- Never call the application JORC-compliant, CRIRSCO-compliant, or Philippine-compliant without a qualified review and confirmed requirements.
- Never invent a Philippine field procedure. Mark assumptions and validate them through interviews.
- Never use public demo data as proof of a real Philippine workflow.
- Do not replace GEOVIA, GIS, resource modelling, or mine-planning software.
- Design later export boundaries for approved CSV/Excel data, but do not build a direct GEOVIA or laboratory connector in Phase 1.
- Keep offline entry, QR scanning, label printing, exact approval rules, exact QA/QC limits, and formal report formats in the validation backlog.
- Every feature must reduce a real delay, failure, reconciliation task, or traceability risk.

### Milestones

#### Milestone 1: product shell and demo project

- Refine the existing home page into a concise entry point.
- Build the responsive product shell and navigation.
- Add the single demo project and source disclosure.

#### Milestone 2: domain model and public-data adapter

- Define and test the Phase 1 domain types.
- Parse and validate the three curated CSV files.
- Map missing values and preserve provenance.
- Prove there are no orphan intervals or assay records.

#### Milestone 3: drillhole explorer

- Build the drillhole register.
- Build the drillhole detail view.
- Show real interval and assay counts and source information.

#### Milestone 4: traceability demonstration

- Add clearly labelled synthetic core boxes, samples, custody events, and one dispatch.
- Connect them to real drillholes and intervals without altering source data.
- Show the chronological chain on the drillhole/sample view.

#### Milestone 5: assay and QA/QC demonstration

- Match selected assay records to demonstration samples.
- Add standards, blanks, or duplicates only as clearly labelled synthetic controls.
- Show unmatched, missing, flagged, reviewed, and accepted states.
- Make it explicit that the geologist makes the decision.

#### Milestone 6: pilot readiness

- Complete responsive, accessibility, and state reviews.
- Add export boundaries and a source/provenance explanation.
- Prepare the screens for feedback from Philippine users.
- Record unresolved field-practice questions in the discovery documents.

Do not attempt all milestones in one uncontrolled implementation. Finish and verify one milestone before starting the next.

### Verification gate after every milestone

Run the checks appropriate to the change:

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

Also inspect the working route in the browser at desktop and narrow widths. Verify loading, empty, error, keyboard, and missing-data states when relevant. Do not move to the next milestone with a known failure.

After a milestone that materially changes a screen, show the working screen to the project owner and provide a short explanation of what the user can now accomplish.

### Phase 1 acceptance criteria

Phase 1 is complete only when:

- The app has one coherent product shell and visual system.
- The six public drillholes, 27 intervals, and 313 assays load through a validated data adapter.
- Drillhole records expose missing values honestly.
- The user can navigate from project to drillhole to interval/assay evidence.
- At least one synthetic sample can be traced through custody, dispatch, assay matching, and QA/QC review.
- Public and synthetic data are visibly distinguished.
- Source attribution and provenance remain available.
- No screen claims regulatory compliance or geological certainty the evidence does not support.
- Lint, typecheck, tests, and production build pass.
- The application is ready to be shown to a geologist for workflow feedback.

### Authoritative project references

Read these before making product decisions:

```text
docs/product/corechain-product-pillars.md
docs/product/mining-operations-context-and-roles.md
docs/discovery/mvp-validation-brief.md
docs/discovery/day-1-to-day-30-pilot.md
research/core-workflow-primer.md
research/geovia-collaboration-strategy.md
data/demo/alberta-dig-2024-0022/README.md
```

External references:

- CRIRSCO International Reporting Template: https://crirsco.com/documentation/itr/
- JORC Code and Table 1 resources: https://jorc.org/library/
- Alberta public dataset: https://ags.aer.ca/publications/all-publications/dig-2024-0022

Treat these standards as evidence and reporting references, not as permission to claim compliance.

### Working behaviour

- Make informed, reversible assumptions and document them.
- Preserve unrelated user files and research.
- Use real source data wherever it exists.
- Label synthetic data at the record and screen level.
- Explain mining-specific assumptions in plain language.
- Keep each milestone small enough to inspect and test.
- Lead every handoff with what now works for the user.

---

## Current starting point

The Next.js application foundation, dependency set, initial product-pillar screen, public data source, and curated CSV files already exist. Begin with **Milestone 1**, auditing the current screen before changing it.
