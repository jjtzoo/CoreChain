import { describe, expect, it } from "vitest";
import {
  filterSamples,
  formatSampleNumber,
  qcAchievement,
  qcReminders,
  sampleDepth,
  validateSampleInput,
  type QcEvent,
  type SampleValidationContext,
} from "./sampling";

const RATES = { standardEveryN: 3, blankEveryN: 4, duplicateEveryN: 5 };

const context = (
  overrides: Partial<SampleValidationContext> = {},
): SampleValidationContext => ({
  holeDepthM: 100,
  existingNumbers: ["CC-00001"],
  holeSamples: [
    { id: "p1", type: "primary", fromM: 0, toM: 1 },
    { id: "p2", type: "primary", fromM: 1, toM: 2 },
  ],
  ...overrides,
});

describe("formatSampleNumber", () => {
  it("pads to five digits behind the prefix", () => {
    expect(formatSampleNumber("CC", 1)).toBe("CC-00001");
    expect(formatSampleNumber("SIP", 123)).toBe("SIP-00123");
    expect(formatSampleNumber(" CC ", 99999)).toBe("CC-99999");
  });

  it("does not truncate numbers longer than five digits", () => {
    expect(formatSampleNumber("CC", 123456)).toBe("CC-123456");
  });
});

describe("validateSampleInput: any sample", () => {
  it("rejects an empty number", () => {
    const result = validateSampleInput(
      { sampleNumber: "  ", type: "blank" },
      context(),
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a number already used in the project, ignoring case", () => {
    const result = validateSampleInput(
      { sampleNumber: "cc-00001", type: "blank" },
      context(),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]?.field).toBe("sampleNumber");
    }
  });
});

describe("validateSampleInput: primary (E6-1)", () => {
  it("accepts a sample inside the hole, touching its neighbours", () => {
    expect(
      validateSampleInput(
        { sampleNumber: "CC-00002", type: "primary", fromM: 2, toM: 3 },
        context(),
      ),
    ).toEqual({ valid: true, warnings: [] });
  });

  it("rejects bad depths", () => {
    for (const [fromM, toM] of [
      [3, 3],
      [3, 2],
      [-1, 2],
      [Number.NaN, 2],
    ]) {
      expect(
        validateSampleInput(
          { sampleNumber: "CC-00002", type: "primary", fromM, toM },
          context(),
        ).valid,
      ).toBe(false);
    }
  });

  it("requires depths for a primary sample", () => {
    expect(
      validateSampleInput({ sampleNumber: "CC-00002", type: "primary" }, context()).valid,
    ).toBe(false);
  });

  it("blocks a sample that runs past the hole's depth", () => {
    const result = validateSampleInput(
      { sampleNumber: "CC-00002", type: "primary", fromM: 99, toM: 101 },
      context(),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]?.message).toContain("inside the hole's depth");
    }
  });

  it("allows a sample ending exactly at the hole's depth", () => {
    expect(
      validateSampleInput(
        { sampleNumber: "CC-00002", type: "primary", fromM: 99, toM: 100 },
        context(),
      ).valid,
    ).toBe(true);
  });

  it("blocks overlapping primary samples", () => {
    const result = validateSampleInput(
      { sampleNumber: "CC-00002", type: "primary", fromM: 1.5, toM: 2.5 },
      context(),
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors[0]?.message).toBe("Overlaps a primary sample at 1–2 m.");
    }
  });

  it("blocks a sample that contains another", () => {
    expect(
      validateSampleInput(
        { sampleNumber: "CC-00002", type: "primary", fromM: 0, toM: 5 },
        context(),
      ).valid,
    ).toBe(false);
  });

  it("ignores duplicates and QC samples when checking overlap", () => {
    const withDuplicate = context({
      holeSamples: [
        { id: "p1", type: "primary", fromM: 0, toM: 1 },
        { id: "d1", type: "duplicate", fromM: 0, toM: 1 },
      ],
    });
    expect(
      validateSampleInput(
        { sampleNumber: "CC-00002", type: "primary", fromM: 1, toM: 2 },
        withDuplicate,
      ).valid,
    ).toBe(true);
  });
});

describe("validateSampleInput: QC samples (E6-2)", () => {
  it("requires a reference material ID for a standard", () => {
    expect(
      validateSampleInput({ sampleNumber: "CC-00002", type: "standard" }, context()).valid,
    ).toBe(false);
    expect(
      validateSampleInput(
        { sampleNumber: "CC-00002", type: "standard", standardRef: "  " },
        context(),
      ).valid,
    ).toBe(false);
    expect(
      validateSampleInput(
        { sampleNumber: "CC-00002", type: "standard", standardRef: "OREAS-45e" },
        context(),
      ).valid,
    ).toBe(true);
  });

  it("needs no depth for a standard or a blank", () => {
    expect(
      validateSampleInput({ sampleNumber: "CC-00003", type: "blank" }, context()).valid,
    ).toBe(true);
  });

  it("requires a duplicate to name a primary sample in the hole", () => {
    expect(
      validateSampleInput({ sampleNumber: "CC-00002", type: "duplicate" }, context()).valid,
    ).toBe(false);
    expect(
      validateSampleInput(
        { sampleNumber: "CC-00002", type: "duplicate", parentSampleId: "nope" },
        context(),
      ).valid,
    ).toBe(false);
    expect(
      validateSampleInput(
        { sampleNumber: "CC-00002", type: "duplicate", parentSampleId: "p1" },
        context(),
      ).valid,
    ).toBe(true);
  });

  it("does not accept another QC sample as a duplicate's parent", () => {
    const ctx = context({
      holeSamples: [{ id: "b1", type: "blank", fromM: null, toM: null }],
    });
    expect(
      validateSampleInput(
        { sampleNumber: "CC-00002", type: "duplicate", parentSampleId: "b1" },
        ctx,
      ).valid,
    ).toBe(false);
  });
});

describe("sampleDepth", () => {
  it("keeps a primary's own depth", () => {
    expect(sampleDepth({ type: "primary", fromM: 1, toM: 2 }, null)).toEqual({
      fromM: 1,
      toM: 2,
    });
  });

  it("copies the parent's depth onto a duplicate", () => {
    expect(
      sampleDepth({ type: "duplicate" }, { fromM: 4, toM: 5 }),
    ).toEqual({ fromM: 4, toM: 5 });
  });

  it("gives standards and blanks no depth", () => {
    expect(sampleDepth({ type: "standard", fromM: 1, toM: 2 }, null)).toEqual({
      fromM: null,
      toM: null,
    });
  });
});

const primaries = (n: number): QcEvent[] =>
  Array.from({ length: n }, () => ({ kind: "sample", type: "primary" }));

describe("qcReminders", () => {
  it("is quiet before N primaries", () => {
    expect(qcReminders(primaries(2), RATES)).toEqual([]);
  });

  it("fires for each control once its N is reached", () => {
    const due = qcReminders(primaries(4), RATES);
    expect(due.map((d) => d.controlType)).toEqual(["standard", "blank"]);
    expect(due[0]).toEqual({ controlType: "standard", sinceLast: 4, everyN: 3 });
  });

  it("fires for all three at N primaries of the largest rate", () => {
    expect(qcReminders(primaries(5), RATES)).toHaveLength(3);
  });

  it("resets a control's count when that control is inserted", () => {
    const events: QcEvent[] = [
      ...primaries(3),
      { kind: "sample", type: "standard" },
      ...primaries(2),
    ];
    const types = qcReminders(events, RATES).map((d) => d.controlType);
    expect(types).not.toContain("standard");
    expect(types).toContain("blank");
  });

  it("counts only primaries, not other controls, towards the count", () => {
    const events: QcEvent[] = [
      ...primaries(2),
      { kind: "sample", type: "blank" },
      { kind: "sample", type: "duplicate" },
    ];
    expect(qcReminders(events, RATES)).toEqual([]);
  });

  it("restarts the count after a dismissal, then fires again after N more", () => {
    const dismissed: QcEvent[] = [
      ...primaries(3),
      { kind: "dismissal", controlType: "standard" },
    ];
    expect(qcReminders(dismissed, RATES).map((d) => d.controlType)).not.toContain(
      "standard",
    );
    expect(
      qcReminders([...dismissed, ...primaries(3)], RATES).map((d) => d.controlType),
    ).toContain("standard");
  });

  it("switches a reminder off when its rate is 0 or negative", () => {
    expect(
      qcReminders(primaries(50), {
        standardEveryN: 0,
        blankEveryN: -1,
        duplicateEveryN: 0,
      }),
    ).toEqual([]);
  });

  it("is empty with no events", () => {
    expect(qcReminders([], RATES)).toEqual([]);
  });
});

describe("qcAchievement (E6-3)", () => {
  const samples = [
    ...Array.from({ length: 10 }, () => ({ type: "primary" as const })),
    { type: "standard" as const },
    { type: "standard" as const },
    { type: "blank" as const },
  ];

  it("reports the achieved 1-per-N rate against each target", () => {
    const result = qcAchievement(samples, RATES);
    expect(result).toEqual([
      { controlType: "standard", count: 2, primaryCount: 10, achievedEveryN: 5, targetEveryN: 3 },
      { controlType: "blank", count: 1, primaryCount: 10, achievedEveryN: 10, targetEveryN: 4 },
      { controlType: "duplicate", count: 0, primaryCount: 10, achievedEveryN: null, targetEveryN: 5 },
    ]);
  });

  it("rounds to one decimal", () => {
    const result = qcAchievement(
      [...Array.from({ length: 10 }, () => ({ type: "primary" as const })),
        ...Array.from({ length: 3 }, () => ({ type: "standard" as const }))],
      RATES,
    );
    expect(result[0]?.achievedEveryN).toBe(3.3);
  });

  it("handles no samples at all", () => {
    expect(qcAchievement([], RATES).every((r) => r.achievedEveryN === null)).toBe(true);
  });
});

describe("filterSamples (E6-3)", () => {
  const samples = [
    { drillholeId: "h1", type: "primary" as const, status: "created" as const },
    { drillholeId: "h1", type: "blank" as const, status: "bagged" as const },
    { drillholeId: "h2", type: "primary" as const, status: "created" as const },
  ];

  it("matches everything with an empty filter", () => {
    expect(filterSamples(samples, {})).toHaveLength(3);
    expect(filterSamples(samples, { drillholeId: null, type: null, status: null })).toHaveLength(3);
  });

  it("filters by hole, type and status, and combines them", () => {
    expect(filterSamples(samples, { drillholeId: "h1" })).toHaveLength(2);
    expect(filterSamples(samples, { type: "primary" })).toHaveLength(2);
    expect(filterSamples(samples, { status: "bagged" })).toHaveLength(1);
    expect(filterSamples(samples, { drillholeId: "h1", type: "primary" })).toHaveLength(1);
    expect(filterSamples(samples, { drillholeId: "h2", status: "bagged" })).toEqual([]);
  });
});
