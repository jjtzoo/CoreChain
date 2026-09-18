# CoreChain

## What CoreChain is

CoreChain is an offline-first workflow platform for exploration and mining teams. It keeps the chain between drilling, core logging, samples, custody, laboratory results, and QA/QC decisions clear, connected, and easy to trace.

It is designed for the reality of field and core-yard work: teams need to keep working even when internet access is unreliable, then safely sync their work once they are connected again.

## The problem we are solving

Important exploration data is often spread across paper records, spreadsheets, chat messages, laboratory files, and specialist software. This can make it difficult to answer simple but critical questions:

- Where did this sample come from?
- Which drillhole and depth interval does this assay result represent?
- Who handled the sample and when was it dispatched?
- Is a result complete, missing, or waiting for QA/QC review?

CoreChain brings this operational evidence into one trustworthy working chain. It supports geological teams; it does not replace professional geological judgement, resource estimation, mine planning, or modelling tools such as GEOVIA.

## What has been completed

CoreChain has a working Phase 1 demonstration built around an attributed public Alberta drillhole dataset. The demonstration shows a connected drill-to-assay workflow and validates the product direction before production deployment.

- A project workspace with overview, drillholes, samples, dispatches, and assays/QA/QC areas.
- Drillhole records with collar details, planned-versus-actual information, geological intervals, and assay information.
- Sample traceability that connects a labelled sample to its source interval, custody events, dispatch, and matched assay result.
- QA/QC-oriented assay views that make unmatched or review-needed results visible.
- Source provenance and audit-oriented record views, including clear handling of missing source data.
- Product research, pilot materials, and workflow documentation for Philippine exploration and mining teams.

## What we will build next

The next stage moves from a connected demonstration to an offline-first field product, developed and tested with real users.

### 1. Organizations, users, and role-based access

Each client organization will have its own protected workspace. A client administrator will invite users and give them only the access needed for their work.

Initial roles for the demo product:

- **Platform administrator** — manages CoreChain demo organizations and support access.
- **Client administrator / exploration manager** — manages the organization, projects, members, and role assignments.
- **Project geologist** — manages drillhole and sample records, reviews work, and resolves issues.
- **Core-yard technician** — records core intervals, creates samples, and updates custody in the field.
- **Data and QA/QC reviewer** — imports or reviews assay results and records QA/QC decisions.
- **Viewer** — reads approved project records without editing them.

### 2. Offline-first mobile field workflow

After a user signs in while connected, CoreChain will securely download the organization, project, and permissions data relevant to that device. The user can then work without a signal.

The first offline workflow will allow a core-yard technician to:

1. Open an assigned project without internet access.
2. Create a sample from a drillhole and depth interval.
3. Save the record safely on the device.
4. See whether it is synced, pending sync, or needs attention.
5. Sync the work when connectivity returns.

### 3. Practical project workflow

The product will then expand through the core operational chain:

`Project → drillhole → interval → core logging → sample → custody → dispatch → assay → QA/QC decision`

The intended build order is:

1. Organization and project setup, user roles, geological codes, and sampling rules.
2. Offline core logging and sample creation.
3. Sample custody and laboratory dispatch tracking.
4. Assay import, matching, and QA/QC review.
5. Project status, audit history, and export for approved downstream use.

## Our measure of success

CoreChain succeeds when a geological team can trace a sample from its assay result back to its drillhole and depth interval quickly, understand what happened to it, and continue recording field work even when there is no internet connection.
