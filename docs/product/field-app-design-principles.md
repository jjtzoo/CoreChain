# Design principles for CoreChain Field

Researched 2026-09-21 to guide the phone app after the owner said it "feels like just an input app". Each principle says where it comes from. Vendor pages are marketing material, not usability studies, so everything here is a starting point to test with geologists, not a verdict.

## What the leading tools do

The established geological logging tools (Seequent LogChief, Micromine Geobank Mobile, TabLogs for geotechnical logs) agree on a small set of ideas:

- **Validate at the moment of capture.** Pick lists, templates and rules stop bad data before it reaches the database ([LogChief](https://www.maxgeo.com/software/logchief); [Geobank](https://www.miningmonthly.com/international-coal-news/news/1271527/micromines-geobank-solution-goes-mobile)).
- **Work offline, sync when a signal returns**, and log on site rather than typing up in the office ([TabLogs](https://tablogs.com/en-au/features/app)).
- **Connect the devices around the geologist:** GPS, camera, barcode readers, magnetic susceptibility meters and scales ([Geobank](https://www.australianmining.com.au/micromine-releases-geobank-mobile-2019/)).
- **Keep a full audit trail** of who logged what ([LogChief](https://www.maxgeo.com/software/logchief)).

None of them shows the geologist a picture of the hole on the phone in what I could read, which is where CoreChain can differ.

## Principles

1. **Give something back for every entry.** Each capture screen should be paired with a view of the result: a graphic hole log, progress for the day, a summary of the work. _(Owner feedback; plan stories E4-6 and E14.)_
2. **Show the sync state always.** Offline, unsynced items, failed changes and retry, and completed uploads should be visible without hunting ([offline-first UX guidance](https://hasura.io/blog/design-guide-to-offline-first-apps)). _(Have: "Up to date", Send again. Missing: per-record badge, E8-4.)_
3. **Choose conflict handling on purpose.** Last write wins for simple fields, field-level merge for records several people touch, and a manual choice where a machine should not guess ([offline-first architecture guide](https://dev.to/odunayo_dada/offline-first-mobile-app-architecture-syncing-caching-and-conflict-resolution-518n)). _(Plan: E8-5.)_
4. **Design for gloves and one hand.** Material's minimum touch target is 48 dp, and 56 dp or more is more reliable in the field; avoid precision swipes, and keep destructive buttons away from common ones ([field-app usability guidance](https://corvusintell.com/blog/field-apps/ruggedized-ux-military-operators/)).
5. **Design for sunlight.** High contrast (7:1 for primary status and critical text), large type (16 to 18 px) and status shown by colour plus icon plus word, with a light or high-contrast mode as an option ([same source](https://corvusintell.com/blog/field-apps/ruggedized-ux-military-operators/)).
6. **Draw the log the way geologists read it.** Depth runs down the page; adjacent columns for lithology, alteration, veining or mineralisation and structure; standard colours or patterns with a legend ([graphic log conventions](https://www.geologyin.com/2015/01/how-to-draw-graphic-log.html); [log column designs](https://help.rockware.com/logplot8/WebHelp/log_designer_body_lith_pattern.htm)).
7. **Dashboards have one purpose, reveal detail on demand, and never rely on colour alone.** On small screens use a simplified chart with the key points annotated ([Material data visualisation](https://m2.material.io/design/communication/data-visualization.html)).
8. **Log by exception.** Copy the previous interval, default to the last value, and ask only for what changed. _(Have: copy previous interval.)_

## Where the app stands today (from the phone, 2026-09-21)

| Area | Status |
| --- | --- |
| Validation at capture, pick lists, continuity check | Have |
| Offline, sync, audit trail (append-only custody) | Have |
| Sync status | Partly: overall state and Send again, no per-record badge |
| Graphic hole log | Missing (E4-6) |
| "My work" dashboard | Mockup only (E14) |
| Touch targets and delete buttons | Check: on the core log the red delete button sits beside Sample and Photos |
| Sunlight and contrast | Partly: a light theme tuned for bright light exists and follows the phone's setting (the test phone was in dark mode). To do: a contrast check of the grey secondary text, and an in-app switch so a geologist can force light outdoors |
| Devices: barcode or QR labels, scale, magnetic susceptibility | Not built (later backlog) |

## To test with a geologist

- Can you read every screen in bright sun, and with a glove on?
- Which single number or picture do you check first at the end of a shift?
- Would you use a graphic log to spot mistakes, or only to show a manager?
