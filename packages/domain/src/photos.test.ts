import { describe, expect, it } from "vitest";
import {
  COMPRESSION_STEPS,
  DEFAULT_PHOTO_MAX_MB,
  fitWithin,
  isValidPhotoMaxMb,
  photoFileName,
  photoLabel,
  photoMaxBytes,
} from "./photos";

const boxPhoto = {
  holeId: "DDH-01",
  subjectType: "box" as const,
  boxNumber: 3,
  fromM: 8.4,
  toM: 12,
  capturedAt: "2026-09-19T17:12:04.512Z",
};

describe("isValidPhotoMaxMb / photoMaxBytes", () => {
  it("accepts the default and sensible sizes", () => {
    expect(isValidPhotoMaxMb(DEFAULT_PHOTO_MAX_MB)).toBe(true);
    expect(isValidPhotoMaxMb(1)).toBe(true);
    expect(isValidPhotoMaxMb(2)).toBe(true);
  });

  it("accepts the range bounds and rejects outside them", () => {
    expect(isValidPhotoMaxMb(0.2)).toBe(true);
    expect(isValidPhotoMaxMb(10)).toBe(true);
    expect(isValidPhotoMaxMb(0.1)).toBe(false);
    expect(isValidPhotoMaxMb(11)).toBe(false);
  });

  it("rejects non-numbers", () => {
    expect(isValidPhotoMaxMb(Number.NaN)).toBe(false);
    expect(isValidPhotoMaxMb(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("converts megabytes to bytes", () => {
    expect(photoMaxBytes(1)).toBe(1048576);
    expect(photoMaxBytes(1.5)).toBe(1572864);
  });
});

describe("COMPRESSION_STEPS", () => {
  it("only ever shrinks: no step is larger or higher quality than the one before", () => {
    for (let i = 1; i < COMPRESSION_STEPS.length; i++) {
      const previous = COMPRESSION_STEPS[i - 1]!;
      const step = COMPRESSION_STEPS[i]!;
      expect(step.maxEdgePx).toBeLessThanOrEqual(previous.maxEdgePx);
      expect(step.quality).toBeLessThanOrEqual(previous.quality);
      expect(
        step.maxEdgePx < previous.maxEdgePx || step.quality < previous.quality,
      ).toBe(true);
    }
  });

  it("keeps every quality in the valid 0-1 range", () => {
    for (const step of COMPRESSION_STEPS) {
      expect(step.quality).toBeGreaterThan(0);
      expect(step.quality).toBeLessThanOrEqual(1);
    }
  });
});

describe("fitWithin", () => {
  it("scales the longer edge down, keeping the aspect ratio", () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(3000, 4000, 2000)).toEqual({ width: 1500, height: 2000 });
  });

  it("returns null for an image that already fits, and never enlarges", () => {
    expect(fitWithin(1000, 800, 2000)).toBeNull();
    expect(fitWithin(2000, 1000, 2000)).toBeNull();
  });

  it("never produces a zero-sized edge", () => {
    expect(fitWithin(10000, 1, 100)).toEqual({ width: 100, height: 1 });
  });

  it("returns null for degenerate input", () => {
    expect(fitWithin(0, 0, 100)).toBeNull();
    expect(fitWithin(-5, 200, 100)).toBeNull();
  });
});

describe("photoLabel", () => {
  it("labels a box photo with hole, box number and depth range", () => {
    expect(photoLabel(boxPhoto)).toBe("DDH-01 · Box 3 · 8.4–12 m");
  });

  it("labels an interval photo without a box number", () => {
    expect(
      photoLabel({ ...boxPhoto, subjectType: "interval", boxNumber: null }),
    ).toBe("DDH-01 · Interval · 8.4–12 m");
  });
});

describe("photoFileName", () => {
  it("carries the hole, box, depth range and timestamp", () => {
    expect(photoFileName(boxPhoto)).toBe(
      "DDH-01_box03_8.4-12m_20260919T171204Z.jpg",
    );
  });

  it("names an interval photo without a box", () => {
    expect(
      photoFileName({ ...boxPhoto, subjectType: "interval", boxNumber: null }),
    ).toBe("DDH-01_interval_8.4-12m_20260919T171204Z.jpg");
  });

  it("makes an unsafe hole ID filesystem-safe", () => {
    const name = photoFileName({ ...boxPhoto, holeId: "RC / 07 #2" });
    expect(name.startsWith("RC-07-2_box03_")).toBe(true);
    expect(name).not.toMatch(/[\s/\\#]/);
  });

  it("falls back when the hole ID has no usable characters", () => {
    expect(photoFileName({ ...boxPhoto, holeId: "///" }).startsWith("hole_")).toBe(
      true,
    );
  });
});
