# The field workflow, where it hurts, and the design principles that follow

Status: working document, 2026-09-20. Owner: Product Owner. It mirrors how core is really handled, marks where the work hurts, and turns that into rules the app's design is held to.

**How to read the evidence.** Every friction point is tagged:

- **[Doc]** stated in the Philippine rules: DAO 2010-21 (Revised IRR of the Mining Act) or the PMRC 2020 (Philippine Mineral Reporting Code).
- **[Seen]** we hit it ourselves in the internal alpha.
- **[Hypothesis]** common in field work but not yet confirmed with Philippine geologists. Each one is a question for the friendly-geologist test (section 6), not a fact.

There is no official Philippine procedure for how to log core. The rules say what must be reported and kept; the recording steps are each company's own procedure. So the workflow below follows accepted practice and the PMRC's list of what a company must be able to show, and the app's flow is our design decision, not a compliance one.

## 1. The workflow we mirror

| # | Step | Who | What gets recorded | Where the rules touch it |
|---|---|---|---|---|
| 1 | Plan the hole | Project geologist | Collar, azimuth, dip, planned depth | PMRC 3.1.5 (collar and downhole survey methods) |
| 2 | Drill and record runs | Driller, geologist | Run depth from/to, length drilled | PMRC 3.2.1 (drilling type, core diameter, orientation) |
| 3 | Bring core to the yard and box it | Core-yard technician | Box number, depth range per box | |
| 4 | Wash, fit and mark orientation | Technician, geologist | Marks, breaks | PMRC 3.2.1 |
| 5 | Photograph, wet and dry, before cutting | Technician | Photos tied to box and depth | PMRC 3.2.3 |
| 6 | Measure recovery and RQD | Technician, geologist | Recovered length, RQD pieces | PMRC 3.3.6 (how recovery is recorded) |
| 7 | Log the geology | Logging geologist | Depth intervals: lithology, alteration, mineralisation, weathering, structure | PMRC 3.2.2 to 3.2.4, including **total length and percentage logged** |
| 8 | Choose and mark sample intervals | Geologist | Sample depths, cut line | PMRC 3.3.2 |
| 9 | Cut, bag and tag; insert QC samples | Technician | Sample number, cut (whole, half, quarter), standards, blanks, duplicates | PMRC 3.3.7, 3.6 |
| 10 | Store the remaining core | Core yard | Where it is kept | PMRC 3.3.5; DAO 22(i): a quarter of the core to the MGB core library **on request** |
| 11 | Dispatch to the laboratory | Data manager, courier | Batch, who handed what to whom and when | PMRC 3.5.2 (**chain of custody**), 3.4.1 (lab and accreditation) |
| 12 | Prepare and assay | Laboratory | Results, batch data | PMRC 3.4 |
| 13 | Import and QA/QC review | QA/QC, chief geologist | Exceptions, decisions | PMRC 3.5.3 (validation, transcription errors), 3.5.4 (audits) |
| 14 | Report | Resident/project manager, Accredited Competent Person | Semester and final reports | DAO 22(d) (every semester, inspected by the MGB), 22(h) (final report with sample locations and assays); PMRC (public results) |

## 2. Friction map

| Step | Friction | Tag | Who feels it | Cost | Design response |
|---|---|---|---|---|---|
| 2 to 9 | **The same core depths are typed again for run, box, log interval and sample.** Each record is a different measurement, so they can't be merged, but the start of each is known and the end is often a landmark already entered. | [Seen] | Geologist | Time, typos, fatigue at the end of a shift | P1 |
| 3 to 9 | Working with wet, gloved or muddy hands; glare; one hand free | [Hypothesis] | Everyone in the core yard | Mis-taps, slow entry | P3 |
| all | No signal at the rig or camp | [Hypothesis, and why the app is offline-first] | Everyone | Data that has to wait for a signal | P4 |
| 7 | Notes on paper first, typed in at night | [Hypothesis] | Logging geologist | Double entry; PMRC 3.5.3 names transcription errors as a risk | P1, P4 |
| 6, 7 | Depth arithmetic slips: gaps or overlaps between intervals, recovery over 100%, box ends that don't match run ends | [Hypothesis] | Geologist, QA/QC | Errors found weeks later at import | P5 (warnings exist in the alpha) |
| 7 | Inconsistent rock names between loggers; free-text codes | [Hypothesis] | Chief geologist, modeller | Cleaning before modelling | P8 |
| 5 | Photos named by the camera and not tied to a box or depth; wet and dry not distinguished | [Hypothesis] | Everyone downstream | Time hunting for the picture | P6 |
| 9 | Duplicate or missing sample numbers; pre-printed tags out of order | [Hypothesis] | Technician, lab | Mix-ups that can't be undone | Sample-number blocks (E6-4) |
| 9 | Forgetting the QC insertion rate | [Hypothesis] | Geologist, QA/QC | Gaps in the QC record (PMRC 3.6) | Reminders (exist) |
| 11 | Custody recorded on loose paper, unsigned or late | [Hypothesis, and PMRC 3.5.2] | Data manager | Broken chain of evidence | E7, P6 |
| 12, 13 | Errors surface at lab import, weeks after the core was logged | [Hypothesis] | QA/QC, geologist | Re-logging from memory | P5, P10 |
| 14 | Semester and final reports assembled by hand from scattered files | [Doc: 22(d), 22(h)] | Resident manager | Days of work, inspection risk | P11 |
| 7 | Two people logging one hole; a shift handover | [Hypothesis] | Team | Conflicts, lost context | Sync and conflicts (E8), P9 |
| all | A lost, broken or stolen phone | [Hypothesis] | Company | Lost data, data leak | Encrypted database, sync, remote wipe (D11, E1-5) |
| all | Interruptions in the middle of an entry | [Hypothesis] | Everyone | Half-typed work lost | Autosave drafts (exist) |

## 3. Design principles

Each principle is a rule the design is held to, with a test that can fail.

**P1. Capture once, derive everywhere.** Depth is the spine of the app. The start of any record is inherited from the last one; only the end is entered, from a shortcut ("end of last run", "end of this box", "+1 m") or by tapping the depth strip. Running a run, boxing it, logging it and sampling it should not mean typing its depths four times. *Test: count the depth values typed for one 3 m run taken all the way to a sample. It must fall.*

**P2. Follow the physical order of the work.** The hole screen answers "what's next at this hole?" first (the boxes waiting for photos, the intervals not yet logged, the samples not yet bagged), in the order the core moves. Screens mirror the chain in section 1.

**P3. Field-first ergonomics.** Tap targets of 52 dp or more, main actions at thumb reach, no precision gestures, high contrast in sun and shade, light and dark themes, everything usable one-handed. Dictation for notes is a later addition.

**P4. Never lose work.** Offline by default, autosaved drafts, append-only history, no silent overwrites, undo where it can be offered. The phone is the first place a record exists, and sync is a backup, not a prerequisite.

**P5. Prevent errors at entry, not at import.** Smart defaults, constrained pickers, and inline warnings for what is suspicious (a gap, an overlap, recovery over 100%, a QC insertion that is overdue). Block only what is impossible. A warning must be dismissible with a reason, so the geologist stays in charge.

**P6. Evidence is attached as it is captured.** Who, when, on which device, with which version, and where, are recorded without asking. A photo is tied to its box and depth at the moment it is taken. Custody events append; they are never edited.

**P7. Progressive disclosure.** The fast path needs only what the field needs (depth and rock code). Everything else is optional and one tap away, and never blocks saving.

**P8. Speak the geologist's language.** Industry terms, standard code lists that the project can edit, metres throughout, plain messages that say what to do next and never blame the person.

**P9. Show state, not only data.** Percentage logged, the continuity strip, samples waiting to be bagged or dispatched, sync status, and the age of unsynced work are always one glance away.

**P10. Design the exceptions.** QC failures, a missing custody link, a switched-off account, an expiring session, and a sync conflict each get a calm, specific screen with a next action. Exceptions are where trust is won or lost.

**P11. Compliance is a by-product.** The semester report, the final-report sample-location tables, and the core-library submission list (a quarter of the core, on request) are produced from records already captured, not written separately.

**P12. Each person sees their own work first.** The tier (field geologist, QA/QC, laboratory, resident/project manager) decides the first screen and the guide (E10-1). One app, different front doors.

## 4. What it changes in the app

| Change | Principle | Size | Where it fits |
|---|---|---|---|
| Depth shortcuts on every "to" field: end of last run, end of this box, end of last interval, +1 m | P1 | Small | Next workflow pass |
| "Hole next steps" on the hole screen: boxes to photograph, intervals to log, samples to bag | P2, P9 | Medium | After alpha feedback |
| Run-first "Add core" flow: enter the run once; one tap each to box it, log it, or split at a tap on the strip | P1, P5 | Large (mock up first) | Sprint 6 or later, from tester feedback |
| Sample from an interval, and split an interval into equal samples | P1 | Medium | With E6 follow-ups |
| Fields the PMRC asks for that we lack: how each sample was cut (whole, half, quarter), core orientation, drill core diameter (the hole already has it), core storage location, lab name and accreditation | P11 | Small | Before the field test |
| Core-library flag: mark which core was submitted to the MGB on request (DAO 22(i)) | P11 | Small | With custody (E7) |
| Semester report and final-report export | P11 | Medium | After the field test |

## 5. How we will know the design is working

Measured during the field test, from the app itself:

- **Depth values typed per run taken to a sample.** Falls after P1 work.
- **Time from opening a hole to a saved interval.**
- **Corrections per 100 records** (edits within a day of entry).
- **Warnings dismissed versus fixed**, and the reasons given.
- **Unsynced work: the age of the oldest unsynced record.**
- **Photos with a box or depth link, as a share of all photos.** Target: all.

## 6. Questions for the friendly geologist

1. Do you log on paper first, or straight into a device? What happens at night?
2. Walk me through one box from arrival to bagging. Where do you slow down?
3. What do you type more than once?
4. What goes wrong most often between the core yard and the lab?
5. Which standard or procedure does your company follow (its own SOP)? May I see it?
6. Who needs to see your logs the same day, and why?
7. Which reports do you build by hand, and how long do they take?
8. What would make you stop using an app like this?

Ask them to log one box while you watch, and count the taps and the pauses. That observation tells us more than any answer.

## Sources

- DENR Administrative Order 2010-21, Section 22 (terms of an exploration permit): https://www.pntr.gov.ph/wp-content/uploads/2021/04/AO-2110.pdf
- PMRC 2020 Edition, Table 1, Section 3 (exploration and drilling, sampling techniques and data): https://geolsocphil.com/materials/1hJPE22uN9e39c0ssWR0Loq5VV4BMJKu.pdf
- `docs/product/mining-operations-context-and-roles.md` (the business-to-field chain and roles)
- The MGB has proposed revising DAO 2010-21 and the PMRC's implementing rules have been updated: confirm both are current before designing compliance features around them.
