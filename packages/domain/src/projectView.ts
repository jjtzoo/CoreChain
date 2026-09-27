// E18-2: the project manager's 3D evidence view. Pure geometry and grade
// rules; the web draws what these return.
//
// It shows recorded evidence only: where each hole goes, which intervals were
// sampled, and what the laboratory returned. There is no collar elevation and
// no downhole survey, so every hole starts at a flat datum (depth 0 at its
// collar) and runs straight along its planned azimuth and dip. Collars sit on
// the same flat grid as the collar map (E15), around the same centre, so the
// two views agree.

import {
  collarMapLayout,
  toLocalMetres,
  type CollarMapHole,
  type LatLon,
} from "./collarMap";

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Metres east and north of the project centre, and metres below the collar. */
export type ViewPoint = { x: number; y: number; down: number };

export type HoleDirection = {
  azimuthDeg: number | null;
  /** Dip, either sign: -60 and 60 both mean 60 degrees below horizontal. */
  inclinationDeg: number | null;
};

/** Steeper than this, a hole is drawn vertical whatever its azimuth. */
const NEAR_VERTICAL_DEG = 89.5;

/**
 * A point `depthM` along a straight hole, relative to its collar. A hole with
 * no dip recorded, or angled with no azimuth, is drawn vertical and flagged
 * `directionKnown: false` so the view can say so.
 */
export function holePointAt(
  direction: HoleDirection,
  depthM: number,
): ViewPoint & { directionKnown: boolean } {
  const along = Number.isFinite(depthM) && depthM > 0 ? depthM : 0;
  const { azimuthDeg, inclinationDeg } = direction;
  const dipKnown =
    inclinationDeg != null && Number.isFinite(inclinationDeg) && Math.abs(inclinationDeg) <= 90;
  if (!dipKnown) return { x: 0, y: 0, down: along, directionKnown: false };

  const dip = Math.abs(inclinationDeg);
  if (dip >= NEAR_VERTICAL_DEG) return { x: 0, y: 0, down: along, directionKnown: true };
  if (azimuthDeg == null || !Number.isFinite(azimuthDeg)) {
    return { x: 0, y: 0, down: along, directionKnown: false };
  }

  const plan = along * Math.cos(toRadians(dip));
  const azimuth = toRadians(azimuthDeg);
  return {
    x: plan * Math.sin(azimuth),
    y: plan * Math.cos(azimuth),
    down: along * Math.sin(toRadians(dip)),
    directionKnown: true,
  };
}

export type ProjectViewHoleInput<T> = {
  id: string;
  holeId: string;
  collar: LatLon | null;
  azimuthDeg: number | null;
  inclinationDeg: number | null;
  plannedDepthM: number | null;
  finalDepthM: number | null;
  /** Anything the caller wants back with the hole (status...). */
  data: T;
};

export type ProjectViewHole<T> = ProjectViewHoleInput<T> & {
  /** The collar in metres from the project centre (down is always 0). */
  origin: ViewPoint;
  /** The end of the trace: the final depth when drilled, else the planned depth. */
  end: ViewPoint;
  /** The depth the trace is drawn to, in metres along the hole. */
  depthM: number;
  /** Whether that depth is the drilled final depth rather than the plan. */
  depthIsFinal: boolean;
  directionKnown: boolean;
};

export type ProjectViewLayout<T> = {
  /** The project centre, or null when no hole has a collar. */
  centre: LatLon | null;
  /** Holes with a collar, in hole-ID order. */
  holes: ProjectViewHole<T>[];
  /** Holes with no collar recorded yet: listed, never dropped. */
  unlocated: ProjectViewHoleInput<T>[];
  /** Extent of collars and traces, in metres; null when nothing is located. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number; maxDown: number } | null;
};

const positive = (value: number | null) =>
  value != null && Number.isFinite(value) && value > 0 ? value : null;

/** Every located hole as a straight trace in local metres, plus the holes with no collar. */
export function projectViewLayout<T>(
  holes: readonly ProjectViewHoleInput<T>[],
): ProjectViewLayout<T> {
  // The collar map decides which collars are valid and where the centre is.
  const mapHoles: CollarMapHole<ProjectViewHoleInput<T>>[] = holes.map((hole) => ({
    id: hole.id,
    holeId: hole.holeId,
    collar: hole.collar,
    data: hole,
  }));
  const map = collarMapLayout(mapHoles);
  const unlocated = map.unlocated.map((h) => h.data);
  if (!map.centre) return { centre: null, holes: [], unlocated, bounds: null };

  const located = map.pads
    .flatMap((pad) => pad.holes.map((h) => h.data))
    .sort((a, b) => a.holeId.localeCompare(b.holeId, undefined, { numeric: true }));

  const placed = located.map((hole): ProjectViewHole<T> => {
    const collar = toLocalMetres(map.centre!, hole.collar!);
    const finalDepth = positive(hole.finalDepthM);
    const depthM = finalDepth ?? positive(hole.plannedDepthM) ?? 0;
    const tip = holePointAt(hole, depthM);
    return {
      ...hole,
      origin: { x: collar.x, y: collar.y, down: 0 },
      end: { x: collar.x + tip.x, y: collar.y + tip.y, down: tip.down },
      depthM,
      depthIsFinal: finalDepth != null,
      directionKnown: tip.directionKnown,
    };
  });

  const xs = placed.flatMap((h) => [h.origin.x, h.end.x]);
  const ys = placed.flatMap((h) => [h.origin.y, h.end.y]);
  return {
    centre: map.centre,
    holes: placed,
    unlocated,
    bounds: {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
      maxDown: Math.max(0, ...placed.map((h) => h.end.down)),
    },
  };
}

// ---------------------------------------------------------------------------
// Laboratory results

export type ViewAssayResult = {
  sampleId: string;
  analyte: string;
  value: number | null;
  unit: string | null;
  belowDetection: boolean;
  /** When it was entered; a later entry for the same element replaces an earlier one. */
  enteredAt: string;
};

export type ViewSample = {
  id: string;
  drillholeId: string;
  sampleNumber: string;
  sampleType: "primary" | "standard" | "blank" | "duplicate";
  fromM: number | null;
  toM: number | null;
};

export type AnalyteOption = {
  /** Lower-case key used to match results ("cu"). */
  key: string;
  /** As the laboratory reported it ("Cu"). */
  label: string;
  /** The unit most of its results use; the colour scale is in this unit. */
  unit: string | null;
  /** Primary samples with a result for it. */
  sampleCount: number;
};

const analyteKey = (analyte: string) => analyte.trim().toLowerCase();

/** Parts per million in one unit, for the units laboratories report. */
const PPM_PER_UNIT: Record<string, number> = {
  ppb: 0.001,
  ppm: 1,
  "g/t": 1,
  gpt: 1,
  "%": 10_000,
  pct: 10_000,
};

const unitKey = (unit: string | null) => (unit ?? "").trim().toLowerCase();

/**
 * A value in another unit: ppb, ppm, g/t and % convert between each other.
 * Null when either unit is unknown and they differ.
 */
export function convertGrade(value: number, from: string | null, to: string | null): number | null {
  const a = unitKey(from);
  const b = unitKey(to);
  if (a === b) return value;
  const fromPpm = PPM_PER_UNIT[a];
  const toPpm = PPM_PER_UNIT[b];
  if (fromPpm == null || toPpm == null) return null;
  return (value * fromPpm) / toPpm;
}

/** The latest result per sample for one element. */
function latestResults(
  results: readonly ViewAssayResult[],
  key: string,
): Map<string, ViewAssayResult> {
  const latest = new Map<string, ViewAssayResult>();
  for (const result of results) {
    if (analyteKey(result.analyte) !== key) continue;
    const current = latest.get(result.sampleId);
    if (!current || result.enteredAt > current.enteredAt) latest.set(result.sampleId, result);
  }
  return latest;
}

const hasDepths = (sample: ViewSample) =>
  sample.fromM != null &&
  sample.toM != null &&
  Number.isFinite(sample.fromM) &&
  Number.isFinite(sample.toM) &&
  sample.toM > sample.fromM;

/**
 * Samples drawn along the holes: primary samples with depths. Standards and
 * blanks have no depth, and a duplicate repeats its parent's interval.
 */
export function plottedSamples(samples: readonly ViewSample[]): ViewSample[] {
  return samples.filter((s) => s.sampleType === "primary" && hasDepths(s));
}

/**
 * The elements the laboratory has returned for plotted samples, the most
 * sampled first, then the one with more results above detection (the element
 * the laboratory can actually measure), then alphabetical. The first is the
 * view's default.
 */
export function analytesWithResults(
  samples: readonly ViewSample[],
  results: readonly ViewAssayResult[],
): AnalyteOption[] {
  const plotted = new Set(plottedSamples(samples).map((s) => s.id));
  const byKey = new Map<
    string,
    {
      label: string;
      samples: Set<string>;
      detected: Set<string>;
      units: Map<string, { unit: string | null; n: number }>;
    }
  >();
  for (const result of results) {
    if (!plotted.has(result.sampleId)) continue;
    const key = analyteKey(result.analyte);
    if (!key) continue;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { label: result.analyte.trim(), samples: new Set(), detected: new Set(), units: new Map() };
      byKey.set(key, entry);
    }
    entry.samples.add(result.sampleId);
    if (!result.belowDetection && result.value != null) entry.detected.add(result.sampleId);
    const u = unitKey(result.unit);
    const count = entry.units.get(u);
    if (count) count.n += 1;
    else entry.units.set(u, { unit: result.unit?.trim() || null, n: 1 });
  }

  return [...byKey.entries()]
    .map(([key, entry]) => {
      const unit = [...entry.units.values()].sort((a, b) => b.n - a.n)[0]?.unit ?? null;
      return { key, label: entry.label, unit, sampleCount: entry.samples.size, detected: entry.detected.size };
    })
    .sort(
      (a, b) =>
        b.sampleCount - a.sampleCount || b.detected - a.detected || a.label.localeCompare(b.label),
    )
    .map(({ detected: _detected, ...option }) => option);
}

export type GradeState =
  /** A value, in the element's unit. */
  | "result"
  /** Below the detection limit; `value` is the limit when reported. */
  | "below_detection"
  /** The laboratory returned other elements for this sample, not this one. */
  | "not_analysed"
  /** Nothing back from the laboratory yet. */
  | "awaiting_results"
  /** A result with no value, or in a unit that doesn't convert. */
  | "not_comparable";

export type GradeSegment = {
  sampleId: string;
  sampleNumber: string;
  drillholeId: string;
  fromM: number;
  toM: number;
  state: GradeState;
  /** In the element's unit; null unless the state is result or below_detection. */
  value: number | null;
  unit: string | null;
};

/** Every plotted sample with its grade for one element, in hole and depth order. */
export function gradeSegments(
  samples: readonly ViewSample[],
  results: readonly ViewAssayResult[],
  analyte: AnalyteOption,
): GradeSegment[] {
  const latest = latestResults(results, analyte.key);
  const withAnyResult = new Set(results.map((r) => r.sampleId));

  return plottedSamples(samples)
    .map((sample): GradeSegment => {
      const base = {
        sampleId: sample.id,
        sampleNumber: sample.sampleNumber,
        drillholeId: sample.drillholeId,
        fromM: sample.fromM!,
        toM: sample.toM!,
        unit: analyte.unit,
      };
      const result = latest.get(sample.id);
      if (!result) {
        const state = withAnyResult.has(sample.id) ? "not_analysed" : "awaiting_results";
        return { ...base, state, value: null };
      }
      const converted =
        result.value != null && Number.isFinite(result.value)
          ? convertGrade(result.value, result.unit, analyte.unit)
          : null;
      if (result.belowDetection) {
        // A missing limit is still below detection; only the number is unknown.
        return { ...base, state: "below_detection", value: converted };
      }
      if (converted == null) return { ...base, state: "not_comparable", value: null };
      return { ...base, state: "result", value: converted };
    })
    .sort(
      (a, b) =>
        a.drillholeId.localeCompare(b.drillholeId) || a.fromM - b.fromM || a.toM - b.toM,
    );
}

export type GradeScale = {
  /** The colour runs from `low` to `high`; values outside take the end colour. */
  low: number;
  high: number;
  /** Results below `low` and above `high`, for the legend note. */
  belowLow: number;
  aboveHigh: number;
  /** Values for the legend, `low` to `high`. */
  stops: number[];
};

/** Percentile with linear interpolation between the closest ranks. */
function percentile(sorted: readonly number[], p: number): number {
  const rank = (sorted.length - 1) * p;
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (rank - lower);
}

export const SCALE_LOW_PERCENTILE = 0.05;
export const SCALE_HIGH_PERCENTILE = 0.95;
const LEGEND_STOPS = 5;

/**
 * One colour scale per project and element, from the 5th to the 95th
 * percentile of the results, so a single very high value doesn't wash out the
 * rest. Below-detection results are not part of it. Null with no results.
 */
export function gradeScale(values: readonly number[]): GradeScale | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const low = percentile(sorted, SCALE_LOW_PERCENTILE);
  const high = percentile(sorted, SCALE_HIGH_PERCENTILE);
  const stops =
    high > low
      ? Array.from({ length: LEGEND_STOPS }, (_, i) => low + ((high - low) * i) / (LEGEND_STOPS - 1))
      : [low];
  return {
    low,
    high,
    belowLow: sorted.filter((v) => v < low).length,
    aboveHigh: sorted.filter((v) => v > high).length,
    stops,
  };
}

/**
 * Where a value sits on the scale, 0 to 1. A scale with a single value puts
 * everything in the middle rather than claiming it is high or low.
 */
export function gradeFraction(scale: GradeScale, value: number): number {
  if (!(scale.high > scale.low)) return 0.5;
  return Math.min(1, Math.max(0, (value - scale.low) / (scale.high - scale.low)));
}

/** "0.42 %", "1,250 ppm", "0.008 g/t": three significant figures, grouped thousands. */
export function formatGrade(value: number, unit: string | null): string {
  const abs = Math.abs(value);
  const text =
    abs >= 1_000
      ? Math.round(value).toLocaleString("en-US")
      : abs === 0
        ? "0"
        : Number(value.toPrecision(3)).toString();
  return unit ? `${text} ${unit}` : text;
}

// ---------------------------------------------------------------------------
// Depth stretch

const STRETCHES = [1, 2, 3, 5, 10, 20, 50] as const;

/**
 * The depth stretches worth offering for a project, and the one to start on.
 * Holes a few hundred metres deep across a few hundred metres read fine at
 * 1x; shallow holes kilometres apart are flat lines without a stretch. The
 * starting stretch makes the deepest hole about half as tall as the project
 * is wide; the options run from a little below it to one step above.
 */
export function depthStretchOptions(
  bounds: ProjectViewLayout<unknown>["bounds"],
): { options: number[]; initial: number } {
  if (!bounds || !(bounds.maxDown > 0)) return { options: [1, 2, 3], initial: 1 };
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  let index = 0;
  STRETCHES.forEach((s, i) => {
    if (s * bounds.maxDown <= span / 2) index = i;
  });
  const window = STRETCHES.slice(Math.max(0, index - 2), index + 2);
  const options = new Set<number>([1, ...window]);
  for (const s of STRETCHES) {
    if (options.size >= 3) break;
    options.add(s);
  }
  return { options: [...options].sort((a, b) => a - b), initial: STRETCHES[index]! };
}
