# CoreChain product pillars

## Purpose

CoreChain should help exploration teams keep drilling, core, samples, laboratory results, and QA/QC connected in one trustworthy working chain. Its job is not to replace geological modelling software such as GEOVIA. Its job is to make the operational data feeding those tools easier to capture, check, find, and hand over.

These pillars are a working product direction. Questionnaire and interview feedback can change the priority or detail, but any early feature should strengthen at least one pillar.

## 1. Trace every sample without guessing

**The promise:** At any point, the team can see where a sample came from, who handled it, where it is now, and what happened to it.

The essential chain is:

`Drillhole → interval → core box → geological log → photo → sample → custody event → dispatch → assay batch → QA/QC decision`

**What this means in the MVP**

- Give every sample a clear ID tied to a drillhole and depth interval.
- Record key custody events: created, packed, handed over, dispatched, received, and results imported.
- Keep the source photo, core-box reference, and relevant notes close to the sample record.
- Make missing links visible rather than letting the team silently assume they are correct.

**Success test:** A project geologist can answer “Where is sample DDH-01-12345, and what supports its result?” in under a minute.

## 2. Make field capture faster than Excel, paper, or chat

**The promise:** Logging a core interval or creating a sample should feel quicker and safer than the team’s current workaround.

**What this means in the MVP**

- Simple interval-based core logging with project-specific geological codes.
- Capture recovery, RQD, geology fields, notes, and photos without duplicate entry.
- Use sampling rules to prevent basic mistakes such as gaps, overlaps, or invalid sample IDs.
- Start with a practical browser experience; validate offline use, QR scanning, and label printing before committing to them.

**Success test:** A field or core-yard user can log a normal interval and create its samples with little training and no later retyping.

## 3. Turn laboratory data into visible QA/QC decisions

**The promise:** When assay results arrive, the team can tell what is complete, what has failed a check, and what needs attention.

**What this means in the MVP**

- Import laboratory results from CSV or Excel before pursuing direct lab integrations.
- Match imported results to the correct sample and dispatch.
- Show standards, blanks, and duplicates in a straightforward review view.
- Flag missing, unmatched, or out-of-range controls for a geologist to review.
- Record the decision and note; do not pretend the software makes the geological judgment.

**Success test:** The project geologist can identify outstanding and flagged results without manually reconciling multiple spreadsheets.

## 4. Give the team one operational picture, with accountable changes

**The promise:** Managers and coordinators see progress and bottlenecks, while the project retains a reliable record of what changed and why.

**What this means in the MVP**

- A dashboard showing logged, sampled, dispatched, received, imported, and flagged work.
- Clear role boundaries for who can create, edit, dispatch, import results, review QA/QC, and finalise a record.
- A normal audit trail: who changed what, when, and why.
- Export clean, approved project data to CSV/Excel for analysis and GEOVIA-compatible workflows.

**Success test:** An exploration or operations lead can see a project’s workflow status without chasing individual messages or separate spreadsheets.

## What CoreChain will not try to be in the first release

- A replacement for GEOVIA, GIS, geological sections, or 3D modelling.
- A direct laboratory integration platform before a pilot proves which labs and formats matter.
- An automated report writer.
- An enterprise system for every project and business unit.
- A blockchain product. A clear, conventional audit trail is the initial requirement.

## Initial build order

1. **Project setup** — project, users, geological codes, and sampling rules.
2. **Core logging** — drillholes, intervals, recovery/RQD, geology, and photos.
3. **Sample chain** — IDs, status, custody, and dispatches.
4. **Assay import and QA/QC review** — CSV/Excel import, controls, alerts, decisions.
5. **Operational dashboard and export** — status, outstanding work, audit history, and clean CSV/Excel export.

## The product decision rule

Before adding a feature, ask:

1. Does it reduce an actual failure, delay, or reconciliation task in the core-to-assay workflow?
2. Does it make the daily user’s job quicker, clearer, or safer?
3. Can we validate it with a real Philippine exploration workflow in the next pilot?

If the answer is not clearly yes, it belongs in the later backlog—not the first CoreChain build.
