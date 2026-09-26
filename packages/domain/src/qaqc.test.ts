import { describe, expect, it } from "vitest";
import {
  coreLoggingExceptions,
  deviceStaleExceptions,
  exceptionKeyInStage,
  exceptionKindFromKey,
  isQaqcDecision,
  openExceptions,
  samplingCustodyExceptions,
  type HoleRunsInput,
  type HoleSamplesInput,
} from "./qaqc";

describe("coreLoggingExceptions", () => {
  const hole: HoleRunsInput = {
    drillholeId: "h1",
    holeId: "DDH-01",
    runs: [
      { fromM: 0, toM: 3, recoveredM: 2.9 },
      { fromM: 3.5, toM: 6, recoveredM: 2.4 },
      { fromM: 6, toM: 8, recoveredM: 2.5 },
    ],
  };

  it("flags a gap between runs", () => {
    const exceptions = coreLoggingExceptions([hole]);
    const gap = exceptions.find((e) => e.kind === "run_gap");
    expect(gap?.summary).toBe("Gap between runs at 3–3.5 m");
    expect(gap?.key).toBe("run_gap:h1:3-3.5");
  });

  it("flags an overlap between runs", () => {
    const overlapping: HoleRunsInput = {
      drillholeId: "h2",
      holeId: "DDH-02",
      runs: [
        { fromM: 0, toM: 5, recoveredM: 4.8 },
        { fromM: 4, toM: 8, recoveredM: 3.9 },
      ],
    };
    const exceptions = coreLoggingExceptions([overlapping]);
    expect(exceptions.some((e) => e.kind === "run_overlap")).toBe(true);
  });

  it("flags recovery over 100% and gives the recovered and drilled lengths", () => {
    const over: HoleRunsInput = {
      drillholeId: "h3",
      holeId: "DDH-03",
      runs: [{ fromM: 0, toM: 2, recoveredM: 2.5 }],
    };
    const exceptions = coreLoggingExceptions([over]);
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]!.kind).toBe("recovery_over_100");
    expect(exceptions[0]!.summary).toContain("125%");
  });

  it("has no exceptions for continuous runs at or under 100% recovery", () => {
    const clean: HoleRunsInput = {
      drillholeId: "h4",
      holeId: "DDH-04",
      runs: [
        { fromM: 0, toM: 3, recoveredM: 3 },
        { fromM: 3, toM: 6, recoveredM: 2.9 },
      ],
    };
    expect(coreLoggingExceptions([clean])).toHaveLength(0);
  });
});

describe("samplingCustodyExceptions", () => {
  const rates = { standardEveryN: 20, blankEveryN: 20, duplicateEveryN: 20 };
  const now = new Date("2026-09-22T00:00:00Z");

  it("flags a QC control rate short of target", () => {
    const hole: HoleSamplesInput = {
      drillholeId: "h1",
      holeId: "DDH-01",
      samples: Array.from({ length: 21 }, (_, i) => ({
        id: `s${i}`,
        sampleNumber: `SIP-${i}`,
        type: "primary" as const,
        status: "dispatched" as const,
        createdAt: "2026-09-01T00:00:00Z",
      })),
      qcRates: rates,
    };
    const exceptions = samplingCustodyExceptions([hole], {
      now,
      staleAfterDays: 14,
    });
    expect(
      exceptions.filter((e) => e.kind === "qc_rate_short"),
    ).toHaveLength(3);
  });

  it("does not flag a rate that is met", () => {
    const samples: HoleSamplesInput["samples"][number][] = Array.from(
      { length: 20 },
      (_, i) => ({
        id: `p${i}`,
        sampleNumber: `SIP-${i}`,
        type: "primary" as const,
        status: "dispatched" as const,
        createdAt: "2026-09-01T00:00:00Z",
      }),
    );
    samples.push({
      id: "std1",
      sampleNumber: "SIP-STD1",
      type: "standard" as const,
      status: "dispatched" as const,
      createdAt: "2026-09-01T00:00:00Z",
    });
    const hole: HoleSamplesInput = {
      drillholeId: "h1",
      holeId: "DDH-01",
      samples,
      qcRates: { standardEveryN: 20, blankEveryN: 0, duplicateEveryN: 0 },
    };
    const exceptions = samplingCustodyExceptions([hole], {
      now,
      staleAfterDays: 14,
    });
    expect(exceptions.filter((e) => e.kind === "qc_rate_short")).toHaveLength(
      0,
    );
  });

  it("flags primary samples that overlap, once per pair, and not ones end to end", () => {
    const primary = (id: string, fromM: number, toM: number) => ({
      id,
      sampleNumber: id.toUpperCase(),
      type: "primary" as const,
      status: "dispatched" as const,
      createdAt: "2026-09-20T00:00:00Z",
      fromM,
      toM,
    });
    const hole: HoleSamplesInput = {
      drillholeId: "h1",
      holeId: "DDH-01",
      samples: [
        primary("a", 0, 1),
        primary("b", 1, 2),
        primary("c", 1.5, 2.5),
        { ...primary("s", 0, 0), type: "standard", fromM: null, toM: null },
      ],
      qcRates: { standardEveryN: 0, blankEveryN: 0, duplicateEveryN: 0 },
    };
    const overlaps = samplingCustodyExceptions([hole], {
      now,
      staleAfterDays: 14,
    }).filter((e) => e.kind === "sample_overlap");
    expect(overlaps.map((e) => [e.key, e.summary])).toEqual([
      ["sample_overlap:b:c", "B and C overlap at 1.5–2 m"],
    ]);
  });

  it("flags a sample stalled before dispatch past the threshold", () => {
    const hole: HoleSamplesInput = {
      drillholeId: "h1",
      holeId: "DDH-01",
      samples: [
        {
          id: "s1",
          sampleNumber: "SIP-00001",
          type: "primary",
          status: "bagged",
          createdAt: "2026-08-01T00:00:00Z",
        },
      ],
      qcRates: { standardEveryN: 0, blankEveryN: 0, duplicateEveryN: 0 },
    };
    const exceptions = samplingCustodyExceptions([hole], {
      now,
      staleAfterDays: 14,
    });
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]!.kind).toBe("custody_stalled");
  });

  it("does not flag a dispatched sample regardless of age", () => {
    const hole: HoleSamplesInput = {
      drillholeId: "h1",
      holeId: "DDH-01",
      samples: [
        {
          id: "s1",
          sampleNumber: "SIP-00001",
          type: "primary",
          status: "dispatched",
          createdAt: "2026-01-01T00:00:00Z",
        },
      ],
      qcRates: { standardEveryN: 0, blankEveryN: 0, duplicateEveryN: 0 },
    };
    expect(
      samplingCustodyExceptions([hole], { now, staleAfterDays: 14 }),
    ).toHaveLength(0);
  });
});

describe("deviceStaleExceptions", () => {
  const now = new Date("2026-09-22T00:00:00Z");

  it("flags a device quiet past the threshold", () => {
    const exceptions = deviceStaleExceptions(
      [{ deviceId: "d1", name: "Field tablet", lastSeenAt: "2026-08-01T00:00:00Z" }],
      { now, staleAfterDays: 21 },
    );
    expect(exceptions).toHaveLength(1);
    expect(exceptions[0]!.summary).toContain("Field tablet");
  });

  it("does not flag a device with no sync history or within the threshold", () => {
    const exceptions = deviceStaleExceptions(
      [
        { deviceId: "d1", name: "Never synced", lastSeenAt: null },
        { deviceId: "d2", name: "Recent", lastSeenAt: "2026-09-20T00:00:00Z" },
      ],
      { now, staleAfterDays: 21 },
    );
    expect(exceptions).toHaveLength(0);
  });
});

describe("openExceptions", () => {
  it("drops exceptions whose key is already resolved", () => {
    const exceptions = coreLoggingExceptions([
      {
        drillholeId: "h1",
        holeId: "DDH-01",
        runs: [
          { fromM: 0, toM: 2, recoveredM: 1 },
          { fromM: 3, toM: 5, recoveredM: 1.5 },
        ],
      },
    ]);
    expect(exceptions).toHaveLength(1);
    const resolved = openExceptions(exceptions, {
      resolvedKeys: new Set([exceptions[0]!.key]),
    });
    expect(resolved).toHaveLength(0);
  });
});

describe("exceptionKindFromKey", () => {
  it("extracts the kind from a well-formed key", () => {
    expect(exceptionKindFromKey("run_gap:h1:3-3.5")).toBe("run_gap");
    expect(exceptionKindFromKey("custody_stalled:s1")).toBe(
      "custody_stalled",
    );
    expect(exceptionKindFromKey("device_stale:d1")).toBe("device_stale");
  });

  it("returns null for an unknown or malformed key", () => {
    expect(exceptionKindFromKey("not_a_real_kind:h1")).toBeNull();
    expect(exceptionKindFromKey("no-colon-here")).toBeNull();
  });
});

describe("exceptionKeyInStage", () => {
  it("keeps each stage's own exceptions on that stage's page", () => {
    expect(exceptionKeyInStage("run_gap:h1:3-3.5", "core_logging")).toBe(true);
    expect(exceptionKeyInStage("run_gap:h1:3-3.5", "laboratory_assays")).toBe(false);
    expect(exceptionKeyInStage("blank_failed:s1:cu:85", "laboratory_assays")).toBe(true);
    expect(exceptionKeyInStage("custody_stalled:s1", "core_logging")).toBe(false);
  });

  it("shows a quiet device and an unknown key on every page", () => {
    expect(exceptionKeyInStage("device_stale:d1", "sampling_custody")).toBe(true);
    expect(exceptionKeyInStage("not_a_real_kind:h1", "core_logging")).toBe(true);
  });
});

describe("isQaqcDecision", () => {
  it("accepts only the known decisions", () => {
    expect(isQaqcDecision("accept")).toBe(true);
    expect(isQaqcDecision("hold")).toBe(true);
    expect(isQaqcDecision("reject")).toBe(true);
    expect(isQaqcDecision("maybe")).toBe(false);
    expect(isQaqcDecision(undefined)).toBe(false);
  });
});

describe("coreLoggingExceptions: run past the final depth", () => {
  it("flags a run ending deeper than the hole's final depth", () => {
    const exceptions = coreLoggingExceptions([
      {
        drillholeId: "h9",
        holeId: "DDH-09",
        actualFinalDepthM: 5,
        runs: [
          { fromM: 0, toM: 3, recoveredM: 2.9 },
          { fromM: 3, toM: 6, recoveredM: 2.9 },
        ],
      },
    ]);
    expect(exceptions.map((e) => [e.kind, e.key])).toEqual([
      ["run_past_final_depth", "run_past_final_depth:h9:3-6:5"],
    ]);
    expect(exceptionKindFromKey("run_past_final_depth:h9:3-6:5")).toBe("run_past_final_depth");
  });
});
