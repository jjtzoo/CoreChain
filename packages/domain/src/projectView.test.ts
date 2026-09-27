import { describe, expect, it } from "vitest";
import { collarMapLayout, toLocalMetres, traceOffset, type LatLon } from "./collarMap";
import {
  analytesWithResults,
  convertGrade,
  depthStretchOptions,
  formatGrade,
  gradeFraction,
  gradeScale,
  gradeSegments,
  holePointAt,
  plottedSamples,
  projectViewLayout,
  type AnalyteOption,
  type ProjectViewHoleInput,
  type ViewAssayResult,
  type ViewSample,
} from "./projectView";

// A site in northern Mindanao; 0.001 degrees of latitude is about 111 m.
const site: LatLon = { latitude: 8.5, longitude: 125.5 };
const offset = (north: number, east: number): LatLon => ({
  latitude: site.latitude + north / 111_195,
  longitude: site.longitude + east / (111_195 * Math.cos((site.latitude * Math.PI) / 180)),
});

const hole = (
  holeId: string,
  collar: LatLon | null,
  more: Partial<ProjectViewHoleInput<null>> = {},
): ProjectViewHoleInput<null> => ({
  id: holeId.toLowerCase(),
  holeId,
  collar,
  azimuthDeg: null,
  inclinationDeg: -90,
  plannedDepthM: 100,
  finalDepthM: null,
  data: null,
  ...more,
});

describe("holePointAt", () => {
  it("runs a vertical hole straight down", () => {
    expect(holePointAt({ azimuthDeg: null, inclinationDeg: -90 }, 150)).toEqual({
      x: 0,
      y: 0,
      down: 150,
      directionKnown: true,
    });
  });

  it("follows the planned azimuth and dip, either sign of dip", () => {
    const a = holePointAt({ azimuthDeg: 90, inclinationDeg: -60 }, 200);
    expect(a.x).toBeCloseTo(100, 6);
    expect(a.y).toBeCloseTo(0, 6);
    expect(a.down).toBeCloseTo(200 * Math.sin(Math.PI / 3), 6);
    expect(a.directionKnown).toBe(true);
    const b = holePointAt({ azimuthDeg: 90, inclinationDeg: 60 }, 200);
    expect(b).toEqual(a);
  });

  it("matches the collar map's trace from above", () => {
    const plan = { azimuthDeg: 135, inclinationDeg: -55, depthM: 320 };
    const point = holePointAt(plan, plan.depthM);
    const trace = traceOffset(plan)!;
    expect(point.x).toBeCloseTo(trace.x, 6);
    expect(point.y).toBeCloseTo(trace.y, 6);
  });

  it("draws a hole vertical and flags it when the direction is missing", () => {
    expect(holePointAt({ azimuthDeg: 45, inclinationDeg: null }, 80)).toEqual({
      x: 0,
      y: 0,
      down: 80,
      directionKnown: false,
    });
    expect(holePointAt({ azimuthDeg: null, inclinationDeg: -60 }, 80).directionKnown).toBe(false);
    expect(holePointAt({ azimuthDeg: 10, inclinationDeg: -120 }, 80).directionKnown).toBe(false);
  });

  it("treats a bad depth as the collar", () => {
    expect(holePointAt({ azimuthDeg: 0, inclinationDeg: -60 }, Number.NaN).down).toBe(0);
    expect(holePointAt({ azimuthDeg: 0, inclinationDeg: -60 }, -5).down).toBe(0);
  });
});

describe("projectViewLayout", () => {
  it("lists holes with no collar separately and has no centre without collars", () => {
    const layout = projectViewLayout([hole("DH-2", null), hole("DH-1", null)]);
    expect(layout.centre).toBeNull();
    expect(layout.holes).toEqual([]);
    expect(layout.bounds).toBeNull();
    expect(layout.unlocated.map((h) => h.holeId)).toEqual(["DH-1", "DH-2"]);
  });

  it("uses the collar map's centre so the two views line up", () => {
    const holes = [hole("DH-1", offset(0, 0)), hole("DH-2", offset(300, 400)), hole("DH-3", null)];
    const layout = projectViewLayout(holes);
    const map = collarMapLayout(holes.map((h) => ({ ...h, data: null })));
    expect(layout.centre).toEqual(map.centre);
    expect(layout.holes.map((h) => h.holeId)).toEqual(["DH-1", "DH-2"]);
    expect(layout.unlocated.map((h) => h.holeId)).toEqual(["DH-3"]);
    const dh2 = layout.holes[1]!;
    const expected = toLocalMetres(layout.centre!, offset(300, 400));
    expect(dh2.origin).toEqual({ x: expected.x, y: expected.y, down: 0 });
  });

  it("keeps holes on one pad as separate traces, in hole-ID order", () => {
    const layout = projectViewLayout([
      hole("DH-10", offset(0, 0), { azimuthDeg: 90, inclinationDeg: -60 }),
      hole("DH-9", offset(2, 1), { azimuthDeg: 270, inclinationDeg: -60 }),
    ]);
    expect(layout.holes.map((h) => h.holeId)).toEqual(["DH-9", "DH-10"]);
    expect(layout.holes[0]!.end.x).toBeLessThan(layout.holes[1]!.end.x);
  });

  it("draws to the final depth when drilled, else the planned depth", () => {
    const layout = projectViewLayout([
      hole("DH-1", offset(0, 0), { plannedDepthM: 150, finalDepthM: 162.4 }),
      hole("DH-2", offset(100, 0), { plannedDepthM: 150, finalDepthM: null }),
      hole("DH-3", offset(200, 0), { plannedDepthM: null, finalDepthM: null }),
    ]);
    const [a, b, c] = layout.holes;
    expect(a).toMatchObject({ depthM: 162.4, depthIsFinal: true });
    expect(a!.end.down).toBeCloseTo(162.4, 6);
    expect(b).toMatchObject({ depthM: 150, depthIsFinal: false });
    expect(c).toMatchObject({ depthM: 0, depthIsFinal: false });
    expect(layout.bounds!.maxDown).toBeCloseTo(162.4, 6);
  });

  it("bounds cover collars and the ends of angled traces", () => {
    const layout = projectViewLayout([
      hole("DH-1", offset(0, 0), { azimuthDeg: 0, inclinationDeg: -45, plannedDepthM: 200 }),
    ]);
    const { bounds } = layout;
    const planLength = 200 * Math.cos(Math.PI / 4);
    expect(bounds!.maxY - bounds!.minY).toBeCloseTo(planLength, 6);
    expect(bounds!.maxX - bounds!.minX).toBeCloseTo(0, 6);
    expect(bounds!.maxDown).toBeCloseTo(planLength, 6);
  });
});

const sample = (
  id: string,
  fromM: number | null,
  toM: number | null,
  more: Partial<ViewSample> = {},
): ViewSample => ({
  id,
  drillholeId: "h1",
  sampleNumber: id.toUpperCase(),
  sampleType: "primary",
  fromM,
  toM,
  ...more,
});

const result = (
  sampleId: string,
  analyte: string,
  value: number | null,
  more: Partial<ViewAssayResult> = {},
): ViewAssayResult => ({
  sampleId,
  analyte,
  value,
  unit: "%",
  belowDetection: false,
  enteredAt: "2026-09-01T00:00:00.000Z",
  ...more,
});

describe("plotted samples", () => {
  it("keeps primary samples with depths and leaves out QC and depthless samples", () => {
    const samples = [
      sample("s1", 0, 1.5),
      sample("std", null, null, { sampleType: "standard" }),
      sample("blk", null, null, { sampleType: "blank" }),
      sample("dup", 0, 1.5, { sampleType: "duplicate" }),
      sample("s2", null, null),
      sample("s3", 4, 4),
    ];
    expect(plottedSamples(samples).map((s) => s.id)).toEqual(["s1"]);
  });
});

describe("analytesWithResults", () => {
  it("lists elements the laboratory returned for plotted samples, most sampled first", () => {
    const samples = [sample("s1", 0, 1), sample("s2", 1, 2), sample("std", null, null, { sampleType: "standard" })];
    const results = [
      result("s1", "Au", 0.2, { unit: "g/t" }),
      result("s1", "Cu", 0.4),
      result("s2", "cu", 0.6),
      result("s2", "Ag", 3, { unit: "ppm" }),
      result("std", "Mo", 12, { unit: "ppm" }),
    ];
    expect(analytesWithResults(samples, results)).toEqual([
      { key: "cu", label: "Cu", unit: "%", sampleCount: 2 },
      { key: "ag", label: "Ag", unit: "ppm", sampleCount: 1 },
      { key: "au", label: "Au", unit: "g/t", sampleCount: 1 },
    ]);
  });

  it("puts the element with more results above detection first when counts tie", () => {
    const samples = [sample("s1", 0, 1), sample("s2", 1, 2)];
    const results = [
      result("s1", "Au", 0.01, { unit: "g/t", belowDetection: true }),
      result("s2", "Au", 0.3, { unit: "g/t" }),
      result("s1", "Cu", 0.4),
      result("s2", "Cu", 0.6),
    ];
    expect(analytesWithResults(samples, results).map((a) => a.label)).toEqual(["Cu", "Au"]);
  });

  it("takes the unit most results use", () => {
    const samples = [sample("s1", 0, 1), sample("s2", 1, 2), sample("s3", 2, 3)];
    const results = [
      result("s1", "Cu", 4200, { unit: "ppm" }),
      result("s2", "Cu", 3100, { unit: "ppm" }),
      result("s3", "Cu", 1.2, { unit: "%" }),
    ];
    expect(analytesWithResults(samples, results)[0]!.unit).toBe("ppm");
  });

  it("is empty before any result is back", () => {
    expect(analytesWithResults([sample("s1", 0, 1)], [])).toEqual([]);
  });
});

describe("gradeSegments", () => {
  const cu: AnalyteOption = { key: "cu", label: "Cu", unit: "%", sampleCount: 0 };

  it("gives each plotted sample a state for the element", () => {
    const samples = [
      sample("s1", 0, 1),
      sample("s2", 1, 2),
      sample("s3", 2, 3),
      sample("s4", 3, 4),
      sample("dup", 0, 1, { sampleType: "duplicate" }),
    ];
    const results = [
      result("s1", "Cu", 0.42),
      result("s2", "Cu", 0.01, { belowDetection: true }),
      result("s3", "Au", 0.3, { unit: "g/t" }),
      result("dup", "Cu", 0.44),
    ];
    const segments = gradeSegments(samples, results, cu);
    expect(segments.map((s) => [s.sampleId, s.state, s.value])).toEqual([
      ["s1", "result", 0.42],
      ["s2", "below_detection", 0.01],
      ["s3", "not_analysed", null],
      ["s4", "awaiting_results", null],
    ]);
  });

  it("uses the latest entry when a result was re-entered", () => {
    const results = [
      result("s1", "Cu", 0.5, { enteredAt: "2026-09-02T00:00:00.000Z" }),
      result("s1", "CU", 0.3, { enteredAt: "2026-09-01T00:00:00.000Z" }),
    ];
    expect(gradeSegments([sample("s1", 0, 1)], results, cu)[0]!.value).toBe(0.5);
  });

  it("converts results reported in another unit, and flags those that can't be", () => {
    const samples = [sample("s1", 0, 1), sample("s2", 1, 2), sample("s3", 2, 3)];
    const results = [
      result("s1", "Cu", 4200, { unit: "ppm" }),
      result("s2", "Cu", 12, { unit: "cps" }),
      result("s3", "Cu", null),
    ];
    const segments = gradeSegments(samples, results, cu);
    expect(segments[0]).toMatchObject({ state: "result", unit: "%" });
    expect(segments[0]!.value).toBeCloseTo(0.42, 9);
    expect(segments[1]).toMatchObject({ state: "not_comparable", value: null });
    expect(segments[2]).toMatchObject({ state: "not_comparable", value: null });
  });

  it("keeps a below-detection result with no limit as below detection", () => {
    const results = [result("s1", "Cu", null, { belowDetection: true })];
    expect(gradeSegments([sample("s1", 0, 1)], results, cu)[0]).toMatchObject({
      state: "below_detection",
      value: null,
    });
  });

  it("orders segments by hole, then depth", () => {
    const samples = [
      sample("b2", 5, 6, { drillholeId: "h2" }),
      sample("a2", 3, 4),
      sample("a1", 0, 1),
      sample("b1", 0, 2, { drillholeId: "h2" }),
    ];
    expect(gradeSegments(samples, [], cu).map((s) => s.sampleId)).toEqual(["a1", "a2", "b1", "b2"]);
  });
});

describe("gradeScale", () => {
  it("is null with no results", () => {
    expect(gradeScale([])).toBeNull();
    expect(gradeScale([Number.NaN])).toBeNull();
  });

  it("clamps at the 5th and 95th percentiles so one high value doesn't wash out the rest", () => {
    const values = [...Array.from({ length: 19 }, (_, i) => (i + 1) / 10), 50];
    const scale = gradeScale(values)!;
    expect(scale.low).toBeCloseTo(0.195, 9);
    expect(scale.high).toBeLessThan(5);
    expect(scale.aboveHigh).toBe(1);
    expect(scale.belowLow).toBe(1);
    expect(scale.stops).toHaveLength(5);
    expect(scale.stops[0]).toBe(scale.low);
    expect(scale.stops[4]).toBeCloseTo(scale.high, 9);
    expect(gradeFraction(scale, 50)).toBe(1);
    expect(gradeFraction(scale, 0.1)).toBe(0);
  });

  it("puts a single value in the middle of the colour range", () => {
    const scale = gradeScale([0.8])!;
    expect(scale).toMatchObject({ low: 0.8, high: 0.8, stops: [0.8], belowLow: 0, aboveHigh: 0 });
    expect(gradeFraction(scale, 0.8)).toBe(0.5);
  });
});

describe("units and formatting", () => {
  it("converts between ppb, ppm, g/t and %", () => {
    expect(convertGrade(4200, "ppm", "%")).toBeCloseTo(0.42, 9);
    expect(convertGrade(1.5, "g/t", "ppm")).toBe(1.5);
    expect(convertGrade(250, "ppb", "g/t")).toBeCloseTo(0.25, 9);
    expect(convertGrade(0.3, "PCT", "%")).toBe(0.3);
    expect(convertGrade(3, "cps", "cps")).toBe(3);
    expect(convertGrade(3, "cps", "%")).toBeNull();
    expect(convertGrade(3, null, "%")).toBeNull();
  });

  it("formats grades to three significant figures", () => {
    expect(formatGrade(0.4234, "%")).toBe("0.423 %");
    expect(formatGrade(1250.4, "ppm")).toBe("1,250 ppm");
    expect(formatGrade(0.008, "g/t")).toBe("0.008 g/t");
    expect(formatGrade(12, null)).toBe("12");
    expect(formatGrade(0, "%")).toBe("0 %");
  });
});

describe("depthStretchOptions", () => {
  const box = (width: number, maxDown: number) => ({
    minX: 0,
    maxX: width,
    minY: 0,
    maxY: width / 2,
    maxDown,
  });

  it("starts at 1x for deep holes close together", () => {
    expect(depthStretchOptions(box(350, 300))).toEqual({ options: [1, 2, 3], initial: 1 });
  });

  it("starts with a stretch for shallow holes far apart, keeping 1x on offer", () => {
    expect(depthStretchOptions(box(5_000, 100))).toEqual({
      options: [1, 5, 10, 20, 50],
      initial: 20,
    });
  });

  it("offers the defaults with nothing to measure", () => {
    expect(depthStretchOptions(null)).toEqual({ options: [1, 2, 3], initial: 1 });
    expect(depthStretchOptions(box(300, 0))).toEqual({ options: [1, 2, 3], initial: 1 });
  });
});
