# CoreChain collaboration strategy: GEOVIA and geological modelling tools

## Product position

CoreChain should complement, not replace, specialist geological modelling and mine-planning tools such as GEOVIA Surpac.

- **CoreChain:** operational data capture, traceability, custody, workflow status, basic QA/QC, and a governed record of what happened in the field and laboratory process.
- **GEOVIA / Surpac:** geological drillhole database use, interpretation, geological and resource modelling, planning, analysis, and visualisation.

## Source-of-truth boundaries

| Data or decision | System of record |
| --- | --- |
| Core receipt, core-box information, photographs, logging draft, sample identity, custody, dispatch, and QA/QC workflow status | CoreChain |
| Geological model interpretations, resource estimates, mine designs, and planning outputs | GEOVIA / Surpac or the customer's nominated modelling system |
| Reference codes, coordinate system, project ownership, and approved data-release policy | Agreed project governance |

CoreChain must never silently overwrite a geological model. GEOVIA must not become the only record of a sample’s physical custody or field-work history.

## Shared identifiers and minimum data contract

Every exchange must retain these stable identifiers:

- `project_id`
- `hole_id`
- `from_m` and `to_m`
- `sample_id`
- `assay_batch_id` where relevant
- export version, timestamp, and approval status

CoreChain should also record coordinate-reference-system metadata, data dictionary/code-list version, exporter, and validation warnings.

## Integration roadmap

### Phase 1 — MVP: compatible file exchange

Provide a “GEOVIA-ready export” that creates documented CSV or Excel files, with mapping templates for the customer's drillhole database.

- Collar data
- Downhole surveys
- Geological intervals and codes
- Recovery and RQD intervals
- Sample intervals and assay results
- Optional structural measurements
- Export manifest showing records included, rejected, and warning status

This is a practical starting point because GEOVIA Surpac supports importing CSV data into drillhole database tables. Its own materials identify collar and deviation/survey information as core drillhole-database inputs and treat data such as geology, assays, and RQD as additional tables.

### Phase 2 — controlled synchronisation

After a pilot proves the export structure works, add a scheduled or user-triggered export package.

- Export only approved records by default.
- Send a new version; do not overwrite earlier exports.
- Include a reconciliation report by `hole_id`, interval, sample, and batch.
- Allow a geologist to review and approve the release.

### Phase 3 — enterprise connector

Build a direct connector only after confirming the customer's GEOVIA edition, deployment, licences, data model, security rules, and vendor-supported integration route.

Possible routes include a customer's 3DEXPERIENCE data environment or their approved database connection. This should normally be read-only from CoreChain's perspective at first, with explicit approval for any update operation.

## Product guardrails

1. No automatic write into GEOVIA in the MVP.
2. No export of unapproved or failed-QA/QC data unless an authorised user deliberately overrides the rule with a recorded reason.
3. Do not alter customer geological codes, units, coordinate systems, or depth intervals during export without a visible mapping and validation report.
4. Preserve lineage: every exported result must link back to its CoreChain records and export version.
5. Build the first integration with a real pilot project's existing GEOVIA schema, not a guessed generic schema.

## Candidate CoreChain feature

**Validated data release**: an authorised project geologist reviews an export summary and creates a versioned GEOVIA-ready package. The package is a release of trusted operational data, not a substitute for geological interpretation.

## Sources for the final PDF

- Dassault Systèmes, “Surpac Structural Suite – Part 3.” It documents creating a matching drillhole-database table and importing CSV data into it. <https://blog.3ds.com/brands/geovia/surpac-structural-suite-part-3/>
- Dassault Systèmes, “Creating a drillhole database in GEOVIA Surpac” (Spanish). It identifies collar and deviations as required inputs and geology, grades/assays, and RQD as optional data tables. <https://blog.3ds.com/brands/geovia/spanish-crear-una-base-de-datos-de-sondajes-en-geovia-surpac/>
- Dassault Systèmes, “Improving Geological Modelling in the Age of Data Overload.” It describes the 3DEXPERIENCE platform as a central geoscience-data repository connected to Surpac. <https://blog.3ds.com/brands/geovia/improving-geological-modelling-in-the-age-of-data-overload/>
