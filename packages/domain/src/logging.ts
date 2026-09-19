// Domain types and pure rules for core logging
// (docs/product/corechain-mobile-mvp-scrum-plan.md, Sprint 2: E4-1..E4-5).
//
// The starter code library below is PROVISIONAL: it is a generic hard-rock
// exploration set so a geologist can log with no admin setup. Which codes
// Philippine field teams actually use is an open item in the plan's risk log,
// and every code is editable per project (E4-2).

import {
  analyseContinuity,
  type CoreValidationResult,
  type DepthRange,
} from "./core";
import type { FieldValidationError, SyncableRecord } from "./field";

export const CODE_CATEGORIES = [
  "lithology",
  "alteration_type",
  "alteration_intensity",
  "mineral",
  "mineral_style",
  "weathering",
  "structure_type",
] as const;
export type CodeCategory = (typeof CODE_CATEGORIES)[number];

export const CODE_CATEGORY_LABELS: Record<CodeCategory, string> = {
  lithology: "Lithology",
  alteration_type: "Alteration type",
  alteration_intensity: "Alteration intensity",
  mineral: "Mineralisation: mineral",
  mineral_style: "Mineralisation: style",
  weathering: "Weathering",
  structure_type: "Structure type",
};

export type StarterCode = {
  category: CodeCategory;
  code: string;
  description: string;
};

function starter(
  category: CodeCategory,
  entries: readonly (readonly [string, string])[],
): StarterCode[] {
  return entries.map(([code, description]) => ({ category, code, description }));
}

export const STARTER_CODES: readonly StarterCode[] = [
  ...starter("lithology", [
    ["OVB", "Overburden / soil"],
    ["AND", "Andesite"],
    ["BAS", "Basalt"],
    ["DIO", "Diorite"],
    ["GRD", "Granodiorite"],
    ["PORP", "Porphyry"],
    ["TUF", "Tuff"],
    ["BX", "Breccia"],
    ["SST", "Sandstone"],
    ["SLT", "Siltstone"],
    ["SHL", "Shale"],
    ["LST", "Limestone"],
    ["QV", "Quartz vein"],
  ]),
  ...starter("alteration_type", [
    ["PROP", "Propylitic"],
    ["ARG", "Argillic"],
    ["ADV", "Advanced argillic"],
    ["PHY", "Phyllic (sericitic)"],
    ["POT", "Potassic"],
    ["SIL", "Silicic"],
    ["CHL", "Chlorite"],
    ["EPI", "Epidote"],
    ["CARB", "Carbonate"],
  ]),
  ...starter("alteration_intensity", [
    ["0", "None"],
    ["1", "Weak"],
    ["2", "Moderate"],
    ["3", "Strong"],
    ["4", "Pervasive / intense"],
  ]),
  ...starter("mineral", [
    ["PY", "Pyrite"],
    ["CPY", "Chalcopyrite"],
    ["BN", "Bornite"],
    ["CC", "Chalcocite"],
    ["MAG", "Magnetite"],
    ["SPH", "Sphalerite"],
    ["GAL", "Galena"],
    ["MOL", "Molybdenite"],
    ["AU", "Visible gold"],
  ]),
  ...starter("mineral_style", [
    ["DISS", "Disseminated"],
    ["VNL", "Veinlets"],
    ["STK", "Stockwork"],
    ["MASS", "Massive"],
    ["BXH", "Breccia-hosted"],
  ]),
  ...starter("weathering", [
    ["FR", "Fresh"],
    ["SW", "Slightly weathered"],
    ["MW", "Moderately weathered"],
    ["HW", "Highly weathered"],
    ["CW", "Completely weathered"],
  ]),
  ...starter("structure_type", [
    ["FLT", "Fault"],
    ["SHR", "Shear zone"],
    ["FRAC", "Fracture zone"],
    ["JNT", "Joint"],
    ["CONT", "Lithological contact"],
    ["VEIN", "Vein"],
    ["FOL", "Foliation"],
  ]),
];

export type LibraryCode = SyncableRecord & {
  projectId: string;
  category: CodeCategory;
  code: string;
  description: string;
  /** Hidden codes stay on existing intervals but drop out of new pick-lists. */
  hidden: boolean;
};

export type LibraryCodeInput = {
  category: CodeCategory;
  code: string;
  description: string;
};

const MAX_CODE_LENGTH = 12;

/** Validates a new code (E4-2). Codes are unique per category, ignoring case. */
export function validateCodeInput(
  input: LibraryCodeInput,
  existing: readonly Pick<LibraryCode, "category" | "code">[],
): CoreValidationResult {
  const errors: FieldValidationError[] = [];
  const code = input.code.trim();

  if (code.length === 0) {
    errors.push({ field: "code", message: "Enter a short code." });
  } else if (code.length > MAX_CODE_LENGTH) {
    errors.push({
      field: "code",
      message: `Keep the code to ${MAX_CODE_LENGTH} characters or fewer.`,
    });
  } else if (
    existing.some(
      (e) =>
        e.category === input.category &&
        e.code.toLowerCase() === code.toLowerCase(),
    )
  ) {
    errors.push({
      field: "code",
      message: `"${code}" already exists in ${CODE_CATEGORY_LABELS[input.category]}.`,
    });
  }

  return errors.length > 0
    ? { valid: false, errors, warnings: [] }
    : { valid: true, warnings: [] };
}

/** The codes offered in a pick-list: not hidden, sorted by code. */
export function visibleCodes<T extends Pick<LibraryCode, "category" | "code" | "hidden">>(
  codes: readonly T[],
  category: CodeCategory,
): T[] {
  return codes
    .filter((c) => c.category === category && !c.hidden)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

// --- Log intervals (E4-3) ---------------------------------------------------

export type IntervalCodes = {
  lithology: string | null;
  alterationType: string | null;
  alterationIntensity: string | null;
  mineral: string | null;
  mineralStyle: string | null;
  /** Estimated mineral content, 0-100 %. */
  mineralPercent: number | null;
  weathering: string | null;
  structureType: string | null;
};

export type LogInterval = SyncableRecord &
  IntervalCodes & {
    drillholeId: string;
    fromM: number;
    toM: number;
    /** Free text: structure notes and general comments. */
    notes: string | null;
  };

export type LogIntervalInput = Partial<IntervalCodes> & {
  fromM: number;
  toM: number;
  notes?: string | null;
};

/** Which interval field each code category fills in. */
export const CATEGORY_INTERVAL_FIELD: Record<CodeCategory, keyof IntervalCodes> = {
  lithology: "lithology",
  alteration_type: "alterationType",
  alteration_intensity: "alterationIntensity",
  mineral: "mineral",
  mineral_style: "mineralStyle",
  weathering: "weathering",
  structure_type: "structureType",
};

/** E4-3: a new interval starts where the deepest existing one ends. */
export function nextIntervalDefaults(
  existing: readonly Pick<DepthRange, "toM">[],
): { fromM: number } {
  return {
    fromM: existing.length === 0 ? 0 : Math.max(...existing.map((i) => i.toM)),
  };
}

/**
 * E4-3: validates an interval. Bad depths and an out-of-range mineral % are
 * errors; overlaps and gaps are warnings that need "Save anyway", like boxes
 * and runs.
 */
export function validateIntervalInput(
  input: LogIntervalInput,
  existing: readonly DepthRange[],
): CoreValidationResult {
  const errors: FieldValidationError[] = [];
  const warnings: string[] = [];

  if (!Number.isFinite(input.fromM) || input.fromM < 0) {
    errors.push({ field: "fromM", message: "From depth must be 0 m or more." });
  }
  if (!Number.isFinite(input.toM) || input.toM <= input.fromM) {
    errors.push({
      field: "toM",
      message: "To depth must be greater than from depth.",
    });
  }
  if (
    input.mineralPercent != null &&
    (!Number.isFinite(input.mineralPercent) ||
      input.mineralPercent < 0 ||
      input.mineralPercent > 100)
  ) {
    errors.push({
      field: "mineralPercent",
      message: "Mineral % must be between 0 and 100.",
    });
  }

  if (errors.length === 0) {
    const { gaps, overlaps } = analyseContinuity([
      ...existing,
      { fromM: input.fromM, toM: input.toM },
    ]);
    for (const overlap of overlaps) {
      if (overlap.fromM < input.toM && overlap.toM > input.fromM) {
        warnings.push(
          `Overlaps another interval at ${overlap.fromM}–${overlap.toM} m.`,
        );
      }
    }
    for (const gap of gaps) {
      if (gap.toM === input.fromM || gap.fromM === input.toM) {
        warnings.push(
          `Leaves a gap of ${gap.fromM}–${gap.toM} m next to this interval.`,
        );
      }
    }
  }

  return errors.length > 0
    ? { valid: false, errors, warnings }
    : { valid: true, warnings };
}

/**
 * E4-5: the codes to carry over from the previous interval. Everything except
 * from/to depth and free text, per the story.
 */
export function copyIntervalCodes(previous: IntervalCodes): IntervalCodes {
  return {
    lithology: previous.lithology,
    alterationType: previous.alterationType,
    alterationIntensity: previous.alterationIntensity,
    mineral: previous.mineral,
    mineralStyle: previous.mineralStyle,
    mineralPercent: previous.mineralPercent,
    weathering: previous.weathering,
    structureType: previous.structureType,
  };
}

/**
 * E4-2: whether a code is used by any interval, which stops it being deleted
 * (hiding it is always allowed). Compares ignoring case, since free text and
 * codes share the same fields.
 */
export function isCodeInUse(
  category: CodeCategory,
  code: string,
  intervals: readonly Partial<IntervalCodes>[],
): boolean {
  const field = CATEGORY_INTERVAL_FIELD[category];
  const wanted = code.trim().toLowerCase();
  return intervals.some((i) => {
    const value = i[field];
    return typeof value === "string" && value.trim().toLowerCase() === wanted;
  });
}

/**
 * Metres of hole covered by log intervals, counting overlapped stretches once,
 * so it can drive the "% logged" figure on the drillhole list (E2-4).
 */
export function loggedLengthM(ranges: readonly DepthRange[]): number {
  const sorted = ranges
    .filter((r) => r.toM > r.fromM)
    .sort((a, b) => a.fromM - b.fromM);
  let total = 0;
  let coveredTo = Number.NEGATIVE_INFINITY;
  for (const range of sorted) {
    const start = Math.max(range.fromM, coveredTo);
    if (range.toM > start) {
      total += range.toM - start;
    }
    coveredTo = Math.max(coveredTo, range.toM);
  }
  return Math.round(total * 1000) / 1000;
}

export type StripSegment = {
  kind: "logged" | "gap" | "overlap";
  fromM: number;
  toM: number;
};

/**
 * E4-4: the segments of the "continuity strip" — logged stretches, gaps and
 * overlaps in depth order — for drawing a bar of the hole.
 */
export function continuityStrip(
  ranges: readonly DepthRange[],
): StripSegment[] {
  const { gaps, overlaps } = analyseContinuity(ranges);
  const segments: StripSegment[] = [
    ...ranges
      .filter((r) => r.toM > r.fromM)
      .map((r) => ({ kind: "logged" as const, fromM: r.fromM, toM: r.toM })),
    ...gaps.map((g) => ({ kind: "gap" as const, ...g })),
    ...overlaps.map((o) => ({ kind: "overlap" as const, ...o })),
  ];
  // Overlaps draw on top of the logged segments they sit inside.
  const order = { logged: 0, gap: 1, overlap: 2 } as const;
  return segments.sort(
    (a, b) => order[a.kind] - order[b.kind] || a.fromM - b.fromM,
  );
}
