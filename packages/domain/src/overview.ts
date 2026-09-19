// What the field app shows at a glance: what needs attention on a hole, and
// where a sample has been. Pure rules, so the screens stay simple and the
// wording is tested.

import { analyseContinuity, recoveryPercent, type DepthRange } from "./core";
import type { FieldSample } from "./sampling";
import type { Collar } from "./field";

// --- What needs attention on a hole ----------------------------------------

export type AttentionItem = {
  kind: "box-gap" | "box-overlap" | "log-gap" | "log-overlap";
  /** Which list the geologist should open to fix it. */
  target: "boxes" | "log";
  message: string;
};

/**
 * The gaps and overlaps in a hole's core boxes and logged intervals, worded
 * for the top of the hole screen. Boxes come first, then the log.
 */
export function holeAttention(
  boxes: readonly DepthRange[],
  intervals: readonly DepthRange[],
): AttentionItem[] {
  const items: AttentionItem[] = [];

  const add = (
    ranges: readonly DepthRange[],
    target: AttentionItem["target"],
    noun: string,
    gapKind: AttentionItem["kind"],
    overlapKind: AttentionItem["kind"],
  ) => {
    const { gaps, overlaps } = analyseContinuity(ranges);
    for (const gap of gaps) {
      items.push({
        kind: gapKind,
        target,
        message: `Gap in ${noun}, ${gap.fromM}–${gap.toM} m`,
      });
    }
    for (const overlap of overlaps) {
      items.push({
        kind: overlapKind,
        target,
        message: `Overlap in ${noun}, ${overlap.fromM}–${overlap.toM} m`,
      });
    }
  };

  add(boxes, "boxes", "core boxes", "box-gap", "box-overlap");
  add(intervals, "log", "the log", "log-gap", "log-overlap");
  return items;
}

/**
 * Core recovery across every run in a hole: total recovered ÷ total drilled.
 * Null when there are no runs to measure.
 */
export function overallRecoveryPercent(
  runs: readonly { fromM: number; toM: number; recoveredM: number }[],
): number | null {
  const drilled = runs.reduce((sum, r) => sum + (r.toM - r.fromM), 0);
  const recovered = runs.reduce((sum, r) => sum + r.recoveredM, 0);
  return recoveryPercent(drilled, recovered);
}

// --- Where a sample has been -----------------------------------------------

export type TraceStepKey =
  | "hole"
  | "box"
  | "interval"
  | "sample"
  | "bagged"
  | "dispatched"
  | "assay";

/**
 * `done`: happened. `current`: the next thing to do. `upcoming`: later.
 * `missing`: should exist for this sample but nothing was recorded — the
 * traceability gap a geologist most needs to see.
 */
export type TraceStepState = "done" | "current" | "upcoming" | "missing";

export type TraceStep = {
  key: TraceStepKey;
  title: string;
  detail: string | null;
  state: TraceStepState;
};

export type TraceInput = {
  sample: Pick<
    FieldSample,
    "sampleNumber" | "type" | "fromM" | "toM" | "status" | "standardRef"
  >;
  hole: { holeId: string; collar: Collar | null };
  /** Each core box, with how many photos were taken of it. */
  boxes: readonly {
    boxNumber: number;
    fromM: number;
    toM: number;
    photoCount: number;
  }[];
  intervals: readonly {
    fromM: number;
    toM: number;
    lithology: string | null;
    alterationType: string | null;
  }[];
};

function overlaps(
  a: { fromM: number; toM: number },
  b: { fromM: number; toM: number },
): boolean {
  return a.fromM < b.toM && b.fromM < a.toM;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The chain from the hole to the assay for one sample, in order. A primary
 * sample (or a field duplicate, which takes its parent's depth) is traced back
 * through its core box and logged interval; a standard or blank has no source
 * core, so its chain starts at the hole.
 */
export function buildSampleTrace(input: TraceInput): TraceStep[] {
  const { sample, hole, boxes, intervals } = input;
  const steps: TraceStep[] = [];

  steps.push({
    key: "hole",
    title: `Hole ${hole.holeId}`,
    detail: hole.collar
      ? `${hole.collar.source === "gps" ? "GPS collar" : "Collar"} ${hole.collar.latitude.toFixed(4)}, ${hole.collar.longitude.toFixed(4)}`
      : "No collar recorded",
    state: "done",
  });

  const hasDepth = sample.fromM != null && sample.toM != null;
  if (hasDepth) {
    const range = { fromM: sample.fromM!, toM: sample.toM! };

    const sourceBoxes = boxes
      .filter((b) => overlaps(b, range))
      .sort((a, b) => a.boxNumber - b.boxNumber);
    if (sourceBoxes.length === 0) {
      steps.push({
        key: "box",
        title: "Core box",
        detail: `No box recorded for ${range.fromM}–${range.toM} m`,
        state: "missing",
      });
    } else {
      const label =
        sourceBoxes.length === 1
          ? `Box ${sourceBoxes[0]!.boxNumber}`
          : `Boxes ${sourceBoxes[0]!.boxNumber}–${sourceBoxes[sourceBoxes.length - 1]!.boxNumber}`;
      const photoCount = sourceBoxes.reduce((n, b) => n + b.photoCount, 0);
      const photos =
        photoCount > 0 ? plural(photoCount, "photo", "photos") : "no photos yet";
      steps.push({
        key: "box",
        title: `${label} · ${range.fromM}–${range.toM} m`,
        detail: photos,
        state: "done",
      });
    }

    const sourceIntervals = intervals
      .filter((i) => overlaps(i, range))
      .sort((a, b) => a.fromM - b.fromM);
    if (sourceIntervals.length === 0) {
      steps.push({
        key: "interval",
        title: "Logged interval",
        detail: "Not logged yet",
        state: "missing",
      });
    } else {
      const first = sourceIntervals[0]!;
      const description = [first.lithology, first.alterationType]
        .filter((part): part is string => !!part)
        .join(" · ");
      steps.push({
        key: "interval",
        title: "Logged interval",
        detail:
          (description || `Logged ${first.fromM}–${first.toM} m`) +
          (sourceIntervals.length > 1
            ? ` (+${sourceIntervals.length - 1} more)`
            : ""),
        state: "done",
      });
    }
  }

  steps.push({
    key: "sample",
    title: "Sample created",
    detail:
      sample.type === "standard" && sample.standardRef
        ? `Reference material ${sample.standardRef}`
        : null,
    state: "done",
  });

  const bagged = sample.status === "bagged" || sample.status === "dispatched";
  const dispatched = sample.status === "dispatched";
  steps.push({
    key: "bagged",
    title: "Bagged",
    detail: null,
    state: bagged ? "done" : "current",
  });
  steps.push({
    key: "dispatched",
    title: "Dispatched to lab",
    detail: null,
    state: dispatched ? "done" : bagged ? "current" : "upcoming",
  });
  steps.push({
    key: "assay",
    title: "Assay result",
    detail: "Comes back from the lab",
    state: "upcoming",
  });

  return steps;
}
