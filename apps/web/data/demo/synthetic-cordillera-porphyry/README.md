# Cordillera porphyry sample (synthetic)

## Purpose

A **fictional** Philippine-style porphyry copper-gold prospect for demos and screenshots. It exists because the public datasets we could use freely (Alberta) do not look like the deposits Philippine exploration teams work on. Every hole, coordinate, depth and log line here was written by us.

It is **not real data**. It does not describe any real property, company or drill programme, and it must never be used for technical, operational, investment or resource-estimation decisions. Anywhere it is shown it must be labelled synthetic.

## What it models

A typical porphyry system, from the surface down in the centre of the prospect:

- a weathered cap (completely to highly weathered, clay-altered) over
- a phyllic (sericite-pyrite) zone, then
- a potassic core with chalcopyrite and bornite in quartz stockwork and a small hydrothermal breccia, then
- diorite and andesite with propylitic (chlorite-epidote) alteration at depth and at the edges.

Holes CDL-001 to CDL-004 cross the core, CDL-005 and CDL-006 sit in the outer halo and are mostly barren, so the set shows how mineralisation and alteration change across a system.

## Files

| File | Rows | Contents |
| --- | ---: | --- |
| `curated/drillholes.csv` | 6 | Collar position, azimuth, dip, final depth, drill date, contractor, drill type, core size |
| `curated/intervals.csv` | 53 | Core log intervals with lithology, alteration, mineralisation, weathering and structure |

All codes come from CoreChain's starter code library (`packages/domain/src/logging.ts`). The intervals in each hole are continuous from 0 m to the final depth, with no gaps or overlaps; the test in `apps/web/lib/demo/synthetic-porphyry.test.ts` checks this.

## Loading it

```
npm run sample:cordillera -- <account email>
```

Run it again and it replaces its own earlier copy. The core boxes, runs and samples are also made up (cut from the logged depths) and none of it is real assay, recovery or custody data.

## Size

About 6 KB in total, so it fits comfortably in the free tiers of GitHub, Neon and PowerSync.
