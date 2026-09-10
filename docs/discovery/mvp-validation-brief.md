# CoreChain MVP validation brief

## The question to answer

Before building CoreChain, establish the daily problem severe enough that a mine or exploration team would pay to solve it. Validate the workflow, not merely the screens.

## Decisions to validate

| Area | What we need to decide |
| --- | --- |
| Customer | Is this for exploration companies, operating mines, drilling contractors, or geology consultants? Who pays? |
| Main user | Who uses it daily: field geologist, core-yard technician, project geologist, lab coordinator, or manager? |
| MVP workflow | Where does the workflow begin and end: core receipt → logging → samples → lab → QA/QC → report? |
| Required data | Drillholes, intervals, core boxes, photos, samples, custody events, dispatches, assay batches, QA/QC controls, and approvals. |
| Field reality | Must it work on phones or tablets? Must it work offline? Who enters data when internet is poor? |
| Standards | Which Philippine codes, sampling procedures, reporting requirements, and client rules apply? |
| Authority | Who can create, edit, approve, dispatch, import results, and finalize reports? |
| Integrations | Start with Excel or CSV imports, or connect directly to labs, GIS, databases, barcode printers, and existing systems? |
| Security | Who owns the data? Where is it stored? Is an audit trail enough, or is immutable proof actually required? |
| Pilot | Which real project can test it, for how long, and what result proves it worked? |

## Build first

- Project setup: users, geological codes, and sampling rules.
- Core logging: intervals, geology fields, photos, recovery, and RQD.
- Sample tracking: sample IDs, status, dispatch records, and custody history.
- Assay import: CSV or Excel upload before laboratory integrations.
- Basic QA/QC: standards, blanks, duplicates, and alerts.
- Dashboard: logged, pending, dispatched, received, and flagged work.

## Validate before building

- Offline field use.
- QR-code scanning and label printing.
- Exact QA/QC rules and acceptance limits.
- Approval workflow.
- Required report formats.
- Map and drillhole visualisation needs.

## Build later

- Direct laboratory connections.
- Advanced GIS, sections, and 3D modelling.
- Automated report writing.
- Cross-project enterprise administration.
- Blockchain or immutable-ledger technology; a normal audit trail may be enough initially.

## Executive discovery questions

1. Where does this workflow most often fail today?
2. Who feels that problem most strongly?
3. Which records must be accurate and traceable?
4. What is usually still done in Excel, paper, or messaging apps?
5. Does field work require offline entry?
6. What would make geologists refuse to use this?
7. What reports or QA/QC checks consume the most time?
8. If CoreChain solved one issue in 90 days, which one would be most valuable?

## Immediate next outcome

Define the exact Day 1–Day 30 pilot workflow before writing production code.
