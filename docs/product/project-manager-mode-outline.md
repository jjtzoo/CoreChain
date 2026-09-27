# Project manager mode: outline

Status: approved by the owner and built on 2026-09-27 (steps 1 to 5 in section 4; E19 in the sprint plan). The "exists today" and "new" marks describe the app before that build. Mockup: `docs/product/mockups/manager-mode.html`.

## 1. Who this is for

The resident / project manager runs one exploration project on site. Their job is to turn the drilling plan into daily work and to answer two questions: **is the programme on track, and can we trust the data?** They sit between the chief geologist or exploration manager, who sets technical direction, and the geologists who log core (see `mining-operations-context-and-roles.md`).

In CoreChain they are one web account per team (a team is the people around one rig, D17). The drill rig team lead has no account; the field geologist records what the rig produces.

## 2. What the role is responsible for

| # | Responsibility | What they need to see or do in CoreChain |
|---|---|---|
| 1 | Run the drilling programme | Planned against drilled metres, holes by status, what is being drilled now, which hole is next, set priority |
| 2 | Manage the people | Who is on which hole, workload, what each geologist did today, which phones are active |
| 3 | Set the project's standards | Code library, standards and blanks, QC insertion rates, sample tag series |
| 4 | Keep the sample chain moving | Samples waiting to be sent, dispatches at the laboratory, how long results are taking, samples with no result |
| 5 | Oversee quality | What QA/QC held or rejected, and why; which decisions need the manager (re-assay, re-sample) |
| 6 | Interpret and report upwards | Results by hole and depth in 3D, a progress summary for the exploration manager |

Out of scope for CoreChain: permits, community relations, safety, budget, and drilling contractor billing.

## 3. Structure

A top bar with six places. The team overview stays the "today" page; each project gets its own page with tabs, and that is where the 3D view lives.

```
Today      Projects      Holes      Samples & lab      Team      Setup          [Find a sample or hole]
```

### 3.1 Today (`/team`)

The first page after sign-in. What needs the manager now, across the team's projects.

- **Figures:** metres drilled this week, holes drilling, samples waiting to be sent, results overdue, QA/QC held or rejected. *(Mostly exists today; "this week" and "overdue" are new.)*
- **Needs attention:** one list mixing urgent holes, holes with logging gaps, dispatches past the expected turnaround, and QA/QC holds. Each line opens the right page. *(Exists today in part.)*
- **Projects:** one card per project with drilled against planned metres, holes by status, results returned, and two buttons: **Open project** and **3D view**. *(New. Replaces the held "Projects" row.)*
- **Recent activity:** the last few entries, with a link to the full feed. *(Exists today.)*

### 3.2 Projects (`/team/projects`) and the project page (`/team/projects/[id]`)

A short list of the team's projects, then one page per project with five tabs.

- **Summary** *(new)*: programme progress (drilled against planned metres, holes completed of planned), holes by status, average core recovery, samples taken and QC inserted against the project's rates, results returned and waiting, laboratory turnaround.
- **Holes** *(exists as the team hole list, filtered here)*: the project's holes with status, depth, recovery, geologist, priority. Assign and priority work as today.
- **3D view** *(exists today, E18)*: the evidence view, unchanged. Opened from the project card on Today, this tab, or "See in 3D" on a hole page.
- **Samples & lab** *(new, reuses existing data)*: this project's dispatches, results waiting, QA/QC outcome.
- **Progress report** *(new)*: a one-page summary of the period (default: last 7 days) to print or save as PDF for the exploration manager. Numbers only from recorded data; no forecasts.

### 3.3 Holes (`/team/holes`)

The current cross-project hole list and hole detail panel, moved off the overview onto its own page. Filters: All, Urgent, Drilling, Needs attention. Hole page as today (log, graphic log, custody, photos, "See in 3D"). *(Exists today.)*

### 3.4 Samples & lab (`/team/samples`)

- **Dispatches:** each dispatch with laboratory, samples, handed over, results returned, and days waiting. Longest waiting first. Uses `handover_at` and `results_returned_at`, which exist. "Overdue" means more than 14 days at the laboratory, a fixed default until the owner asks for a setting. *(New view.)*
- **QA/QC held or rejected:** each decision with the hole, stage, reviewer's note and the exceptions recorded with it. Read-only for the manager; the reviewer decides. *(New view of existing data.)*
- **Find a sample:** as today. *(Exists today.)*

### 3.5 Team (`/team/people`)

- People: each geologist and QA/QC account, their holes, metres logged this week, last activity. *(Workload exists today.)*
- Phones: which phones are syncing and when they last did. Approval of new phones is E17, not in this outline.
- Activity: the full feed. *(Exists today.)*

### 3.6 Setup

Code library, standards and blanks, print tags, and each project's QC insertion rates and sample prefix. *(The lists exist today. The project settings are shown, not edited: the phone owns the project and changes it under the project's Settings, so a web edit would compete with the phone's copy.)*

## 4. What changes, in order

| Step | What | Needs | Size |
|---|---|---|---|
| 1 | Top bar with the six places; move the hole list to Holes; Today gets project cards with "Open project" and "3D view" | Web only | 1 to 2 sessions |
| 2 | Project page tabs: Summary, Holes, 3D view, Samples & lab | Web only, existing data | 2 sessions |
| 3 | Samples & lab page: dispatch turnaround and the QA/QC held or rejected list | Web only, existing data | 1 session |
| 4 | Progress report, print or save as PDF | Web only | 1 session |
| 5 | Team page with phones and last sync | Web only | 1 session |
| Later | Send a log back to a geologist for correction | Migration and a new APK | To size |
| Later | A "Rig" field on holes | Migration and a new APK | Small |
| Later | Phone approval (E17) | Migration and a new APK | 2 to 3 sessions |

Steps 1 to 5 need no migration, no sync change and no new APK.

## 5. Decisions for the owner

1. Is the list of responsibilities in section 2 right for a Philippine exploration site?
2. The six places in the top bar, and the 3D view as a tab on the project page (plus a button on each project card on Today).
3. The order in section 4.
