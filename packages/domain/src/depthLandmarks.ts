// Depth shortcuts (design principle P1 in
// docs/product/field-workflow-friction-and-design-principles.md: capture once,
// derive everywhere). A run, a box, a log interval and a sample are four
// different measurements of the same core, so they can't be merged, but a
// geologist who has just entered "run ends at 6 m" should not have to type 6
// again for the box or the interval that ends there. Every form asks only for
// the end depth; these are the ends already known further down the hole.

import type { DepthRange } from "./core";

export type LandmarkKind = "run" | "box" | "interval" | "sample" | "hole";

export type DepthLandmark = {
  depthM: number;
  /** Every kind of record that ends at this depth. */
  kinds: LandmarkKind[];
  /** Short text for a chip, e.g. "Run end · 6 m". */
  label: string;
};

export type LandmarkContext = {
  runs: readonly DepthRange[];
  boxes: readonly DepthRange[];
  intervals: readonly DepthRange[];
  /** Depth ranges of primary samples (QC samples have no depth). */
  samples: readonly DepthRange[];
  plannedDepthM?: number | null;
};

const SAME_DEPTH_M = 0.005;

const NAMES: Record<LandmarkKind, string> = {
  run: "Run end",
  box: "Box end",
  interval: "Logged to",
  sample: "Sampled to",
  hole: "Planned depth",
};

// The order names appear in when several kinds end at the same depth.
const NAME_ORDER: LandmarkKind[] = ["run", "box", "interval", "sample", "hole"];

function formatDepth(depthM: number): string {
  return `${Number(depthM.toFixed(2))} m`;
}

function nearestEndBeyond(ranges: readonly DepthRange[], fromM: number): number | null {
  let best: number | null = null;
  for (const range of ranges) {
    if (range.toM > fromM + SAME_DEPTH_M && (best === null || range.toM < best)) {
      best = range.toM;
    }
  }
  return best;
}

/**
 * The depths the next record could plausibly end at: for each other kind of
 * record, the nearest end deeper than `fromM`, plus the hole's planned depth.
 * The kind being entered is left out (its own last end is already the start).
 * Nearest first; several kinds ending at the same depth become one landmark.
 */
export function depthLandmarks(
  context: LandmarkContext,
  fromM: number,
  entering: Exclude<LandmarkKind, "hole">,
  limit = 3,
): DepthLandmark[] {
  if (!Number.isFinite(fromM)) return [];

  const candidates: Array<{ kind: LandmarkKind; depthM: number | null }> = [
    { kind: "run", depthM: entering === "run" ? null : nearestEndBeyond(context.runs, fromM) },
    { kind: "box", depthM: entering === "box" ? null : nearestEndBeyond(context.boxes, fromM) },
    {
      kind: "interval",
      depthM: entering === "interval" ? null : nearestEndBeyond(context.intervals, fromM),
    },
    {
      kind: "sample",
      depthM: entering === "sample" ? null : nearestEndBeyond(context.samples, fromM),
    },
    {
      kind: "hole",
      depthM:
        context.plannedDepthM != null && context.plannedDepthM > fromM + SAME_DEPTH_M
          ? context.plannedDepthM
          : null,
    },
  ];

  const merged: DepthLandmark[] = [];
  for (const { kind, depthM } of candidates) {
    if (depthM === null) continue;
    const existing = merged.find((l) => Math.abs(l.depthM - depthM) <= SAME_DEPTH_M);
    if (existing) {
      existing.kinds.push(kind);
    } else {
      merged.push({ depthM, kinds: [kind], label: "" });
    }
  }

  for (const landmark of merged) {
    landmark.kinds.sort((a, b) => NAME_ORDER.indexOf(a) - NAME_ORDER.indexOf(b));
    const names = landmark.kinds.slice(0, 2).map((kind) => NAMES[kind]);
    landmark.label = `${names.join(" / ")} · ${formatDepth(landmark.depthM)}`;
  }

  return merged.sort((a, b) => a.depthM - b.depthM).slice(0, limit);
}
