import { describe, expect, it } from "vitest";
import {
  analyseContinuity,
  deepestRecordedDepthM,
  drilledLengthM,
  nextBoxDefaults,
  nextRunDefaults,
  recoveryPercent,
  rqdPercent,
  validateBoxInput,
  validateRunInput,
} from "./core";

describe("analyseContinuity", () => {
  it("reports nothing for back-to-back ranges", () => {
    const report = analyseContinuity([
      { fromM: 0, toM: 3 },
      { fromM: 3, toM: 6 },
      { fromM: 6, toM: 9 },
    ]);
    expect(report).toEqual({ gaps: [], overlaps: [] });
  });

  it("finds a gap between two ranges", () => {
    const report = analyseContinuity([
      { fromM: 0, toM: 3 },
      { fromM: 4.5, toM: 6 },
    ]);
    expect(report.gaps).toEqual([{ fromM: 3, toM: 4.5 }]);
    expect(report.overlaps).toEqual([]);
  });

  it("finds an overlap between two ranges", () => {
    const report = analyseContinuity([
      { fromM: 0, toM: 3 },
      { fromM: 2.5, toM: 6 },
    ]);
    expect(report.overlaps).toEqual([{ fromM: 2.5, toM: 3 }]);
    expect(report.gaps).toEqual([]);
  });

  it("does not depend on input order", () => {
    const report = analyseContinuity([
      { fromM: 6, toM: 9 },
      { fromM: 0, toM: 3 },
      { fromM: 3, toM: 6 },
    ]);
    expect(report).toEqual({ gaps: [], overlaps: [] });
  });

  it("clips an overlap to the shorter range when one range contains another", () => {
    const report = analyseContinuity([
      { fromM: 0, toM: 10 },
      { fromM: 2, toM: 4 },
    ]);
    expect(report.overlaps).toEqual([{ fromM: 2, toM: 4 }]);
  });

  it("does not flag a range behind an earlier long range as a gap", () => {
    const report = analyseContinuity([
      { fromM: 0, toM: 10 },
      { fromM: 2, toM: 4 },
      { fromM: 10, toM: 12 },
    ]);
    expect(report.gaps).toEqual([]);
  });

  it("ignores floating-point noise smaller than the tolerance", () => {
    const report = analyseContinuity([
      { fromM: 0, toM: 1.1 + 2.2 },
      { fromM: 3.3, toM: 5 },
    ]);
    expect(report).toEqual({ gaps: [], overlaps: [] });
  });

  it("never treats the start of the first range as a gap", () => {
    const report = analyseContinuity([{ fromM: 12, toM: 15 }]);
    expect(report).toEqual({ gaps: [], overlaps: [] });
  });

  it("handles no ranges and skips zero-length ranges", () => {
    expect(analyseContinuity([])).toEqual({ gaps: [], overlaps: [] });
    expect(
      analyseContinuity([
        { fromM: 0, toM: 3 },
        { fromM: 5, toM: 5 },
      ]),
    ).toEqual({ gaps: [], overlaps: [] });
  });
});

describe("drilledLengthM", () => {
  it("hides floating-point noise", () => {
    expect(drilledLengthM({ fromM: 1.1, toM: 3.3 })).toBe(2.2);
  });
});

describe("recoveryPercent", () => {
  it("is recovered divided by drilled, to 1 decimal", () => {
    expect(recoveryPercent(3, 2.9)).toBe(96.7);
    expect(recoveryPercent(3, 1.5)).toBe(50);
  });

  it("handles no recovery and full recovery", () => {
    expect(recoveryPercent(3, 0)).toBe(0);
    expect(recoveryPercent(3, 3)).toBe(100);
  });

  it("returns values above 100 unchanged so callers can flag them", () => {
    expect(recoveryPercent(3, 3.3)).toBe(110);
  });

  it("returns null when there is nothing to divide by", () => {
    expect(recoveryPercent(0, 1)).toBeNull();
    expect(recoveryPercent(-1, 1)).toBeNull();
    expect(recoveryPercent(3, -0.1)).toBeNull();
  });
});

describe("rqdPercent", () => {
  it("is pieces of 10 cm or more divided by drilled length, to 1 decimal", () => {
    expect(rqdPercent(3, 2.1)).toBe(70);
    expect(rqdPercent(3, 1)).toBe(33.3);
  });

  it("handles zero pieces and a fully sound run", () => {
    expect(rqdPercent(3, 0)).toBe(0);
    expect(rqdPercent(3, 3)).toBe(100);
  });

  it("uses drilled length, not recovered length", () => {
    // 1.5 m recovered of a 3 m run, all of it sound: RQD is 50, not 100.
    expect(rqdPercent(3, 1.5)).toBe(50);
  });

  it("returns null when there is nothing to divide by", () => {
    expect(rqdPercent(0, 0)).toBeNull();
    expect(rqdPercent(3, -1)).toBeNull();
  });
});

describe("nextBoxDefaults", () => {
  it("starts at box 1, 0 m for an empty hole", () => {
    expect(nextBoxDefaults([])).toEqual({ boxNumber: 1, fromM: 0 });
  });

  it("continues from the highest box number and deepest end depth", () => {
    expect(
      nextBoxDefaults([
        { boxNumber: 1, toM: 4.2 },
        { boxNumber: 2, toM: 8.4 },
      ]),
    ).toEqual({ boxNumber: 3, fromM: 8.4 });
  });
});

describe("validateBoxInput", () => {
  const existing = [
    { boxNumber: 1, fromM: 0, toM: 4 },
    { boxNumber: 2, fromM: 4, toM: 8 },
  ];

  it("accepts a contiguous box with no warnings", () => {
    expect(
      validateBoxInput({ boxNumber: 3, fromM: 8, toM: 12 }, existing),
    ).toEqual({ valid: true, warnings: [] });
  });

  it("rejects a duplicate box number", () => {
    const result = validateBoxInput(
      { boxNumber: 2, fromM: 8, toM: 12 },
      existing,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]?.field).toBe("boxNumber");
    }
  });

  it("rejects non-positive and fractional box numbers", () => {
    for (const boxNumber of [0, -1, 1.5]) {
      expect(
        validateBoxInput({ boxNumber, fromM: 8, toM: 12 }, existing).valid,
      ).toBe(false);
    }
  });

  it("rejects a to depth that is not greater than from", () => {
    const result = validateBoxInput(
      { boxNumber: 3, fromM: 8, toM: 8 },
      existing,
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a negative from depth and non-finite depths", () => {
    expect(
      validateBoxInput({ boxNumber: 3, fromM: -1, toM: 2 }, existing).valid,
    ).toBe(false);
    expect(
      validateBoxInput({ boxNumber: 3, fromM: Number.NaN, toM: 2 }, existing)
        .valid,
    ).toBe(false);
  });

  it("warns about an overlap but still allows saving", () => {
    const result = validateBoxInput(
      { boxNumber: 3, fromM: 7, toM: 11 },
      existing,
    );
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual(["Overlaps another box at 7–8 m."]);
  });

  it("warns about a gap next to the new box", () => {
    const result = validateBoxInput(
      { boxNumber: 3, fromM: 9, toM: 12 },
      existing,
    );
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([
      "Leaves a gap of 8–9 m next to this box.",
    ]);
  });

  it("does not warn about pre-existing gaps elsewhere in the hole", () => {
    const gappy = [
      { boxNumber: 1, fromM: 0, toM: 4 },
      { boxNumber: 2, fromM: 6, toM: 8 },
    ];
    const result = validateBoxInput({ boxNumber: 3, fromM: 8, toM: 12 }, gappy);
    expect(result).toEqual({ valid: true, warnings: [] });
  });
});

describe("nextRunDefaults", () => {
  it("starts at 0 m, then at the deepest existing run end", () => {
    expect(nextRunDefaults([])).toEqual({ fromM: 0 });
    expect(nextRunDefaults([{ toM: 3 }, { toM: 6 }])).toEqual({ fromM: 6 });
  });
});

describe("validateRunInput", () => {
  const existing = [{ fromM: 0, toM: 3 }];

  it("accepts a normal run", () => {
    expect(
      validateRunInput(
        { fromM: 3, toM: 6, recoveredM: 2.9, rqdPiecesM: 2.1 },
        existing,
      ),
    ).toEqual({ valid: true, warnings: [] });
  });

  it("accepts a run with zero recovery", () => {
    expect(
      validateRunInput({ fromM: 3, toM: 6, recoveredM: 0 }, existing),
    ).toEqual({ valid: true, warnings: [] });
  });

  it("flags recovery above the drilled length as a warning, not an error", () => {
    const result = validateRunInput(
      { fromM: 3, toM: 6, recoveredM: 3.4 },
      existing,
    );
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("more than the 3 m drilled");
  });

  it("does not warn when recovery equals the drilled length", () => {
    expect(
      validateRunInput({ fromM: 3, toM: 6, recoveredM: 3 }, existing),
    ).toEqual({ valid: true, warnings: [] });
  });

  it("rejects RQD pieces longer than the recovered core", () => {
    const result = validateRunInput(
      { fromM: 3, toM: 6, recoveredM: 2, rqdPiecesM: 2.5 },
      existing,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]?.field).toBe("rqdPiecesM");
    }
  });

  it("rejects bad depths and negative recovery", () => {
    expect(
      validateRunInput({ fromM: 3, toM: 3, recoveredM: 1 }, existing).valid,
    ).toBe(false);
    expect(
      validateRunInput({ fromM: -1, toM: 3, recoveredM: 1 }, existing).valid,
    ).toBe(false);
    expect(
      validateRunInput({ fromM: 3, toM: 6, recoveredM: -1 }, existing).valid,
    ).toBe(false);
  });

  it("warns about run overlaps and gaps like boxes", () => {
    expect(
      validateRunInput({ fromM: 2, toM: 5, recoveredM: 3 }, existing).warnings,
    ).toEqual(["Overlaps another run at 2–3 m."]);
    expect(
      validateRunInput({ fromM: 4, toM: 7, recoveredM: 3 }, existing).warnings,
    ).toEqual(["Leaves a gap of 3–4 m next to this run."]);
  });
});

describe("deepestRecordedDepthM", () => {
  it("is 0 with no records and the deepest end otherwise", () => {
    expect(deepestRecordedDepthM([])).toBe(0);
    expect(
      deepestRecordedDepthM([{ toM: 3 }, { toM: 12.5 }, { toM: 9 }]),
    ).toBe(12.5);
  });
});
