import { describe, expect, it } from "vitest";
import {
  actualDepthWarning,
  isValidAzimuthDeg,
  isValidInclinationDeg,
  loggingProgress,
  matchesDrillholeSearch,
  validateDrillholeInput,
  validateProjectInput,
} from "./field";

describe("isValidAzimuthDeg", () => {
  it("accepts the full 0-360 range", () => {
    expect(isValidAzimuthDeg(0)).toBe(true);
    expect(isValidAzimuthDeg(360)).toBe(true);
    expect(isValidAzimuthDeg(180.5)).toBe(true);
  });

  it("rejects out-of-range and non-finite values", () => {
    expect(isValidAzimuthDeg(-1)).toBe(false);
    expect(isValidAzimuthDeg(360.1)).toBe(false);
    expect(isValidAzimuthDeg(Number.NaN)).toBe(false);
  });
});

describe("isValidInclinationDeg", () => {
  it("accepts the full -90 to 90 range", () => {
    expect(isValidInclinationDeg(-90)).toBe(true);
    expect(isValidInclinationDeg(0)).toBe(true);
    expect(isValidInclinationDeg(90)).toBe(true);
  });

  it("rejects out-of-range values", () => {
    expect(isValidInclinationDeg(-90.1)).toBe(false);
    expect(isValidInclinationDeg(90.1)).toBe(false);
  });
});

describe("validateProjectInput", () => {
  it("passes with just a name and coordinate system", () => {
    const result = validateProjectInput({
      name: "Sipalay Gold Prospect",
      coordinateSystem: "WGS84",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a blank or whitespace-only name", () => {
    const result = validateProjectInput({
      name: "   ",
      coordinateSystem: "WGS84",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((e) => e.field)).toContain("name");
    }
  });

  it("rejects an unknown coordinate system", () => {
    const result = validateProjectInput({
      name: "Sipalay Gold Prospect",
      // @ts-expect-error deliberately invalid input, as a bad import or old client might send
      coordinateSystem: "NAD27",
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((e) => e.field)).toContain("coordinateSystem");
    }
  });

  it("rejects a non-positive next sample number", () => {
    const result = validateProjectInput({
      name: "Sipalay Gold Prospect",
      coordinateSystem: "WGS84",
      nextSampleNumber: 0,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((e) => e.field)).toContain("nextSampleNumber");
    }
  });
});

describe("validateDrillholeInput", () => {
  const baseInput = { holeId: "DDH-01", plannedDepthM: 120 };

  it("passes with just a hole ID and planned depth", () => {
    const result = validateDrillholeInput(baseInput, []);
    expect(result.valid).toBe(true);
  });

  it("rejects a blank hole ID", () => {
    const result = validateDrillholeInput(
      { ...baseInput, holeId: "  " },
      [],
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((e) => e.field)).toContain("holeId");
    }
  });

  it("rejects a hole ID that already exists, case-insensitively", () => {
    const result = validateDrillholeInput(baseInput, ["ddh-01", "DDH-02"]);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.map((e) => e.field)).toContain("holeId");
    }
  });

  it("allows the same hole ID text in a different project's existing list", () => {
    // existingHoleIds is caller-scoped to one project; a fresh list means no conflict
    const result = validateDrillholeInput(baseInput, []);
    expect(result.valid).toBe(true);
  });

  it("rejects a zero or negative planned depth", () => {
    expect(
      validateDrillholeInput({ ...baseInput, plannedDepthM: 0 }, []).valid,
    ).toBe(false);
    expect(
      validateDrillholeInput({ ...baseInput, plannedDepthM: -5 }, []).valid,
    ).toBe(false);
  });

  it("rejects an out-of-range azimuth or inclination when given", () => {
    expect(
      validateDrillholeInput(
        { ...baseInput, plannedAzimuthDeg: 400 },
        [],
      ).valid,
    ).toBe(false);
    expect(
      validateDrillholeInput(
        { ...baseInput, plannedInclinationDeg: -95 },
        [],
      ).valid,
    ).toBe(false);
  });

  it("allows azimuth and inclination to be omitted", () => {
    const result = validateDrillholeInput(
      { ...baseInput, plannedAzimuthDeg: null, plannedInclinationDeg: null },
      [],
    );
    expect(result.valid).toBe(true);
  });
});

describe("actualDepthWarning", () => {
  it("warns when the actual final depth is shallower than what's already recorded", () => {
    expect(actualDepthWarning(80, 95)).toMatch(/shallower/);
  });

  it("does not warn when the actual final depth reaches or exceeds what's recorded", () => {
    expect(actualDepthWarning(95, 95)).toBeNull();
    expect(actualDepthWarning(120, 95)).toBeNull();
  });
});

describe("loggingProgress", () => {
  it("uses the actual final depth once it's recorded", () => {
    expect(
      loggingProgress(60, { actualFinalDepthM: 120, plannedDepthM: 100 }),
    ).toBeCloseTo(0.5);
  });

  it("falls back to the planned depth before the actual is recorded", () => {
    expect(
      loggingProgress(50, { actualFinalDepthM: null, plannedDepthM: 100 }),
    ).toBeCloseTo(0.5);
  });

  it("clamps to 1 when logged metres exceed the reference depth", () => {
    expect(
      loggingProgress(150, { actualFinalDepthM: null, plannedDepthM: 100 }),
    ).toBe(1);
  });

  it("returns 0 for a hole with no usable reference depth", () => {
    expect(
      loggingProgress(10, { actualFinalDepthM: null, plannedDepthM: 0 }),
    ).toBe(0);
  });
});

describe("matchesDrillholeSearch", () => {
  it("matches a case-insensitive substring", () => {
    expect(matchesDrillholeSearch({ holeId: "DDH-01" }, "ddh")).toBe(true);
    expect(matchesDrillholeSearch({ holeId: "DDH-01" }, "01")).toBe(true);
  });

  it("treats a blank query as matching everything", () => {
    expect(matchesDrillholeSearch({ holeId: "DDH-01" }, "  ")).toBe(true);
  });

  it("returns false for a non-matching query", () => {
    expect(matchesDrillholeSearch({ holeId: "DDH-01" }, "XYZ")).toBe(false);
  });
});
