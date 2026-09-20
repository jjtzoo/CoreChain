import { describe, expect, it } from "vitest";

import type { FieldCustodyEvent } from "./custody";
import {
  daysInRange,
  formatRange,
  formatWorkReport,
  isEmptyWork,
  orderedRange,
  rangeForPreset,
  summariseWork,
  type WorkInput,
} from "./myWork";

// Tests give the local day straight from the text so the results do not depend
// on the machine's time zone: "2026-09-21T10:00" is day 2026-09-21.
const dayOf = (iso: string) => iso.slice(0, 10);

const EMPTY: WorkInput = {
  intervals: [],
  boxes: [],
  runs: [],
  samples: [],
  custody: [],
  photos: [],
  dispatches: [],
};

function step(
  id: string,
  type: FieldCustodyEvent["type"],
  occurredAt: string,
  extra: Partial<FieldCustodyEvent> = {},
): FieldCustodyEvent {
  return {
    id,
    projectId: "p",
    sampleId: `s-${id}`,
    type,
    occurredAt,
    handledBy: "Me",
    location: null,
    recipient: null,
    note: null,
    dispatchId: null,
    correctsEventId: null,
    createdAt: occurredAt,
    ...extra,
  };
}

const DAY = { from: "2026-09-21", to: "2026-09-21" };

describe("rangeForPreset", () => {
  const monday = new Date(2026, 8, 21, 15, 0); // Mon 21 Sep 2026
  const wednesday = new Date(2026, 8, 23, 9, 0);
  const sunday = new Date(2026, 8, 27, 20, 0);

  it("gives today and yesterday", () => {
    expect(rangeForPreset("today", wednesday)).toEqual({
      from: "2026-09-23",
      to: "2026-09-23",
    });
    expect(rangeForPreset("yesterday", monday)).toEqual({
      from: "2026-09-20",
      to: "2026-09-20",
    });
  });

  it("runs the last seven days, today and the six before", () => {
    expect(rangeForPreset("last7", monday)).toEqual({
      from: "2026-09-15",
      to: "2026-09-21",
    });
    expect(rangeForPreset("last7", wednesday)).toEqual({
      from: "2026-09-17",
      to: "2026-09-23",
    });
    expect(rangeForPreset("last7", sunday)).toEqual({
      from: "2026-09-21",
      to: "2026-09-27",
    });
  });
});

describe("ranges", () => {
  it("lists every day, inclusive, across a month end", () => {
    expect(daysInRange({ from: "2026-09-29", to: "2026-10-02" })).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("turns a backwards range round", () => {
    expect(orderedRange("2026-09-22", "2026-09-20")).toEqual({
      from: "2026-09-20",
      to: "2026-09-22",
    });
  });

  it("formats a day and a range", () => {
    expect(formatRange(DAY)).toBe("Mon 21 Sep 2026");
    expect(formatRange({ from: "2026-09-15", to: "2026-09-21" })).toBe(
      "Tue 15 Sep – Mon 21 Sep 2026",
    );
  });
});

describe("summariseWork", () => {
  it("counts metres by the day the interval was logged, not the day it synced", () => {
    const summary = summariseWork(
      {
        ...EMPTY,
        intervals: [
          {
            holeName: "H1",
            fromM: 0,
            toM: 4.5,
            createdAt: "2026-09-21T02:00:00Z",
          },
          {
            holeName: "H1",
            fromM: 4.5,
            toM: 10,
            createdAt: "2026-09-21T09:00:00Z",
          },
          {
            holeName: "H2",
            fromM: 0,
            toM: 3,
            createdAt: "2026-09-20T09:00:00Z",
          },
        ],
      },
      DAY,
      dayOf,
    );
    expect(summary.metresLogged).toBe(10);
    expect(summary.intervalCount).toBe(2);
    expect(summary.holes).toEqual([
      { holeName: "H1", fromM: 0, toM: 10, metres: 10, intervalCount: 2 },
    ]);
  });

  it("splits metres across holes in a range and per day", () => {
    const summary = summariseWork(
      {
        ...EMPTY,
        intervals: [
          {
            holeName: "H1",
            fromM: 0,
            toM: 5,
            createdAt: "2026-09-20T09:00:00Z",
          },
          {
            holeName: "H10",
            fromM: 0,
            toM: 2,
            createdAt: "2026-09-21T09:00:00Z",
          },
          {
            holeName: "H2",
            fromM: 10,
            toM: 12,
            createdAt: "2026-09-21T10:00:00Z",
          },
        ],
      },
      { from: "2026-09-19", to: "2026-09-21" },
      dayOf,
    );
    expect(summary.holes.map((h) => h.holeName)).toEqual(["H1", "H2", "H10"]);
    expect(summary.perDay).toEqual([
      { day: "2026-09-19", metres: 0, activity: 0 },
      { day: "2026-09-20", metres: 5, activity: 1 },
      { day: "2026-09-21", metres: 4, activity: 2 },
    ]);
  });

  it("counts samples and QC controls", () => {
    const at = "2026-09-21T09:00:00Z";
    const summary = summariseWork(
      {
        ...EMPTY,
        samples: [
          { type: "primary", createdAt: at },
          { type: "primary", createdAt: at },
          { type: "blank", createdAt: at },
          { type: "duplicate", createdAt: at },
          { type: "standard", createdAt: "2026-09-20T09:00:00Z" },
        ],
      },
      DAY,
      dayOf,
    );
    expect(summary.samples).toEqual({
      total: 4,
      qc: 2,
      blank: 1,
      standard: 0,
      duplicate: 1,
    });
  });

  it("counts custody steps by when they happened and skips voided ones and corrections", () => {
    const summary = summariseWork(
      {
        ...EMPTY,
        custody: [
          step("a", "bagged", "2026-09-21T03:00:00Z"),
          step("b", "bagged", "2026-09-21T03:01:00Z"),
          step("c", "sealed", "2026-09-21T04:00:00Z"),
          step("d", "handed_over", "2026-09-21T05:00:00Z"),
          step("e", "dispatched", "2026-09-21T06:00:00Z"),
          // A correction made the next day still voids step "b".
          step("x", "correction", "2026-09-22T01:00:00Z", {
            correctsEventId: "b",
          }),
          step("old", "bagged", "2026-09-19T03:00:00Z"),
        ],
      },
      DAY,
      dayOf,
    );
    expect(summary.custody).toEqual({
      total: 4,
      bagged: 1,
      sealed: 1,
      handedOver: 1,
      dispatched: 1,
    });
  });

  it("lists dispatches handed over in the range only", () => {
    const summary = summariseWork(
      {
        ...EMPTY,
        dispatches: [
          {
            dispatchNumber: "DSP-001",
            laboratory: "ALS",
            handoverDay: "2026-09-21",
            sampleCount: 3,
          },
          {
            dispatchNumber: "DSP-002",
            laboratory: "ALS",
            handoverDay: null,
            sampleCount: 5,
          },
          {
            dispatchNumber: "DSP-000",
            laboratory: "SGS",
            handoverDay: "2026-09-10",
            sampleCount: 2,
          },
        ],
      },
      DAY,
      dayOf,
    );
    expect(summary.dispatches).toEqual([
      { dispatchNumber: "DSP-001", laboratory: "ALS", sampleCount: 3 },
    ]);
  });

  it("groups same-minute steps into one activity line, newest first", () => {
    const summary = summariseWork(
      {
        ...EMPTY,
        intervals: [
          {
            holeName: "H1",
            fromM: 0,
            toM: 2,
            createdAt: "2026-09-21T08:00:30Z",
          },
        ],
        custody: [
          step("a", "bagged", "2026-09-21T03:47:10Z"),
          step("b", "bagged", "2026-09-21T03:47:40Z"),
          step("c", "bagged", "2026-09-21T03:47:59Z"),
        ],
      },
      DAY,
      dayOf,
    );
    expect(summary.activity.map((a) => a.text)).toEqual([
      "Logged H1 0–2 m",
      "Bagged 3 samples",
    ]);
  });

  it("knows when nothing was done", () => {
    expect(isEmptyWork(summariseWork(EMPTY, DAY, dayOf))).toBe(true);
    expect(
      isEmptyWork(
        summariseWork(
          { ...EMPTY, photos: [{ capturedAt: "2026-09-21T09:00:00Z" }] },
          DAY,
          dayOf,
        ),
      ),
    ).toBe(false);
  });
});

describe("formatWorkReport", () => {
  it("writes a plain-text day report", () => {
    const summary = summariseWork(
      {
        ...EMPTY,
        intervals: [
          {
            holeName: "CDL-001",
            fromM: 154.2,
            toM: 163.6,
            createdAt: "2026-09-21T02:00:00Z",
          },
        ],
        samples: [
          { type: "primary", createdAt: "2026-09-21T03:00:00Z" },
          { type: "blank", createdAt: "2026-09-21T03:00:00Z" },
        ],
        custody: [step("a", "bagged", "2026-09-21T03:47:00Z")],
        dispatches: [
          {
            dispatchNumber: "DSP-001",
            laboratory: "ALS Manila",
            handoverDay: "2026-09-21",
            sampleCount: 3,
          },
        ],
        photos: [{ capturedAt: "2026-09-21T03:00:00Z" }],
      },
      DAY,
      dayOf,
    );
    const report = formatWorkReport({ summary, person: "Test Geologist 1" });
    expect(report).toContain("CoreChain · Daily report");
    expect(report).toContain("Test Geologist 1 · Mon 21 Sep 2026");
    expect(report).toContain(
      "CORE LOGGED      9.4 m across 1 hole (1 interval)",
    );
    expect(report).toContain("  CDL-001  154.2 - 163.6 m  9.4 m");
    expect(report).toContain("SAMPLES          2 (1 QC: 1 blank)");
    expect(report).toContain("CUSTODY          1 step (1 bagged)");
    expect(report).toContain(
      "DISPATCH         DSP-001 handed over to ALS Manila, 3 samples",
    );
    expect(report).toContain("PHOTOS           1");
    expect(report.endsWith("Sent from CoreChain Field")).toBe(true);
  });

  it("says so when nothing was recorded", () => {
    const report = formatWorkReport({
      summary: summariseWork(EMPTY, DAY, dayOf),
      person: "Me",
    });
    expect(report).toContain("Nothing recorded in this period.");
  });
});
