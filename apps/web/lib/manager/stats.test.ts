import { describe, expect, it } from "vitest";
import {
  averageTurnaroundDays,
  compareDispatchesForManager,
  dispatchState,
  drilledDepthM,
  formatDay,
  metresDrilledBetween,
  percentOf,
  qcInsertion,
  reportPeriodStart,
  standingDecisions,
  toReportPeriod,
} from "./stats";

const now = new Date("2026-09-27T08:00:00Z");

describe("drilledDepthM", () => {
  it("uses the recorded final depth", () => {
    expect(drilledDepthM({ actualFinalDepthM: 302.5, runs: [{ toM: 120 }] })).toBe(302.5);
  });
  it("falls back to the deepest run, then 0", () => {
    expect(drilledDepthM({ actualFinalDepthM: null, runs: [{ toM: 12 }, { toM: 170 }] })).toBe(170);
    expect(drilledDepthM({ actualFinalDepthM: null, runs: [] })).toBe(0);
  });
});

describe("metresDrilledBetween", () => {
  it("adds the runs recorded in the window only", () => {
    const runs = [
      { fromM: 0, toM: 3, createdAt: new Date("2026-09-19T10:00:00Z") },
      { fromM: 3, toM: 6, createdAt: new Date("2026-09-21T10:00:00Z") },
      { fromM: 6, toM: 7.5, createdAt: new Date("2026-09-26T10:00:00Z") },
    ];
    expect(metresDrilledBetween(runs, new Date("2026-09-20T08:00:00Z"), now)).toBe(4.5);
  });
});

describe("percentOf", () => {
  it("caps at 100 and handles no total", () => {
    expect(percentOf(1012.5, 1672.5)).toBe(61);
    expect(percentOf(320, 300)).toBe(100);
    expect(percentOf(5, 0)).toBe(0);
  });
});

describe("dispatchState", () => {
  const base = { createdAt: new Date("2026-09-10T02:00:00Z"), resultsReturnedAt: null };

  it("counts days at the laboratory from the hand-over day", () => {
    expect(dispatchState({ ...base, status: "dispatched", handoverAt: "2026-09-11" }, now)).toEqual({
      kind: "waiting",
      days: 16,
      overdue: true,
    });
  });

  it("is not overdue at exactly 14 days", () => {
    expect(dispatchState({ ...base, status: "dispatched", handoverAt: "2026-09-13" }, now)).toEqual({
      kind: "waiting",
      days: 14,
      overdue: false,
    });
  });

  it("uses the creation time when no hand-over day was chosen", () => {
    const state = dispatchState({ ...base, status: "dispatched", handoverAt: null }, now);
    expect(state).toEqual({ kind: "waiting", days: 17, overdue: true });
  });

  it("stops the clock when results came back", () => {
    const state = dispatchState(
      {
        ...base,
        status: "dispatched",
        handoverAt: "2026-09-09",
        resultsReturnedAt: new Date("2026-09-21T09:00:00Z"),
      },
      now,
    );
    expect(state).toEqual({ kind: "returned", days: 12 });
  });

  it("treats a dispatch still being put together as open", () => {
    expect(dispatchState({ ...base, status: "open", handoverAt: null }, now)).toEqual({ kind: "open" });
  });
});

describe("averageTurnaroundDays", () => {
  it("averages returned dispatches only", () => {
    expect(
      averageTurnaroundDays([
        { kind: "returned", days: 14 },
        { kind: "returned", days: 12 },
        { kind: "waiting", days: 30, overdue: true },
      ]),
    ).toBe(13);
    expect(averageTurnaroundDays([{ kind: "open" }])).toBeNull();
  });
});

describe("compareDispatchesForManager", () => {
  it("lists the longest waiting first, then open, then newest returned", () => {
    const rows = [
      { id: "back-old", state: { kind: "returned", days: 14 }, returnedAt: new Date("2026-09-16") },
      { id: "open", state: { kind: "open" }, returnedAt: null },
      { id: "wait-7", state: { kind: "waiting", days: 7, overdue: false }, returnedAt: null },
      { id: "back-new", state: { kind: "returned", days: 12 }, returnedAt: new Date("2026-09-21") },
      { id: "wait-16", state: { kind: "waiting", days: 16, overdue: true }, returnedAt: null },
    ] as const;
    expect([...rows].sort(compareDispatchesForManager).map((r) => r.id)).toEqual([
      "wait-16",
      "wait-7",
      "open",
      "back-new",
      "back-old",
    ]);
  });
});

describe("standingDecisions", () => {
  it("keeps the newest decision per hole and stage", () => {
    const decisions = [
      { id: "1", drillholeId: "h1", stage: "core_logging", decision: "hold", decidedAt: new Date("2026-09-20") },
      { id: "2", drillholeId: "h1", stage: "core_logging", decision: "accept", decidedAt: new Date("2026-09-22") },
      { id: "3", drillholeId: "h1", stage: "laboratory_assays", decision: "reject", decidedAt: new Date("2026-09-21") },
      { id: "4", drillholeId: "h2", stage: null, decision: "hold", decidedAt: new Date("2026-09-19") },
    ];
    expect(standingDecisions(decisions).map((d) => d.id)).toEqual(["2", "3", "4"]);
  });
});

describe("qcInsertion", () => {
  it("compares inserted controls with what the rates ask for", () => {
    const samples = [
      ...Array.from({ length: 230 }, () => ({ type: "primary" as const })),
      ...Array.from({ length: 12 }, () => ({ type: "standard" as const })),
      ...Array.from({ length: 9 }, () => ({ type: "blank" as const })),
      ...Array.from({ length: 5 }, () => ({ type: "duplicate" as const })),
    ];
    const rows = qcInsertion(samples, { standardEveryN: 20, blankEveryN: 25, duplicateEveryN: 20 });
    expect(rows).toEqual([
      { controlType: "standard", everyN: 20, expected: 11, inserted: 12, short: false },
      { controlType: "blank", everyN: 25, expected: 9, inserted: 9, short: false },
      { controlType: "duplicate", everyN: 20, expected: 11, inserted: 5, short: true },
    ]);
  });

  it("expects nothing when a rate is switched off", () => {
    const [standard] = qcInsertion([{ type: "primary" }], { standardEveryN: 0, blankEveryN: 0, duplicateEveryN: 0 });
    expect(standard.expected).toBeNull();
    expect(standard.short).toBe(false);
  });
});

describe("report periods", () => {
  it("reads the period from the address, defaulting to 7 days", () => {
    expect(toReportPeriod("30")).toBe("30");
    expect(toReportPeriod("365")).toBe("7");
    expect(toReportPeriod(undefined)).toBe("7");
  });
  it("starts the period that many days back", () => {
    expect(reportPeriodStart("7", now).toISOString()).toBe("2026-09-20T08:00:00.000Z");
    expect(reportPeriodStart("all", now).getTime()).toBe(0);
  });
  it("formats days in UTC", () => {
    expect(formatDay(new Date("2026-09-11T00:00:00Z"))).toBe("11 Sep 2026");
  });
});
