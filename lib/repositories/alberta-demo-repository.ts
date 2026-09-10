import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type {
  AlbertaDemoDataset,
  AssayRecord,
  Drillhole,
  GeologicalInterval,
  SourceProvenance,
} from "@/lib/domain/corechain";
import { parseCsv, type CsvRow } from "@/lib/import/csv";

const missingSourceValues = new Set(["", "-9999"]);

const drillholeRowSchema = z.object({
  AGS_ID: z.string().min(1),
  Data_src: z.string().min(1),
  DH_name: z.string().min(1),
  Long_NAD83: z.string(),
  Lat_NAD83: z.string(),
  E_10TM83: z.string(),
  N_10TM83: z.string(),
  Elvtn_grnd: z.string(),
  Drill_date: z.string(),
  Azimuth: z.string(),
  Inclnation: z.string(),
  Contractor: z.string(),
  Drill_type: z.string(),
  DH_diam: z.string(),
  Total_dpth: z.string(),
  DH_note: z.string(),
});

const intervalRowSchema = z.object({
  AGS_ID: z.string().min(1),
  Data_src: z.string().min(1),
  DH_name: z.string().min(1),
  Intrvl_top: z.string(),
  Intrvl_btm: z.string(),
  Material: z.string(),
  Rock_type: z.string(),
  Litho_unit: z.string(),
  Strat_unit: z.string(),
  Intrvl_dsc: z.string(),
});

const assayRowSchema = z.object({
  AGS_ID: z.string().min(1),
  Data_src: z.string().min(1),
  DH_name: z.string().min(1),
  Sample_nme: z.string(),
  Smpl_int_t: z.string(),
  Smpl_int_b: z.string(),
  Cert_date: z.string(),
  Sample_dt: z.string(),
  Lab_name: z.string(),
  Prep_code: z.string(),
  Methd_code: z.string(),
  L_dtct_lim: z.string(),
  QAQC_desc: z.string(),
});

function sourceValue(value: string): string | null {
  const trimmed = value.trim();
  return missingSourceValues.has(trimmed) ? null : trimmed;
}

function numberValue(value: string, fieldName: string, sourceId: string) {
  const normalized = sourceValue(value);
  if (normalized === null) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Source record ${sourceId} has an invalid numeric ${fieldName}: ${normalized}.`,
    );
  }

  return parsed;
}

function sourceProvenance(raw: CsvRow, sourceTable: string): SourceProvenance {
  return {
    sourceTable,
    sourceId: raw.AGS_ID,
    sourceGroup: raw.Data_src,
    raw: Object.freeze({ ...raw }),
  };
}

function mapDrillhole(raw: CsvRow): Drillhole {
  const row = drillholeRowSchema.parse(raw);

  return {
    id: `ags-drillhole-${row.AGS_ID}`,
    name: row.DH_name,
    drillType: sourceValue(row.Drill_type),
    drillDate: sourceValue(row.Drill_date),
    finalDepthM: numberValue(row.Total_dpth, "total depth", row.AGS_ID),
    reportedAzimuthDeg: numberValue(row.Azimuth, "azimuth", row.AGS_ID),
    reportedInclinationDeg: numberValue(
      row.Inclnation,
      "inclination",
      row.AGS_ID,
    ),
    location: {
      longitude: numberValue(row.Long_NAD83, "longitude", row.AGS_ID),
      latitude: numberValue(row.Lat_NAD83, "latitude", row.AGS_ID),
      easting: numberValue(row.E_10TM83, "easting", row.AGS_ID),
      northing: numberValue(row.N_10TM83, "northing", row.AGS_ID),
      groundElevationM: numberValue(
        row.Elvtn_grnd,
        "ground elevation",
        row.AGS_ID,
      ),
      coordinateReferenceSystem: "NAD83 / 10TM",
    },
    contractor: sourceValue(row.Contractor),
    diameter: sourceValue(row.DH_diam),
    note: sourceValue(row.DH_note),
    provenance: sourceProvenance(raw, "Drillhole_Details"),
  };
}

function mapInterval(raw: CsvRow): GeologicalInterval {
  const row = intervalRowSchema.parse(raw);
  const fromM = numberValue(row.Intrvl_top, "interval top", row.AGS_ID);
  const toM = numberValue(row.Intrvl_btm, "interval bottom", row.AGS_ID);

  if (fromM === null || toM === null || fromM < 0 || toM <= fromM) {
    throw new Error(
      `Source interval ${row.AGS_ID} has an invalid depth range.`,
    );
  }

  return {
    id: `ags-interval-${row.AGS_ID}`,
    drillholeName: row.DH_name,
    fromM,
    toM,
    material: sourceValue(row.Material),
    rockType: sourceValue(row.Rock_type),
    lithologicalUnit: sourceValue(row.Litho_unit),
    stratigraphicUnit: sourceValue(row.Strat_unit),
    description: sourceValue(row.Intrvl_dsc),
    provenance: sourceProvenance(raw, "Drillhole_Interval_Data"),
  };
}

function mapAssay(raw: CsvRow): AssayRecord {
  const row = assayRowSchema.parse(raw);
  const fromM = numberValue(row.Smpl_int_t, "sample interval top", row.AGS_ID);
  const toM = numberValue(row.Smpl_int_b, "sample interval bottom", row.AGS_ID);

  if (
    (fromM === null) !== (toM === null) ||
    (fromM !== null && toM !== null && (fromM < 0 || toM <= fromM))
  ) {
    throw new Error(
      `Source assay ${row.AGS_ID} has an invalid sample depth range.`,
    );
  }

  return {
    id: `ags-assay-${row.AGS_ID}`,
    drillholeName: row.DH_name,
    sampleId: sourceValue(row.Sample_nme),
    fromM,
    toM,
    certificateDate: sourceValue(row.Cert_date),
    sampleDate: sourceValue(row.Sample_dt),
    laboratory: sourceValue(row.Lab_name),
    preparationCode: sourceValue(row.Prep_code),
    methodCode: sourceValue(row.Methd_code),
    detectionLimit: sourceValue(row.L_dtct_lim),
    qaqcDescription: sourceValue(row.QAQC_desc),
    provenance: sourceProvenance(raw, "Drillhole_Assay_Data"),
  };
}

export function buildAlbertaDemoDataset(input: {
  drillholesCsv: string;
  intervalsCsv: string;
  assaysCsv: string;
}): AlbertaDemoDataset {
  const drillholes = parseCsv(input.drillholesCsv).map(mapDrillhole);
  const intervals = parseCsv(input.intervalsCsv).map(mapInterval);
  const assays = parseCsv(input.assaysCsv).map(mapAssay);
  const drillholeNames = new Set(drillholes.map((drillhole) => drillhole.name));
  const orphanIntervalCount = intervals.filter(
    (interval) => !drillholeNames.has(interval.drillholeName),
  ).length;
  const orphanAssayCount = assays.filter(
    (assay) => !drillholeNames.has(assay.drillholeName),
  ).length;

  if (orphanIntervalCount > 0 || orphanAssayCount > 0) {
    throw new Error(
      `Source integrity check failed: ${orphanIntervalCount} orphan intervals and ${orphanAssayCount} orphan assays.`,
    );
  }

  return {
    drillholes,
    intervals,
    assays,
    integrity: {
      drillholeCount: drillholes.length,
      intervalCount: intervals.length,
      assayCount: assays.length,
      orphanIntervalCount,
      orphanAssayCount,
    },
  };
}

export async function getAlbertaDemoDataset(): Promise<AlbertaDemoDataset> {
  const dataDirectory = path.join(
    process.cwd(),
    "data",
    "demo",
    "alberta-dig-2024-0022",
    "curated",
  );
  const [drillholesCsv, intervalsCsv, assaysCsv] = await Promise.all([
    readFile(path.join(dataDirectory, "drillholes.csv"), "utf8"),
    readFile(path.join(dataDirectory, "intervals.csv"), "utf8"),
    readFile(path.join(dataDirectory, "assays.csv"), "utf8"),
  ]);

  return buildAlbertaDemoDataset({ drillholesCsv, intervalsCsv, assaysCsv });
}
