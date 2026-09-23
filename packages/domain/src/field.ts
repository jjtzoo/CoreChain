// Domain types and pure validation rules for CoreChain's mobile field workflow
// (docs/product/corechain-mobile-mvp-scrum-plan.md, Sprint 1: E1, E2).
//
// These are distinct from the AGS-import types in index.ts (Drillhole, Sample,
// CustodyEvent, etc.), which model the Phase 1 web demo's *imported source*
// dataset shape. These types model records a field geologist *creates on
// their device*, so a colliding name (e.g. Drillhole) is prefixed `Field`
// instead of reused — the two are never mixed in the same record.
//
// Every record carries the sync-ready fields decision D6/D7/D8 require:
// a client-generated id, updatedAt, version, and a soft-delete deletedAt,
// even though sync (Sprint 4/5) isn't wired up yet.

export type SyncableRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  deletedAt: string | null;
};

// Provisional list for the pilot. Confirm which systems testers actually use
// before Sprint 2 (see the plan doc's risk log) — this is not authoritative.
export const COORDINATE_SYSTEMS = [
  "WGS84",
  "PRS92",
  "UTM Zone 50N",
  "UTM Zone 51N",
] as const;
export type CoordinateSystem = (typeof COORDINATE_SYSTEMS)[number];

export type Project = SyncableRecord & {
  name: string;
  commodity: string | null;
  location: string | null;
  coordinateSystem: CoordinateSystem;
  samplePrefix: string;
  nextSampleNumber: number;
  qcInsertionRate: {
    standardEveryN: number;
    blankEveryN: number;
    duplicateEveryN: number;
  };
  /** Largest size a saved photo may be, in megabytes (E5-1). */
  photoMaxMb: number;
};

export type ProjectInput = {
  name: string;
  commodity?: string | null;
  location?: string | null;
  coordinateSystem: CoordinateSystem;
  samplePrefix?: string;
  nextSampleNumber?: number;
  qcInsertionRate?: Partial<Project["qcInsertionRate"]>;
};

export const DRILLHOLE_STATUSES = [
  "planned",
  "drilling",
  "complete",
  "logged",
] as const;
export type DrillholeStatus = (typeof DRILLHOLE_STATUSES)[number];

// E11-2: a resident / project manager can flag a hole as needing urgent
// attention (a sample, a check, whatever the note says) from the team
// overview on the web. Set only by a manager, never by the phone; the phone
// only shows it, since the geologist's own logging never depends on it.
export const DRILLHOLE_PRIORITIES = ["normal", "urgent"] as const;
export type DrillholePriority = (typeof DRILLHOLE_PRIORITIES)[number];

export type Collar = {
  source: "gps" | "manual";
  latitude: number;
  longitude: number;
  /** Meters. null when manually entered without a device accuracy reading. */
  accuracyM: number | null;
  capturedAt: string;
};

export type FieldDrillhole = SyncableRecord & {
  projectId: string;
  holeId: string;
  collar: Collar | null;
  plannedAzimuthDeg: number | null;
  plannedInclinationDeg: number | null;
  plannedDepthM: number;
  actualFinalDepthM: number | null;
  startedAt: string | null;
  completedAt: string | null;
  status: DrillholeStatus;
  contractor: string | null;
  drillType: string | null;
  diameter: string | null;
  note: string | null;
  priority: DrillholePriority;
  priorityNote: string | null;
};

export type FieldDrillholeInput = {
  holeId: string;
  collar?: Collar | null;
  plannedAzimuthDeg?: number | null;
  plannedInclinationDeg?: number | null;
  plannedDepthM: number;
  contractor?: string | null;
  drillType?: string | null;
  diameter?: string | null;
  note?: string | null;
};

export type StatusChange = {
  id: string;
  drillholeId: string;
  status: DrillholeStatus;
  changedAt: string;
};

export type FieldValidationError = { field: string; message: string };
export type FieldValidationResult =
  | { valid: true; errors: [] }
  | { valid: false; errors: FieldValidationError[] };

function ok(): FieldValidationResult {
  return { valid: true, errors: [] };
}

function fail(errors: FieldValidationError[]): FieldValidationResult {
  return { valid: false, errors };
}

export function isValidAzimuthDeg(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 360;
}

export function isValidInclinationDeg(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

/**
 * E1-1: name and coordinate system are required; everything else is optional.
 */
export function validateProjectInput(
  input: ProjectInput,
): FieldValidationResult {
  const errors: FieldValidationError[] = [];

  if (input.name.trim().length === 0) {
    errors.push({ field: "name", message: "Project name is required." });
  }

  if (!COORDINATE_SYSTEMS.includes(input.coordinateSystem)) {
    errors.push({
      field: "coordinateSystem",
      message: "Choose a coordinate system.",
    });
  }

  if (
    input.nextSampleNumber !== undefined &&
    (!Number.isInteger(input.nextSampleNumber) || input.nextSampleNumber < 1)
  ) {
    errors.push({
      field: "nextSampleNumber",
      message: "Next sample number must be a positive whole number.",
    });
  }

  return errors.length === 0 ? ok() : fail(errors);
}

/**
 * E2-1: hole ID is required and must be unique within the project (checked
 * against the caller's own list of existing IDs — this function does not
 * touch storage). Planned depth must be positive. Azimuth/inclination are
 * optional but must be in-range when given.
 */
export function validateDrillholeInput(
  input: FieldDrillholeInput,
  existingHoleIds: readonly string[],
): FieldValidationResult {
  const errors: FieldValidationError[] = [];
  const trimmedHoleId = input.holeId.trim();

  if (trimmedHoleId.length === 0) {
    errors.push({ field: "holeId", message: "Hole ID is required." });
  } else if (
    existingHoleIds.some(
      (id) => id.trim().toLowerCase() === trimmedHoleId.toLowerCase(),
    )
  ) {
    errors.push({
      field: "holeId",
      message: `A hole named "${trimmedHoleId}" already exists in this project.`,
    });
  }

  if (!Number.isFinite(input.plannedDepthM) || input.plannedDepthM <= 0) {
    errors.push({
      field: "plannedDepthM",
      message: "Planned depth must be greater than 0.",
    });
  }

  if (
    input.plannedAzimuthDeg != null &&
    !isValidAzimuthDeg(input.plannedAzimuthDeg)
  ) {
    errors.push({
      field: "plannedAzimuthDeg",
      message: "Azimuth must be between 0 and 360 degrees.",
    });
  }

  if (
    input.plannedInclinationDeg != null &&
    !isValidInclinationDeg(input.plannedInclinationDeg)
  ) {
    errors.push({
      field: "plannedInclinationDeg",
      message: "Inclination (dip) must be between -90 and 90 degrees.",
    });
  }

  return errors.length === 0 ? ok() : fail(errors);
}

/**
 * E2-2: the app warns rather than blocks when the actual final depth comes
 * in shallower than the deepest depth already recorded against the hole
 * (from boxes/runs/intervals in later sprints — Sprint 1 has no such records
 * yet, so callers pass 0 until E3 lands).
 */
export function actualDepthWarning(
  actualFinalDepthM: number,
  deepestRecordedDepthM: number,
): string | null {
  if (actualFinalDepthM < deepestRecordedDepthM) {
    return `Actual final depth (${actualFinalDepthM}m) is shallower than the deepest depth already recorded (${deepestRecordedDepthM}m).`;
  }
  return null;
}

/**
 * E2-4: logging progress for the drillhole list, as logged metres over the
 * best available reference depth (actual final depth once recorded,
 * otherwise the planned depth). Returns 0 for a hole with no depth at all.
 */
export function loggingProgress(
  loggedMetres: number,
  drillhole: Pick<FieldDrillhole, "actualFinalDepthM" | "plannedDepthM">,
): number {
  const referenceDepthM =
    drillhole.actualFinalDepthM ?? drillhole.plannedDepthM;
  if (!Number.isFinite(referenceDepthM) || referenceDepthM <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, loggedMetres / referenceDepthM));
}

/**
 * E2-3 (redesigned): a hole's status, computed from what's actually been
 * recorded rather than picked from a chip. "Logged" once every metre of the
 * reference depth is covered; otherwise "complete" once the geologist has
 * saved actual dates or a final depth for the hole; otherwise "drilling" once
 * any box, run or interval exists; otherwise "planned".
 */
export function deriveDrillholeStatus(
  drillhole: Pick<FieldDrillhole, "completedAt" | "actualFinalDepthM">,
  hasCoreRecorded: boolean,
  loggingProgressFraction: number,
): DrillholeStatus {
  if (loggingProgressFraction >= 1) {
    return "logged";
  }
  if (drillhole.completedAt != null || drillhole.actualFinalDepthM != null) {
    return "complete";
  }
  return hasCoreRecorded ? "drilling" : "planned";
}

/**
 * E2-4: case-insensitive substring search across a hole's own ID, so typing
 * part of a name finds it regardless of how it was capitalized when created.
 */
export function matchesDrillholeSearch(
  drillhole: Pick<FieldDrillhole, "holeId">,
  query: string,
): boolean {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) {
    return true;
  }
  return drillhole.holeId.toLowerCase().includes(trimmed);
}
