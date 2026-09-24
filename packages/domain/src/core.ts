// Domain types and pure rules for core boxes and drilling runs
// (docs/product/corechain-mobile-mvp-scrum-plan.md, Sprint 2: E3-1..E3-3).
//
// `analyseContinuity` is deliberately generic over depth ranges: E3-1 (boxes),
// E3-2 (runs) and E4-4 (log intervals) all need the same gap/overlap check, so
// it lives here once and is shared with the web app (E4-4's acceptance
// criteria).

import type { FieldValidationError, SyncableRecord } from "./field";

// Depths are measured in metres and entered by hand, so floating-point noise
// (e.g. 1.1 + 2.2 !== 3.3) must not show up as a phantom 0.0000001 m gap.
const DEPTH_TOLERANCE_M = 0.005;

export type DepthRange = { fromM: number; toM: number };

export type ContinuityReport = {
  /** Uncovered stretches between consecutive ranges. */
  gaps: DepthRange[];
  /** Stretches covered by more than one range. */
  overlaps: DepthRange[];
};

/**
 * Finds gaps and overlaps in a set of depth ranges.
 *
 * The first range's start is never a gap: a hole can legitimately start below
 * 0 m (casing, overburden) and this checks only what lies *between* records.
 * Ranges with a non-positive length are ignored here — reject those at input
 * time instead (see `validateBoxInput` / `validateRunInput`).
 */
export function analyseContinuity(ranges: readonly DepthRange[]): ContinuityReport {
  const sorted = ranges
    .filter((r) => r.toM > r.fromM)
    .map((r) => ({ fromM: r.fromM, toM: r.toM }))
    .sort((a, b) => a.fromM - b.fromM || a.toM - b.toM);

  const gaps: DepthRange[] = [];
  const overlaps: DepthRange[] = [];
  let coveredTo: number | null = null;

  for (const range of sorted) {
    if (coveredTo === null) {
      coveredTo = range.toM;
      continue;
    }
    if (range.fromM - coveredTo > DEPTH_TOLERANCE_M) {
      gaps.push({ fromM: coveredTo, toM: range.fromM });
    } else if (coveredTo - range.fromM > DEPTH_TOLERANCE_M) {
      overlaps.push({
        fromM: range.fromM,
        toM: Math.min(coveredTo, range.toM),
      });
    }
    coveredTo = Math.max(coveredTo, range.toM);
  }

  return { gaps, overlaps };
}

function roundTo1Decimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Length of a depth range, rounded to the millimetre to hide float noise. */
export function drilledLengthM(range: DepthRange): number {
  return Math.round((range.toM - range.fromM) * 1000) / 1000;
}

/**
 * Recovery % = recovered ÷ drilled length, rounded to 1 decimal (E3-2).
 * Returns null when there is no drilled length to divide by. Values above 100
 * are returned as-is: they are physically possible (core left over from the
 * previous run) and the run validator flags them for confirmation.
 */
export function recoveryPercent(
  drilledM: number,
  recoveredM: number,
): number | null {
  if (!(drilledM > 0) || recoveredM < 0) {
    return null;
  }
  return roundTo1Decimal((recoveredM / drilledM) * 100);
}

/**
 * RQD % = sum of core pieces ≥ 10 cm ÷ drilled length, rounded to 1 decimal
 * (E3-3). Uses the drilled length, as the story specifies, so a run with poor
 * recovery scores a low RQD even if every recovered piece is sound.
 */
export function rqdPercent(
  drilledM: number,
  piecesOver10cmM: number,
): number | null {
  if (!(drilledM > 0) || piecesOver10cmM < 0) {
    return null;
  }
  return roundTo1Decimal((piecesOver10cmM / drilledM) * 100);
}

// --- Core boxes (E3-1) -----------------------------------------------------

export type FieldCoreBox = SyncableRecord & {
  drillholeId: string;
  boxNumber: number;
  fromM: number;
  toM: number;
  note: string | null;
};

export type CoreBoxInput = {
  boxNumber: number;
  fromM: number;
  toM: number;
  note?: string | null;
};

export type CoreValidationResult =
  | { valid: true; warnings: string[] }
  | { valid: false; errors: FieldValidationError[]; warnings: string[] };

function isFiniteNumber(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function formatRange(range: DepthRange): string {
  return `${range.fromM}–${range.toM} m`;
}

/**
 * "Next box" defaults (E3-1): the box number after the highest existing one,
 * starting where the deepest existing box ends.
 */
export function nextBoxDefaults(
  existing: readonly Pick<FieldCoreBox, "boxNumber" | "toM">[],
): { boxNumber: number; fromM: number } {
  if (existing.length === 0) {
    return { boxNumber: 1, fromM: 0 };
  }
  return {
    boxNumber: Math.max(...existing.map((b) => b.boxNumber)) + 1,
    fromM: Math.max(...existing.map((b) => b.toM)),
  };
}

/**
 * Validates a new core box. Errors block saving; overlaps against the hole's
 * other boxes and gaps before this one are warnings, because a geologist may
 * be entering boxes out of order or deliberately recording a missing box.
 */
export function validateBoxInput(
  input: CoreBoxInput,
  existing: readonly Pick<FieldCoreBox, "boxNumber" | "fromM" | "toM">[],
): CoreValidationResult {
  const errors: FieldValidationError[] = [];
  const warnings: string[] = [];

  if (!Number.isInteger(input.boxNumber) || input.boxNumber < 1) {
    errors.push({
      field: "boxNumber",
      message: "Box number must be a whole number, 1 or higher.",
    });
  } else if (existing.some((b) => b.boxNumber === input.boxNumber)) {
    errors.push({
      field: "boxNumber",
      message: `Box ${input.boxNumber} already exists in this hole.`,
    });
  }

  if (!isFiniteNumber(input.fromM) || input.fromM < 0) {
    errors.push({ field: "fromM", message: "From depth must be 0 m or more." });
  }
  if (!isFiniteNumber(input.toM) || input.toM <= input.fromM) {
    errors.push({
      field: "toM",
      message: "To depth must be greater than from depth.",
    });
  }

  if (errors.length === 0) {
    const { gaps, overlaps } = analyseContinuity([
      ...existing,
      { fromM: input.fromM, toM: input.toM },
    ]);
    const mine = { fromM: input.fromM, toM: input.toM };
    for (const overlap of overlaps) {
      if (overlap.fromM < mine.toM && overlap.toM > mine.fromM) {
        warnings.push(`Overlaps another box at ${formatRange(overlap)}.`);
      }
    }
    for (const gap of gaps) {
      if (gap.toM === mine.fromM || gap.fromM === mine.toM) {
        warnings.push(`Leaves a gap of ${formatRange(gap)} next to this box.`);
      }
    }
  }

  return errors.length > 0
    ? { valid: false, errors, warnings }
    : { valid: true, warnings };
}

// --- Core runs (E3-2, E3-3) -------------------------------------------------

export type FieldCoreRun = SyncableRecord & {
  drillholeId: string;
  fromM: number;
  toM: number;
  /** Length of core actually recovered from this run. */
  recoveredM: number;
  /** Total length of recovered pieces ≥ 10 cm, for RQD. Null until entered. */
  rqdPiecesM: number | null;
};

export type CoreRunInput = {
  fromM: number;
  toM: number;
  recoveredM: number;
  rqdPiecesM?: number | null;
};

/** "Next run" default (E3-2): start where the deepest existing run ends. */
export function nextRunDefaults(
  existing: readonly Pick<FieldCoreRun, "toM">[],
): { fromM: number } {
  return {
    fromM: existing.length === 0 ? 0 : Math.max(...existing.map((r) => r.toM)),
  };
}

/**
 * Validates a new run. A recovered length greater than the drilled length is
 * a *warning*, not an error (E3-2: "flagged, not silently accepted"): it is
 * physically possible, so the geologist confirms it rather than being blocked.
 * RQD pieces longer than the recovered core are an error — they cannot exist.
 * A run ending past the hole's recorded final depth is a warning: either the
 * run's depth block or the final depth is wrong, and only the geologist knows
 * which.
 */
export function validateRunInput(
  input: CoreRunInput,
  existing: readonly Pick<FieldCoreRun, "fromM" | "toM">[],
  hole: { actualFinalDepthM: number | null } = { actualFinalDepthM: null },
): CoreValidationResult {
  const errors: FieldValidationError[] = [];
  const warnings: string[] = [];

  if (!isFiniteNumber(input.fromM) || input.fromM < 0) {
    errors.push({ field: "fromM", message: "From depth must be 0 m or more." });
  }
  if (!isFiniteNumber(input.toM) || input.toM <= input.fromM) {
    errors.push({
      field: "toM",
      message: "To depth must be greater than from depth.",
    });
  }
  if (!isFiniteNumber(input.recoveredM) || input.recoveredM < 0) {
    errors.push({
      field: "recoveredM",
      message: "Recovered length must be 0 m or more.",
    });
  }

  const hasRqd = input.rqdPiecesM != null;
  if (hasRqd) {
    if (!isFiniteNumber(input.rqdPiecesM as number) || (input.rqdPiecesM as number) < 0) {
      errors.push({
        field: "rqdPiecesM",
        message: "Pieces ≥ 10 cm must be 0 m or more.",
      });
    } else if (
      isFiniteNumber(input.recoveredM) &&
      (input.rqdPiecesM as number) > input.recoveredM + DEPTH_TOLERANCE_M
    ) {
      errors.push({
        field: "rqdPiecesM",
        message: "Pieces ≥ 10 cm can't be longer than the recovered core.",
      });
    }
  }

  if (errors.length === 0) {
    const drilled = input.toM - input.fromM;
    if (input.recoveredM > drilled + DEPTH_TOLERANCE_M) {
      warnings.push(
        `Recovered ${input.recoveredM} m is more than the ${roundTo1Decimal(drilled)} m drilled. Check the entry before saving.`,
      );
    }

    const warning = runPastFinalDepthWarning(input, hole.actualFinalDepthM);
    if (warning) warnings.push(warning);

    const { gaps, overlaps } = analyseContinuity([
      ...existing,
      { fromM: input.fromM, toM: input.toM },
    ]);
    for (const overlap of overlaps) {
      if (overlap.fromM < input.toM && overlap.toM > input.fromM) {
        warnings.push(`Overlaps another run at ${formatRange(overlap)}.`);
      }
    }
    for (const gap of gaps) {
      if (gap.toM === input.fromM || gap.fromM === input.toM) {
        warnings.push(`Leaves a gap of ${formatRange(gap)} next to this run.`);
      }
    }
  }

  return errors.length > 0
    ? { valid: false, errors, warnings }
    : { valid: true, warnings };
}

/**
 * The warning, if any, for a run that ends deeper than the hole's recorded
 * final depth. No final depth recorded yet: no warning.
 */
export function runPastFinalDepthWarning(
  run: Pick<DepthRange, "toM">,
  actualFinalDepthM: number | null,
): string | null {
  if (actualFinalDepthM == null || !isFiniteNumber(actualFinalDepthM)) return null;
  if (run.toM <= actualFinalDepthM + DEPTH_TOLERANCE_M) return null;
  return `Ends at ${run.toM} m, past the hole's final depth of ${actualFinalDepthM} m. Check the depth block, or correct the final depth.`;
}

/**
 * The deepest depth recorded by any run, box or log interval — the figure
 * `actualDepthWarning` (E2-2) compares an entered final depth against.
 */
export function deepestRecordedDepthM(
  ranges: readonly Pick<DepthRange, "toM">[],
): number {
  return ranges.length === 0 ? 0 : Math.max(...ranges.map((r) => r.toM));
}
