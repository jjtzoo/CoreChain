import { describe, expect, it } from "vitest";

import type { FieldCoreRun } from "./core";
import {
  buildHoleLog,
  holeLogColour,
  legendCodes,
  NO_CODE_COLOUR,
  readableTextOn,
} from "./holeLog";
import type { LogInterval } from "./logging";

const record = { createdAt: "", updatedAt: "", version: 1, deletedAt: null };

function interval(
  id: string,
  fromM: number,
  toM: number,
  extra: Partial<LogInterval> = {},
): LogInterval {
  return {
    ...record,
    id,
    drillholeId: "h1",
    fromM,
    toM,
    lithology: null,
    alterationType: null,
    alterationIntensity: null,
    mineral: null,
    mineralStyle: null,
    mineralPercent: null,
    weathering: null,
    structureType: null,
    notes: null,
    ...extra,
  };
}

function run(
  id: string,
  fromM: number,
  toM: number,
  recoveredM: number,
  rqdPiecesM: number | null,
): FieldCoreRun {
  return {
    ...record,
    id,
    drillholeId: "h1",
    fromM,
    toM,
    recoveredM,
    rqdPiecesM,
  };
}

describe("buildHoleLog (E4-6)", () => {
  it("puts intervals in depth order in every column", () => {
    const log = buildHoleLog({
      intervals: [
        interval("b", 10, 20, { lithology: "PORP" }),
        interval("a", 0, 10, { lithology: "AND" }),
      ],
      runs: [],
      depthM: 20,
    });
    expect(log.columns.lithology.map((s) => s.intervalId)).toEqual(["a", "b"]);
    expect(log.columns.alteration.map((s) => s.intervalId)).toEqual(["a", "b"]);
  });

  it("reads alteration intensity as a number and mineral percent only with a mineral", () => {
    const log = buildHoleLog({
      intervals: [
        interval("a", 0, 5, {
          alterationType: "POT",
          alterationIntensity: "3",
          mineral: "CPY",
          mineralPercent: 1.5,
        }),
        interval("b", 5, 9, {
          alterationType: "PROP",
          alterationIntensity: "strong",
          mineral: null,
          mineralPercent: 2,
        }),
      ],
      runs: [],
      depthM: 9,
    });
    expect(log.columns.alteration.map((s) => s.detail)).toEqual([3, null]);
    expect(log.columns.mineral.map((s) => s.detail)).toEqual([1.5, null]);
    expect(log.columns.mineral[1].code).toBeNull();
  });

  it("treats blank codes as nothing logged", () => {
    const log = buildHoleLog({
      intervals: [interval("a", 0, 5, { lithology: "  " })],
      runs: [],
      depthM: 5,
    });
    expect(log.columns.lithology[0].code).toBeNull();
  });

  it("ignores deleted intervals and runs", () => {
    const log = buildHoleLog({
      intervals: [
        interval("a", 0, 5, { lithology: "AND" }),
        interval("gone", 5, 9, { lithology: "DIO", deletedAt: "2026-01-01" }),
      ],
      runs: [{ ...run("r", 0, 3, 3, 3), deletedAt: "2026-01-01" }],
      depthM: 9,
    });
    expect(log.columns.lithology).toHaveLength(1);
    expect(log.runs).toHaveLength(0);
  });

  it("works out recovery and RQD for each run", () => {
    const log = buildHoleLog({
      intervals: [],
      runs: [run("r1", 0, 3, 2.7, 2.1), run("r2", 3, 6, 3, null)],
      depthM: 6,
    });
    expect(log.runs).toEqual([
      { fromM: 0, toM: 3, recoveryPercent: 90, rqdPercent: 70 },
      { fromM: 3, toM: 6, recoveryPercent: 100, rqdPercent: null },
    ]);
  });

  it("runs the picture to the deepest record when it is deeper than the hole depth", () => {
    const log = buildHoleLog({
      intervals: [interval("a", 0, 12)],
      runs: [],
      depthM: 10,
    });
    expect(log.depthM).toBe(12);
  });

  it("lists each code once for the legend, in depth order", () => {
    const log = buildHoleLog({
      intervals: [
        interval("a", 0, 5, { lithology: "AND" }),
        interval("b", 5, 9, { lithology: "PORP" }),
        interval("c", 9, 12, { lithology: "AND" }),
        interval("d", 12, 14),
      ],
      runs: [],
      depthM: 14,
    });
    expect(legendCodes(log, "lithology")).toEqual(["AND", "PORP"]);
  });
});

describe("hole log colours", () => {
  it("gives the same colour for the same code, ignoring case", () => {
    expect(holeLogColour("alteration", "pot")).toBe(
      holeLogColour("alteration", "POT"),
    );
  });

  it("colours known codes by the usual convention", () => {
    expect(holeLogColour("alteration", "POT")).toBe("#D9527A");
    expect(holeLogColour("mineral", "CPY")).toBe("#E8A317");
  });

  it("gives a code the geologist added a stable colour, and none is a code without a value", () => {
    const first = holeLogColour("lithology", "XYZ");
    expect(first).toMatch(/^#[0-9A-F]{6}$/);
    expect(holeLogColour("lithology", "XYZ")).toBe(first);
    expect(holeLogColour("lithology", null)).toBe(NO_CODE_COLOUR);
  });

  it("picks white text on dark colours and black text on light ones", () => {
    expect(readableTextOn("#2C4F7C")).toBe("#FFFFFF");
    expect(readableTextOn("#EDEDED")).toBe("#111111");
    expect(readableTextOn("#FFD400")).toBe("#111111");
  });
});
