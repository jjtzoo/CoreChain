import { describe, expect, it } from "vitest";
import {
  CODE_CATEGORIES,
  continuityStrip,
  copyIntervalCodes,
  isCodeInUse,
  loggedLengthM,
  nextIntervalDefaults,
  STARTER_CODES,
  validateCodeInput,
  validateIntervalInput,
  visibleCodes,
  type IntervalCodes,
} from "./logging";

const NO_CODES: IntervalCodes = {
  lithology: null,
  alterationType: null,
  alterationIntensity: null,
  mineral: null,
  mineralStyle: null,
  mineralPercent: null,
  weathering: null,
  structureType: null,
};

describe("STARTER_CODES (E4-1)", () => {
  it("covers every category the story lists", () => {
    for (const category of CODE_CATEGORIES) {
      expect(STARTER_CODES.some((c) => c.category === category)).toBe(true);
    }
  });

  it("gives every code a short code and a description", () => {
    for (const entry of STARTER_CODES) {
      expect(entry.code.trim()).not.toBe("");
      expect(entry.code.length).toBeLessThanOrEqual(12);
      expect(entry.description.trim()).not.toBe("");
    }
  });

  it("has no duplicate code within a category", () => {
    const seen = new Set<string>();
    for (const entry of STARTER_CODES) {
      const key = `${entry.category}:${entry.code.toLowerCase()}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("includes the story's example: AND is Andesite", () => {
    expect(
      STARTER_CODES.find((c) => c.category === "lithology" && c.code === "AND")
        ?.description,
    ).toBe("Andesite");
  });
});

describe("validateCodeInput (E4-2)", () => {
  const existing = [{ category: "lithology" as const, code: "AND" }];

  it("accepts a new code", () => {
    expect(
      validateCodeInput(
        { category: "lithology", code: "RHY", description: "Rhyolite" },
        existing,
      ),
    ).toEqual({ valid: true, warnings: [] });
  });

  it("rejects an empty or over-long code", () => {
    expect(
      validateCodeInput({ category: "lithology", code: "  ", description: "x" }, existing).valid,
    ).toBe(false);
    expect(
      validateCodeInput(
        { category: "lithology", code: "ABCDEFGHIJKLM", description: "x" },
        existing,
      ).valid,
    ).toBe(false);
  });

  it("rejects a duplicate in the same category, ignoring case", () => {
    const result = validateCodeInput(
      { category: "lithology", code: "and", description: "dupe" },
      existing,
    );
    expect(result.valid).toBe(false);
  });

  it("allows the same code in a different category", () => {
    expect(
      validateCodeInput(
        { category: "alteration_type", code: "AND", description: "x" },
        existing,
      ).valid,
    ).toBe(true);
  });
});

describe("visibleCodes (E4-2)", () => {
  it("drops hidden codes and sorts by code, numbers naturally", () => {
    const codes = [
      { category: "alteration_intensity" as const, code: "10", hidden: false },
      { category: "alteration_intensity" as const, code: "2", hidden: false },
      { category: "alteration_intensity" as const, code: "1", hidden: true },
      { category: "lithology" as const, code: "AND", hidden: false },
    ];
    expect(visibleCodes(codes, "alteration_intensity").map((c) => c.code)).toEqual([
      "2",
      "10",
    ]);
  });
});

describe("nextIntervalDefaults (E4-3)", () => {
  it("starts at 0 m, then at the deepest existing interval end", () => {
    expect(nextIntervalDefaults([])).toEqual({ fromM: 0 });
    expect(nextIntervalDefaults([{ toM: 4 }, { toM: 9 }])).toEqual({ fromM: 9 });
  });
});

describe("validateIntervalInput (E4-3, E4-4)", () => {
  const existing = [{ fromM: 0, toM: 5 }];

  it("accepts a contiguous interval", () => {
    expect(validateIntervalInput({ fromM: 5, toM: 9 }, existing)).toEqual({
      valid: true,
      warnings: [],
    });
  });

  it("rejects bad depths", () => {
    expect(validateIntervalInput({ fromM: 5, toM: 5 }, existing).valid).toBe(false);
    expect(validateIntervalInput({ fromM: -1, toM: 2 }, existing).valid).toBe(false);
    expect(validateIntervalInput({ fromM: Number.NaN, toM: 2 }, existing).valid).toBe(false);
  });

  it("rejects a mineral % outside 0-100 but accepts the bounds", () => {
    expect(
      validateIntervalInput({ fromM: 5, toM: 9, mineralPercent: 101 }, existing).valid,
    ).toBe(false);
    expect(
      validateIntervalInput({ fromM: 5, toM: 9, mineralPercent: -1 }, existing).valid,
    ).toBe(false);
    expect(
      validateIntervalInput({ fromM: 5, toM: 9, mineralPercent: 0 }, existing).valid,
    ).toBe(true);
    expect(
      validateIntervalInput({ fromM: 5, toM: 9, mineralPercent: 100 }, existing).valid,
    ).toBe(true);
  });

  it("warns about overlaps and gaps but allows saving", () => {
    const overlap = validateIntervalInput({ fromM: 4, toM: 8 }, existing);
    expect(overlap.valid).toBe(true);
    expect(overlap.warnings).toEqual(["Overlaps another interval at 4–5 m."]);

    const gap = validateIntervalInput({ fromM: 6, toM: 8 }, existing);
    expect(gap.valid).toBe(true);
    expect(gap.warnings).toEqual(["Leaves a gap of 5–6 m next to this interval."]);
  });
});

describe("copyIntervalCodes (E4-5)", () => {
  it("copies every code and drops depths and free text", () => {
    const previous = {
      ...NO_CODES,
      lithology: "AND",
      alterationType: "PROP",
      alterationIntensity: "2",
      mineral: "PY",
      mineralStyle: "DISS",
      mineralPercent: 3,
      weathering: "SW",
      structureType: "VEIN",
      fromM: 5,
      toM: 9,
      notes: "vuggy",
    };
    const copied = copyIntervalCodes(previous);
    expect(copied).toEqual({
      lithology: "AND",
      alterationType: "PROP",
      alterationIntensity: "2",
      mineral: "PY",
      mineralStyle: "DISS",
      mineralPercent: 3,
      weathering: "SW",
      structureType: "VEIN",
    });
    expect(copied).not.toHaveProperty("fromM");
    expect(copied).not.toHaveProperty("toM");
    expect(copied).not.toHaveProperty("notes");
  });
});

describe("isCodeInUse (E4-2)", () => {
  const intervals = [{ ...NO_CODES, lithology: "AND", weathering: "sw" }];

  it("finds a code used by an interval in the matching category", () => {
    expect(isCodeInUse("lithology", "AND", intervals)).toBe(true);
  });

  it("ignores case and surrounding spaces", () => {
    expect(isCodeInUse("weathering", " SW ", intervals)).toBe(true);
    expect(isCodeInUse("lithology", "and", intervals)).toBe(true);
  });

  it("is per category: AND as an alteration code is not in use", () => {
    expect(isCodeInUse("alteration_type", "AND", intervals)).toBe(false);
  });

  it("is false for an unused code and for no intervals", () => {
    expect(isCodeInUse("lithology", "BAS", intervals)).toBe(false);
    expect(isCodeInUse("lithology", "AND", [])).toBe(false);
  });
});

describe("loggedLengthM", () => {
  it("sums contiguous and separate intervals", () => {
    expect(
      loggedLengthM([
        { fromM: 0, toM: 5 },
        { fromM: 5, toM: 9 },
        { fromM: 12, toM: 14 },
      ]),
    ).toBe(11);
  });

  it("counts an overlapped stretch once", () => {
    expect(
      loggedLengthM([
        { fromM: 0, toM: 6 },
        { fromM: 4, toM: 10 },
      ]),
    ).toBe(10);
  });

  it("counts a contained interval once and handles unsorted input", () => {
    expect(
      loggedLengthM([
        { fromM: 2, toM: 4 },
        { fromM: 0, toM: 10 },
      ]),
    ).toBe(10);
  });

  it("is 0 with no intervals and ignores zero-length ones", () => {
    expect(loggedLengthM([])).toBe(0);
    expect(loggedLengthM([{ fromM: 3, toM: 3 }])).toBe(0);
  });

  it("hides floating-point noise", () => {
    expect(loggedLengthM([{ fromM: 1.1, toM: 3.3 }])).toBe(2.2);
  });
});

describe("continuityStrip (E4-4)", () => {
  it("returns logged segments plus gaps and overlaps", () => {
    const strip = continuityStrip([
      { fromM: 0, toM: 5 },
      { fromM: 4, toM: 8 },
      { fromM: 10, toM: 12 },
    ]);
    expect(strip.filter((s) => s.kind === "logged")).toHaveLength(3);
    expect(strip.filter((s) => s.kind === "gap")).toEqual([
      { kind: "gap", fromM: 8, toM: 10 },
    ]);
    expect(strip.filter((s) => s.kind === "overlap")).toEqual([
      { kind: "overlap", fromM: 4, toM: 5 },
    ]);
  });

  it("orders overlaps after logged segments so they draw on top", () => {
    const strip = continuityStrip([
      { fromM: 0, toM: 5 },
      { fromM: 4, toM: 8 },
    ]);
    const kinds = strip.map((s) => s.kind);
    expect(kinds.lastIndexOf("logged")).toBeLessThan(kinds.indexOf("overlap"));
  });

  it("is empty with nothing logged", () => {
    expect(continuityStrip([])).toEqual([]);
  });
});
