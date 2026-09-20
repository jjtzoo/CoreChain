// CSV export of a project's field data
// (docs/product/corechain-mobile-mvp-scrum-plan.md, Sprint 3: E9-1).
//
// One file per table, with stable column names. Hole ID and from/to columns use
// HOLEID / FROM / TO, the names most drillhole importers expect. (Not yet
// tried in Leapfrog or GEOVIA themselves.) Dispatches are not exported yet: they arrive with the custody
// stories (E7).

import type { FieldCoreRun } from "./core";
import type { FieldDrillhole, Project } from "./field";
import type { LogInterval } from "./logging";
import { recoveryPercent, rqdPercent, drilledLengthM } from "./core";
import type { FieldSample } from "./sampling";

export type CsvValue = string | number | null | undefined;

/**
 * Escapes one CSV field (RFC 4180): a field with a comma, quote or line break
 * is wrapped in quotes, and quotes inside it are doubled. Null and undefined
 * are empty fields.
 */
export function csvEscape(value: CsvValue): string {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Builds a CSV document: a header row then one row per record, CRLF-separated. */
export function toCsv(
  columns: readonly string[],
  rows: readonly (readonly CsvValue[])[],
): string {
  return [columns, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n")
    .concat("\r\n");
}

export const EXPORT_TABLES = [
  "collars",
  "surveys",
  "log",
  "runs",
  "samples",
] as const;
export type ExportTableName = (typeof EXPORT_TABLES)[number];

export type ExportTable = {
  name: ExportTableName;
  /** Human label for the export screen. */
  label: string;
  filename: string;
  csv: string;
  rowCount: number;
};

export type ExportData = {
  project: Pick<Project, "name" | "coordinateSystem">;
  drillholes: readonly FieldDrillhole[];
  runs: readonly FieldCoreRun[];
  intervals: readonly LogInterval[];
  samples: readonly FieldSample[];
};

/** A filesystem-safe, lowercase slug of the project name. */
export function exportSlug(projectName: string): string {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "project";
}

const byHoleThenDepth = <T extends { drillholeId: string; fromM: number | null }>(
  holeName: ReadonlyMap<string, string>,
) =>
  (a: T, b: T) =>
    (holeName.get(a.drillholeId) ?? "").localeCompare(
      holeName.get(b.drillholeId) ?? "",
      undefined,
      { numeric: true },
    ) || (a.fromM ?? 0) - (b.fromM ?? 0);

/**
 * Builds every export table for a project. Pure, so the column names and
 * row shapes are unit-tested rather than discovered in Excel.
 *
 * A collar's coordinates are labelled WGS84 when they came from the phone's
 * GPS; a manually typed collar takes the project's coordinate system.
 */
export function buildExportTables(data: ExportData): ExportTable[] {
  const slug = exportSlug(data.project.name);
  const holes = [...data.drillholes].sort((a, b) =>
    a.holeId.localeCompare(b.holeId, undefined, { numeric: true }),
  );
  const holeName = new Map(holes.map((h) => [h.id, h.holeId]));
  const name = (id: string) => holeName.get(id) ?? "";
  const sortRows = byHoleThenDepth(holeName);

  const make = (
    tableName: ExportTableName,
    label: string,
    columns: readonly string[],
    rows: readonly (readonly CsvValue[])[],
  ): ExportTable => ({
    name: tableName,
    label,
    filename: `${slug}-${tableName}.csv`,
    csv: toCsv(columns, rows),
    rowCount: rows.length,
  });

  const collars = make(
    "collars",
    "Collars",
    [
      "HOLEID",
      "LONGITUDE",
      "LATITUDE",
      "COORDINATE_SYSTEM",
      "COLLAR_SOURCE",
      "ACCURACY_M",
      "PLANNED_DEPTH",
      "FINAL_DEPTH",
      "STATUS",
      "STARTED",
      "COMPLETED",
    ],
    holes.map((h) => [
      h.holeId,
      h.collar?.longitude,
      h.collar?.latitude,
      h.collar
        ? h.collar.source === "gps"
          ? "WGS84"
          : data.project.coordinateSystem
        : null,
      h.collar?.source,
      h.collar?.accuracyM,
      h.plannedDepthM,
      h.actualFinalDepthM,
      h.status,
      h.startedAt,
      h.completedAt,
    ]),
  );

  // Only the planned azimuth/dip is recorded, so each hole gets a single
  // survey station at depth 0 (no downhole surveys yet).
  const surveys = make(
    "surveys",
    "Surveys (planned)",
    ["HOLEID", "DEPTH", "AZIMUTH", "DIP"],
    holes
      .filter((h) => h.plannedAzimuthDeg != null || h.plannedInclinationDeg != null)
      .map((h) => [h.holeId, 0, h.plannedAzimuthDeg, h.plannedInclinationDeg]),
  );

  const log = make(
    "log",
    "Lithology log",
    [
      "HOLEID",
      "FROM",
      "TO",
      "LITHOLOGY",
      "ALTERATION_TYPE",
      "ALTERATION_INTENSITY",
      "MINERAL",
      "MINERAL_STYLE",
      "MINERAL_PERCENT",
      "WEATHERING",
      "STRUCTURE_TYPE",
      "NOTES",
    ],
    [...data.intervals].sort(sortRows).map((i) => [
      name(i.drillholeId),
      i.fromM,
      i.toM,
      i.lithology,
      i.alterationType,
      i.alterationIntensity,
      i.mineral,
      i.mineralStyle,
      i.mineralPercent,
      i.weathering,
      i.structureType,
      i.notes,
    ]),
  );

  const runs = make(
    "runs",
    "Core runs",
    [
      "HOLEID",
      "FROM",
      "TO",
      "DRILLED_M",
      "RECOVERED_M",
      "RECOVERY_PCT",
      "RQD_PIECES_M",
      "RQD_PCT",
    ],
    [...data.runs].sort(sortRows).map((r) => {
      const drilled = drilledLengthM(r);
      return [
        name(r.drillholeId),
        r.fromM,
        r.toM,
        drilled,
        r.recoveredM,
        recoveryPercent(drilled, r.recoveredM),
        r.rqdPiecesM,
        r.rqdPiecesM != null ? rqdPercent(drilled, r.rqdPiecesM) : null,
      ];
    }),
  );

  const numberById = new Map(data.samples.map((s) => [s.id, s.sampleNumber]));
  const samples = make(
    "samples",
    "Samples",
    [
      "SAMPLE_ID",
      "HOLEID",
      "FROM",
      "TO",
      "SAMPLE_TYPE",
      "QC",
      "STANDARD_REF",
      "PARENT_SAMPLE_ID",
      "STATUS",
      "NOTES",
    ],
    [...data.samples]
      .sort(
        (a, b) =>
          name(a.drillholeId).localeCompare(name(b.drillholeId), undefined, {
            numeric: true,
          }) ||
          a.sampleNumber.localeCompare(b.sampleNumber, undefined, {
            numeric: true,
          }),
      )
      .map((s) => [
        s.sampleNumber,
        name(s.drillholeId),
        s.fromM,
        s.toM,
        s.type,
        s.type === "primary" ? "N" : "Y",
        s.standardRef,
        s.parentSampleId ? numberById.get(s.parentSampleId) : null,
        s.status,
        s.note,
      ]),
  );

  return [collars, surveys, log, runs, samples];
}
