// Domain types and pure rules for field sampling
// (docs/product/corechain-mobile-mvp-scrum-plan.md, Sprint 3: E6-1..E6-3).
//
// The provisional sample-number format and the QC-reminder mechanics live here
// so they can be unit-tested away from the database and the UI.

import type { CoreValidationResult } from "./core";
import type { FieldValidationError, SyncableRecord } from "./field";

// Depths are typed by hand, so tiny float noise must not read as an overlap.
const DEPTH_TOLERANCE_M = 0.005;

export const SAMPLE_TYPES = ["primary", "standard", "blank", "duplicate"] as const;
export type SampleType = (typeof SAMPLE_TYPES)[number];

/** The QC control types (everything except primary samples). */
export const CONTROL_TYPES = ["standard", "blank", "duplicate"] as const;
export type ControlType = (typeof CONTROL_TYPES)[number];

// Only "created" is reachable in Sprint 3; bagging and dispatch arrive with
// the custody stories (E7) and move a sample along this list.
export const SAMPLE_STATUSES = ["created", "bagged", "dispatched"] as const;
export type SampleStatus = (typeof SAMPLE_STATUSES)[number];

// Named FieldSample because index.ts already exports a web-demo `Sample`.
export type FieldSample = SyncableRecord & {
  projectId: string;
  drillholeId: string;
  sampleNumber: string;
  type: SampleType;
  /** Null for standards and blanks, which have no depth of their own. */
  fromM: number | null;
  toM: number | null;
  /** Reference material ID, recorded for standards. */
  standardRef: string | null;
  /** The primary sample a field duplicate was taken alongside. */
  parentSampleId: string | null;
  note: string | null;
  status: SampleStatus;
};

export type FieldSampleInput = {
  sampleNumber: string;
  type: SampleType;
  fromM?: number | null;
  toM?: number | null;
  standardRef?: string | null;
  parentSampleId?: string | null;
  note?: string | null;
};

/**
 * Provisional format for a device-issued sample number, e.g. CC-00001. Which
 * format field teams' tag books actually use is to be confirmed with testers.
 */
export function formatSampleNumber(prefix: string, n: number): string {
  return `${prefix.trim()}-${String(n).padStart(5, "0")}`;
}

export type SampleValidationContext = {
  /** Actual final depth if recorded, otherwise the planned depth. */
  holeDepthM: number;
  /** Every sample number already used in the project, including voided ones. */
  existingNumbers: readonly string[];
  /** The hole's current samples, for overlap and duplicate-parent checks. */
  holeSamples: readonly Pick<FieldSample, "id" | "type" | "fromM" | "toM">[];
};

/**
 * Validates a new sample (E6-1, E6-2). Errors block saving.
 *
 * A primary sample must lie inside the hole and may not overlap another
 * primary sample (touching end to end is fine). A standard needs its reference
 * material ID. A duplicate must name the primary sample it duplicates. Blanks
 * and standards have no depth, so depth rules apply to primaries only.
 */
export function validateSampleInput(
  input: FieldSampleInput,
  context: SampleValidationContext,
): CoreValidationResult {
  const errors: FieldValidationError[] = [];
  const number = input.sampleNumber.trim();

  if (number.length === 0) {
    errors.push({ field: "sampleNumber", message: "Enter a sample number." });
  } else if (
    context.existingNumbers.some((n) => n.toLowerCase() === number.toLowerCase())
  ) {
    errors.push({
      field: "sampleNumber",
      message: `${number} is already used in this project.`,
    });
  }

  if (input.type === "primary") {
    const from = input.fromM ?? Number.NaN;
    const to = input.toM ?? Number.NaN;
    if (!Number.isFinite(from) || from < 0) {
      errors.push({ field: "fromM", message: "From depth must be 0 m or more." });
    }
    if (!Number.isFinite(to) || to <= from) {
      errors.push({
        field: "toM",
        message: "To depth must be greater than from depth.",
      });
    } else if (to > context.holeDepthM + DEPTH_TOLERANCE_M) {
      errors.push({
        field: "toM",
        message: `A sample must fall inside the hole's depth (0–${context.holeDepthM} m).`,
      });
    }

    if (errors.every((e) => e.field !== "fromM" && e.field !== "toM")) {
      const clash = context.holeSamples.find(
        (s) =>
          s.type === "primary" &&
          s.fromM != null &&
          s.toM != null &&
          from < s.toM - DEPTH_TOLERANCE_M &&
          to > s.fromM + DEPTH_TOLERANCE_M,
      );
      if (clash) {
        errors.push({
          field: "fromM",
          message: `Overlaps a primary sample at ${clash.fromM}–${clash.toM} m.`,
        });
      }
    }
  }

  if (input.type === "standard" && !input.standardRef?.trim()) {
    errors.push({
      field: "standardRef",
      message: "Enter the reference material ID.",
    });
  }

  if (input.type === "duplicate") {
    const parent = context.holeSamples.find(
      (s) => s.id === input.parentSampleId && s.type === "primary",
    );
    if (!parent) {
      errors.push({
        field: "parentSampleId",
        message: "Choose the primary sample this duplicates.",
      });
    }
  }

  return errors.length > 0
    ? { valid: false, errors, warnings: [] }
    : { valid: true, warnings: [] };
}

// --- QC insertion reminders (E6-2) -----------------------------------------

export type QcRates = {
  standardEveryN: number;
  blankEveryN: number;
  duplicateEveryN: number;
};

const RATE_KEY: Record<ControlType, keyof QcRates> = {
  standard: "standardEveryN",
  blank: "blankEveryN",
  duplicate: "duplicateEveryN",
};

/** What happened, in the order it happened. */
export type QcEvent =
  | { kind: "sample"; type: SampleType }
  | { kind: "dismissal"; controlType: ControlType };

export type QcReminder = {
  controlType: ControlType;
  /** Primary samples created since the last control of this type (or dismissal). */
  sinceLast: number;
  everyN: number;
};

/**
 * Which QC controls are due. A control of type T is due once N primary
 * samples have been created since the last T control was inserted — or since
 * a reminder for T was dismissed (which restarts the count). A rate of 0 or
 * less switches that reminder off.
 */
export function qcReminders(
  events: readonly QcEvent[],
  rates: QcRates,
): QcReminder[] {
  const counters: Record<ControlType, number> = {
    standard: 0,
    blank: 0,
    duplicate: 0,
  };

  for (const event of events) {
    if (event.kind === "dismissal") {
      counters[event.controlType] = 0;
    } else if (event.type === "primary") {
      for (const control of CONTROL_TYPES) {
        counters[control] += 1;
      }
    } else {
      counters[event.type] = 0;
    }
  }

  return CONTROL_TYPES.flatMap((controlType) => {
    const everyN = rates[RATE_KEY[controlType]];
    return everyN > 0 && counters[controlType] >= everyN
      ? [{ controlType, sinceLast: counters[controlType], everyN }]
      : [];
  });
}

export type QcAchievement = {
  controlType: ControlType;
  count: number;
  primaryCount: number;
  /** Achieved rate as "1 control per N primaries"; null with no controls yet. */
  achievedEveryN: number | null;
  targetEveryN: number;
};

/** E6-3: the QC insertion rate achieved so far against each target. */
export function qcAchievement(
  samples: readonly Pick<FieldSample, "type">[],
  rates: QcRates,
): QcAchievement[] {
  const primaryCount = samples.filter((s) => s.type === "primary").length;
  return CONTROL_TYPES.map((controlType) => {
    const count = samples.filter((s) => s.type === controlType).length;
    return {
      controlType,
      count,
      primaryCount,
      achievedEveryN:
        count > 0 ? Math.round((primaryCount / count) * 10) / 10 : null,
      targetEveryN: rates[RATE_KEY[controlType]],
    };
  });
}

export type SampleFilter = {
  drillholeId?: string | null;
  type?: SampleType | null;
  status?: SampleStatus | null;
};

/** E6-3: register filters — hole, type and status; an empty filter matches all. */
export function filterSamples<
  T extends Pick<FieldSample, "drillholeId" | "type" | "status">,
>(samples: readonly T[], filter: SampleFilter): T[] {
  return samples.filter(
    (s) =>
      (!filter.drillholeId || s.drillholeId === filter.drillholeId) &&
      (!filter.type || s.type === filter.type) &&
      (!filter.status || s.status === filter.status),
  );
}

/** The depth a saved sample carries: its own, or its parent's for a duplicate. */
export function sampleDepth(
  input: Pick<FieldSampleInput, "type" | "fromM" | "toM">,
  parent: Pick<FieldSample, "fromM" | "toM"> | null,
): { fromM: number | null; toM: number | null } {
  if (input.type === "primary") {
    return { fromM: input.fromM ?? null, toM: input.toM ?? null };
  }
  if (input.type === "duplicate" && parent) {
    return { fromM: parent.fromM, toM: parent.toM };
  }
  return { fromM: null, toM: null };
}
