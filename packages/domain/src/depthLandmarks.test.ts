import { describe, expect, it } from "vitest";
import { depthLandmarks, type LandmarkContext } from "./depthLandmarks";

const empty: LandmarkContext = { runs: [], boxes: [], intervals: [], samples: [] };

describe("depthLandmarks", () => {
  it("offers nothing when the hole has no records yet", () => {
    expect(depthLandmarks(empty, 0, "interval")).toEqual([]);
  });

  it("offers the nearest known end deeper than the start, nearest first", () => {
    const context: LandmarkContext = {
      ...empty,
      runs: [
        { fromM: 0, toM: 3 },
        { fromM: 3, toM: 6 },
      ],
      boxes: [{ fromM: 0, toM: 5 }],
    };
    const landmarks = depthLandmarks(context, 3, "interval");
    expect(landmarks.map((l) => [l.depthM, l.kinds])).toEqual([
      [5, ["box"]],
      [6, ["run"]],
    ]);
    expect(landmarks[0].label).toBe("Box end · 5 m");
  });

  it("never offers an end at or above where the record starts", () => {
    const context: LandmarkContext = { ...empty, runs: [{ fromM: 0, toM: 3 }] };
    expect(depthLandmarks(context, 3, "box")).toEqual([]);
    expect(depthLandmarks(context, 4, "box")).toEqual([]);
  });

  it("leaves out the kind being entered", () => {
    const context: LandmarkContext = {
      ...empty,
      runs: [{ fromM: 0, toM: 6 }],
      boxes: [{ fromM: 0, toM: 5 }],
    };
    expect(depthLandmarks(context, 0, "run").map((l) => l.kinds)).toEqual([["box"]]);
    expect(depthLandmarks(context, 0, "box").map((l) => l.kinds)).toEqual([["run"]]);
  });

  it("merges kinds that end at the same depth into one chip", () => {
    const context: LandmarkContext = {
      ...empty,
      runs: [{ fromM: 0, toM: 6 }],
      boxes: [{ fromM: 0, toM: 6.002 }],
    };
    const landmarks = depthLandmarks(context, 0, "interval");
    expect(landmarks).toHaveLength(1);
    expect(landmarks[0].kinds).toEqual(["run", "box"]);
    expect(landmarks[0].label).toBe("Run end / Box end · 6 m");
  });

  it("includes the hole's planned depth when it is deeper", () => {
    const context: LandmarkContext = { ...empty, plannedDepthM: 150 };
    expect(depthLandmarks(context, 148, "run")[0].label).toBe("Planned depth · 150 m");
    expect(depthLandmarks(context, 150, "run")).toEqual([]);
    expect(depthLandmarks({ ...empty, plannedDepthM: null }, 0, "run")).toEqual([]);
  });

  it("keeps the nearest few", () => {
    const context: LandmarkContext = {
      runs: [{ fromM: 0, toM: 9 }],
      boxes: [{ fromM: 0, toM: 5 }],
      intervals: [{ fromM: 0, toM: 3 }],
      samples: [{ fromM: 0, toM: 4 }],
      plannedDepthM: 150,
    };
    expect(depthLandmarks(context, 0, "run", 3).map((l) => l.depthM)).toEqual([3, 4, 5]);
    expect(depthLandmarks(context, 0, "run", 5).map((l) => l.depthM)).toEqual([3, 4, 5, 150]);
  });

  it("trims floating-point noise from the label", () => {
    const context: LandmarkContext = { ...empty, runs: [{ fromM: 0, toM: 4.2000000001 }] };
    expect(depthLandmarks(context, 0, "box")[0].label).toBe("Run end · 4.2 m");
  });

  it("returns nothing when the start depth is not a number yet", () => {
    const context: LandmarkContext = { ...empty, runs: [{ fromM: 0, toM: 3 }] };
    expect(depthLandmarks(context, Number.NaN, "box")).toEqual([]);
  });
});
