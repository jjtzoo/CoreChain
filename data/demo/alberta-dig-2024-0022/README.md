# Alberta drillhole demo data

## Purpose

This is a **practice import dataset** for CoreChain. It gives the early app real public drillhole, geological interval, and assay relationships while we wait for permission to use a Philippine pilot dataset.

It is not a Philippine project, and it must never be used for technical, operational, investment, or resource-estimation decisions.

## Source and attribution

Source publication:

> Meek, D.M., Lopez, G.P. (2024): *Drillhole data extracted from selected Alberta mineral assessment reports (tabular data, tab-delimited format)*; Alberta Energy Regulator / Alberta Geological Survey, AER/AGS Digital Data 2024-0022.

- Publication page: https://ags.aer.ca/publications/all-publications/dig-2024-0022
- Download used: `DIG_2024_0022_0.zip`
- Licence: Open Government Licence – Alberta. Attribution to the Alberta Energy Regulator / Alberta Geological Survey is required.

The source compiles data from historic mineral assessment reports. The publisher warns that the data were captured “as is” and may contain original-report, transcription, or unit-conversion errors. Consult original reports for any technical use.

## Folders

| Folder | Contents | Treatment |
| --- | --- | --- |
| `source/` | The original downloaded ZIP file | Preserve unchanged as the traceable source copy. |
| `raw/` | The source files extracted from the ZIP, including metadata | Preserve unchanged locally. They are not committed because the source assay export exceeds GitHub's file-size limit; restore them by extracting the preserved ZIP. |
| `curated/` | A deliberately small CSV subset for early app development | Safe to import, reset, or replace during development. |

## Curated subset

The current subset comes from source group `MAR_20020002` and contains six diamond-drill holes:

- `200110-128`
- `200110-129`
- `200110-133`
- `200134-001`
- `200134-006`
- `200134-008`

| File | Rows | What it represents |
| --- | ---: | --- |
| `curated/drillholes.csv` | 6 | Drillhole collar and summary information |
| `curated/intervals.csv` | 27 | Geological descriptions over downhole intervals |
| `curated/assays.csv` | 313 | Laboratory analytical records over sampled intervals |

## Important limitations for CoreChain

This public dataset does **not** provide CoreChain-specific operating records such as:

- Project setup and user roles
- Core boxes or photos
- Sample-custody events
- Dispatch records
- Complete field QA/QC decisions and approvals

When those parts are needed for the app demonstration, we will create them as separate **synthetic demo records**, clearly labelled as synthetic and never represented as source data.

## Import rule

Keep imported source values intact. Fields such as `-9999` may represent a source-system missing-value marker; CoreChain will map those to a visible missing value during import, while retaining the original source record for traceability.
