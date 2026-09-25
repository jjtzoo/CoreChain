import { describe, expect, it } from "vitest";

import {
  formatShare,
  intensityWord,
  lithologyDictionary,
  lithologyReference,
  rockUnits,
} from "./lithology";
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

// The top of the synthetic Cordillera hole CDL-001.
const cdl001 = [
  interval("a", 0, 2.5, { lithology: "OVB" }),
  interval("b", 2.5, 14, { lithology: "AND", alterationType: "ARG", alterationIntensity: "3", mineral: "PY", mineralPercent: 1 }),
  interval("c", 14, 31.5, { lithology: "and", alterationType: "ARG", alterationIntensity: "2", mineral: "PY", mineralPercent: 2 }),
  interval("d", 31.5, 48, { lithology: "AND", alterationType: "PHY", alterationIntensity: "2", mineral: "PY", mineralPercent: 3 }),
  interval("e", 48, 75.2, { lithology: "PORP", alterationType: "PHY", alterationIntensity: "3", mineral: "PY", mineralPercent: 4 }),
  interval("f", 75.2, 118, { lithology: "PORP", alterationType: "POT", alterationIntensity: "2", mineral: "CPY", mineralPercent: 1.5 }),
];

describe("rockUnits", () => {
  it("merges touching intervals of the same rock, ignoring case", () => {
    const units = rockUnits(cdl001);
    expect(units.map((u) => [u.lithology, u.fromM, u.toM, u.intervalIds.length])).toEqual([
      ["OVB", 0, 2.5, 1],
      ["AND", 2.5, 48, 3],
      ["PORP", 48, 118, 2],
    ]);
  });

  it("weights alteration, intensity and minerals by length", () => {
    const andesite = rockUnits(cdl001)[1]!;
    expect(andesite.lengthM).toBeCloseTo(45.5, 6);
    expect(andesite.alteration.map((a) => [a.code, a.share])).toEqual([
      ["ARG", 29 / 45.5],
      ["PHY", 16.5 / 45.5],
    ]);
    expect(andesite.meanIntensity).toBeCloseTo((3 * 11.5 + 2 * 17.5 + 2 * 16.5) / 45.5, 6);
    expect(andesite.minerals).toHaveLength(1);
    expect(andesite.minerals[0]!.meanPercent).toBeCloseTo((1 * 11.5 + 2 * 17.5 + 3 * 16.5) / 45.5, 6);
    expect(intensityWord(andesite.meanIntensity)).toBe("moderate");
  });

  it("splits on alteration in the finer mode", () => {
    const units = rockUnits(cdl001, "lithology_alteration");
    expect(units.map((u) => `${u.lithology}/${u.alterationType ?? "-"}`)).toEqual([
      "OVB/-",
      "AND/ARG",
      "AND/PHY",
      "PORP/PHY",
      "PORP/POT",
    ]);
  });

  it("ends a unit at a gap, at an interval with no rock, and at the end of a hole", () => {
    const units = rockUnits([
      interval("a", 0, 10, { lithology: "AND" }),
      interval("b", 12, 20, { lithology: "AND" }),
      interval("c", 20, 25),
      interval("d", 25, 30, { lithology: "AND" }),
      interval("e", 0, 5, { lithology: "AND", drillholeId: "h2" }),
      interval("x", 30, 35, { lithology: "AND", deletedAt: "2026-09-25T00:00:00Z" }),
    ]);
    expect(units.map((u) => `${u.drillholeId} ${u.fromM}-${u.toM}`)).toEqual([
      "h1 0-10",
      "h1 12-20",
      "h1 25-30",
      "h2 0-5",
    ]);
  });
});

describe("lithologyDictionary", () => {
  const dictionary = lithologyDictionary([
    ...cdl001,
    interval("g", 0, 30, { drillholeId: "h2", lithology: "PORP", alterationType: "POT", mineral: "CPY", mineralPercent: 2.5 }),
  ]);

  it("lists each rock type, most logged first, with its share", () => {
    expect(dictionary.loggedM).toBeCloseTo(148, 6);
    expect(dictionary.entries.map((e) => [e.code, e.lengthM, e.holeCount, e.unitCount])).toEqual([
      ["PORP", 100, 2, 2],
      ["AND", 45.5, 1, 1],
      ["OVB", 2.5, 1, 1],
    ]);
    expect(formatShare(dictionary.entries[0]!.share)).toBe("68%");
    expect(formatShare(0.001)).toBe("<1%");
  });

  it("says where a rock type sits, its thickest unit, and its usual character", () => {
    const porphyry = dictionary.entries[0]!;
    expect([porphyry.topM, porphyry.bottomM]).toEqual([0, 118]);
    expect([porphyry.thickest.drillholeId, porphyry.thickest.lengthM]).toEqual(["h1", 70]);
    expect(porphyry.alteration.map((a) => a.code)).toEqual(["POT", "PHY"]);
    expect(porphyry.alteration[0]!.share).toBeCloseTo(72.8 / 100, 6);
    const chalcopyrite = porphyry.minerals.find((m) => m.code === "CPY")!;
    expect(chalcopyrite.lengthM).toBeCloseTo(72.8, 6);
    expect(chalcopyrite.meanPercent).toBeCloseTo((1.5 * 42.8 + 2.5 * 30) / 72.8, 6);
  });

  it("is empty for a project with nothing logged", () => {
    expect(lithologyDictionary([])).toEqual({ loggedM: 0, entries: [] });
  });
});

describe("lithologyReference", () => {
  it("knows the starter codes and nothing else", () => {
    expect(lithologyReference(" porp ")!.group).toBe("intrusive");
    expect(lithologyReference("XYZ")).toBeNull();
  });
});
