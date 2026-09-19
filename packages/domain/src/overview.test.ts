import { describe, expect, it } from "vitest";
import {
  buildSampleTrace,
  holeAttention,
  overallRecoveryPercent,
  type TraceInput,
} from "./overview";

describe("holeAttention", () => {
  it("reports nothing for a clean hole", () => {
    expect(
      holeAttention(
        [
          { fromM: 0, toM: 4.2 },
          { fromM: 4.2, toM: 8.4 },
        ],
        [{ fromM: 0, toM: 8.4 }],
      ),
    ).toEqual([]);
  });

  it("words a gap in the boxes and points to the boxes", () => {
    expect(
      holeAttention(
        [
          { fromM: 0, toM: 8.4 },
          { fromM: 9.5, toM: 12 },
        ],
        [],
      ),
    ).toEqual([
      {
        kind: "box-gap",
        target: "boxes",
        message: "Gap in core boxes, 8.4–9.5 m",
      },
    ]);
  });

  it("reports log gaps and overlaps, boxes first", () => {
    const items = holeAttention(
      [
        { fromM: 0, toM: 1 },
        { fromM: 2, toM: 3 },
      ],
      [
        { fromM: 0, toM: 5 },
        { fromM: 4, toM: 8 },
      ],
    );
    expect(items.map((i) => i.kind)).toEqual(["box-gap", "log-overlap"]);
    expect(items[1]).toMatchObject({
      target: "log",
      message: "Overlap in the log, 4–5 m",
    });
  });
});

describe("overallRecoveryPercent", () => {
  it("divides everything recovered by everything drilled", () => {
    expect(
      overallRecoveryPercent([
        { fromM: 0, toM: 3, recoveredM: 3 },
        { fromM: 3, toM: 6, recoveredM: 2.4 },
      ]),
    ).toBe(90);
  });

  it("is null when there are no runs", () => {
    expect(overallRecoveryPercent([])).toBeNull();
  });
});

const base: TraceInput = {
  sample: {
    sampleNumber: "SIP-00001",
    type: "primary",
    fromM: 50,
    toM: 60,
    status: "created",
    standardRef: null,
  },
  hole: {
    holeId: "MGDH",
    collar: {
      source: "gps",
      latitude: 14.613968,
      longitude: 121.032891,
      accuracyM: 5,
      capturedAt: "2026-09-19T00:00:00.000Z",
    },
  },
  boxes: [{ boxNumber: 1, fromM: 50, toM: 60, photoCount: 1 }],
  intervals: [
    { fromM: 50, toM: 60, lithology: "GRN", alterationType: "SER" },
  ],
};

describe("buildSampleTrace", () => {
  it("traces a primary sample from hole to assay", () => {
    const steps = buildSampleTrace(base);
    expect(steps.map((s) => s.key)).toEqual([
      "hole",
      "box",
      "interval",
      "sample",
      "bagged",
      "dispatched",
      "assay",
    ]);
    expect(steps[0]).toMatchObject({
      title: "Hole MGDH",
      detail: "GPS collar 14.6140, 121.0329",
      state: "done",
    });
    expect(steps[1]).toMatchObject({
      title: "Box 1 · 50–60 m",
      detail: "1 photo",
      state: "done",
    });
    expect(steps[2]).toMatchObject({ detail: "GRN · SER", state: "done" });
  });

  it("makes bagging the current step for a new sample", () => {
    const states = buildSampleTrace(base).map((s) => s.state);
    expect(states).toEqual([
      "done",
      "done",
      "done",
      "done",
      "current",
      "upcoming",
      "upcoming",
    ]);
  });

  it("moves along as the sample is bagged and dispatched", () => {
    const bagged = buildSampleTrace({
      ...base,
      sample: { ...base.sample, status: "bagged" },
    });
    expect(bagged.find((s) => s.key === "bagged")!.state).toBe("done");
    expect(bagged.find((s) => s.key === "dispatched")!.state).toBe("current");

    const dispatched = buildSampleTrace({
      ...base,
      sample: { ...base.sample, status: "dispatched" },
    });
    expect(dispatched.find((s) => s.key === "dispatched")!.state).toBe("done");
    expect(dispatched.find((s) => s.key === "assay")!.state).toBe("upcoming");
  });

  it("flags a missing box and a missing log as traceability gaps", () => {
    const steps = buildSampleTrace({ ...base, boxes: [], intervals: [] });
    expect(steps.find((s) => s.key === "box")).toMatchObject({
      state: "missing",
      detail: "No box recorded for 50–60 m",
    });
    expect(steps.find((s) => s.key === "interval")).toMatchObject({
      state: "missing",
      detail: "Not logged yet",
    });
  });

  it("names a range of boxes when the sample spans several", () => {
    const steps = buildSampleTrace({
      ...base,
      boxes: [
        { boxNumber: 4, fromM: 45, toM: 55, photoCount: 2 },
        { boxNumber: 5, fromM: 55, toM: 65, photoCount: 1 },
      ],
    });
    const box = steps.find((s) => s.key === "box")!;
    expect(box.title).toBe("Boxes 4–5 · 50–60 m");
    expect(box.detail).toBe("3 photos");
  });

  it("says when there are no photos and counts extra intervals", () => {
    const steps = buildSampleTrace({
      ...base,
      boxes: [{ boxNumber: 1, fromM: 50, toM: 60, photoCount: 0 }],
      intervals: [
        { fromM: 50, toM: 55, lithology: "GRN", alterationType: null },
        { fromM: 55, toM: 60, lithology: "AND", alterationType: null },
      ],
    });
    expect(steps.find((s) => s.key === "box")!.detail).toBe("no photos yet");
    expect(steps.find((s) => s.key === "interval")!.detail).toBe(
      "GRN (+1 more)",
    );
  });

  it("starts a standard or blank at the hole, with no core to trace", () => {
    const steps = buildSampleTrace({
      ...base,
      sample: {
        ...base.sample,
        type: "standard",
        fromM: null,
        toM: null,
        standardRef: "OREAS 45e",
      },
    });
    expect(steps.map((s) => s.key)).toEqual([
      "hole",
      "sample",
      "bagged",
      "dispatched",
      "assay",
    ]);
    expect(steps.find((s) => s.key === "sample")!.detail).toBe(
      "Reference material OREAS 45e",
    );
  });

  it("notes a hole with no collar", () => {
    const steps = buildSampleTrace({
      ...base,
      hole: { holeId: "MGDH", collar: null },
    });
    expect(steps[0]!.detail).toBe("No collar recorded");
  });
});
