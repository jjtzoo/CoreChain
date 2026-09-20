import { describe, expect, it } from "vitest";
import {
  canJoinDispatch,
  canRecordEvent,
  custodyTimeline,
  dispatchSheet,
  effectiveEvents,
  nextDispatchNumber,
  splitByEligibility,
  statusFromEvents,
  validateCorrection,
  validateCustodyEvent,
  validateDispatch,
  type CustodyEventType,
  type FieldCustodyEvent,
} from "./custody";

let counter = 0;
function event(
  type: CustodyEventType,
  occurredAt: string,
  extra: Partial<FieldCustodyEvent> = {},
): FieldCustodyEvent {
  counter += 1;
  return {
    id: `e${counter}`,
    projectId: "p1",
    sampleId: "s1",
    type,
    occurredAt,
    handledBy: "A. Geologist",
    location: null,
    recipient: null,
    note: null,
    dispatchId: null,
    correctsEventId: null,
    createdAt: occurredAt,
    ...extra,
  };
}

const now = new Date("2026-09-20T12:00:00Z");

describe("validateCustodyEvent", () => {
  const good = {
    type: "bagged" as const,
    occurredAt: "2026-09-20T09:00:00Z",
    handledBy: "A. Geologist",
  };

  it("accepts a plain bagging", () => {
    expect(validateCustodyEvent(good, now)).toEqual([]);
  });

  it("needs someone who did it", () => {
    expect(
      validateCustodyEvent({ ...good, handledBy: "  " }, now).map(
        (e) => e.field,
      ),
    ).toEqual(["handledBy"]);
  });

  it("refuses a time well in the future but allows a few minutes of clock drift", () => {
    expect(
      validateCustodyEvent(
        { ...good, occurredAt: "2026-09-20T12:03:00Z" },
        now,
      ),
    ).toEqual([]);
    expect(
      validateCustodyEvent(
        { ...good, occurredAt: "2026-09-21T12:00:00Z" },
        now,
      ).map((e) => e.field),
    ).toEqual(["occurredAt"]);
  });

  it("needs a recipient for a handover", () => {
    expect(
      validateCustodyEvent({ ...good, type: "handed_over" }, now).map(
        (e) => e.field,
      ),
    ).toEqual(["recipient"]);
    expect(
      validateCustodyEvent(
        { ...good, type: "handed_over", recipient: "Courier" },
        now,
      ),
    ).toEqual([]);
  });

  it("refuses an unreadable time", () => {
    expect(
      validateCustodyEvent({ ...good, occurredAt: "yesterday" }, now).map(
        (e) => e.field,
      ),
    ).toEqual(["occurredAt"]);
  });
});

describe("validateCorrection", () => {
  it("needs a reason and a name", () => {
    expect(
      validateCorrection({ note: "", handledBy: "" }).map((e) => e.field),
    ).toEqual(["note", "handledBy"]);
    expect(validateCorrection({ note: "Wrong bag", handledBy: "A" })).toEqual(
      [],
    );
  });
});

describe("timeline and status", () => {
  it("has no events and is created", () => {
    expect(statusFromEvents([])).toBe("created");
  });

  it("is bagged after bagging, sealing or handing over", () => {
    expect(statusFromEvents([event("bagged", "2026-09-20T09:00:00Z")])).toBe(
      "bagged",
    );
  });

  it("is dispatched once a dispatch event counts", () => {
    expect(
      statusFromEvents([
        event("bagged", "2026-09-20T09:00:00Z"),
        event("dispatched", "2026-09-20T10:00:00Z"),
      ]),
    ).toBe("dispatched");
  });

  it("puts events in time order and marks the voided one, keeping both", () => {
    const mistake = event("bagged", "2026-09-20T09:00:00Z");
    const fix = event("correction", "2026-09-20T09:30:00Z", {
      correctsEventId: mistake.id,
      note: "Wrong sample",
    });
    const lines = custodyTimeline([fix, mistake]);
    expect(lines.map((l) => [l.type, l.voided])).toEqual([
      ["bagged", true],
      ["correction", false],
    ]);
  });

  it("a correction returns the sample to created", () => {
    const mistake = event("bagged", "2026-09-20T09:00:00Z");
    const fix = event("correction", "2026-09-20T09:30:00Z", {
      correctsEventId: mistake.id,
      note: "Wrong sample",
    });
    expect(effectiveEvents([mistake, fix])).toEqual([]);
    expect(statusFromEvents([mistake, fix])).toBe("created");
  });
});

describe("canRecordEvent", () => {
  const bagged = event("bagged", "2026-09-20T09:00:00Z");

  it("allows bagging once", () => {
    expect(canRecordEvent("bagged", [])).toEqual({ ok: true });
    expect(canRecordEvent("bagged", [bagged])).toEqual({
      ok: false,
      reason: "Already bagged",
    });
  });

  it("needs bagging before sealing or handing over", () => {
    expect(canRecordEvent("sealed", [])).toEqual({
      ok: false,
      reason: "Not bagged yet",
    });
    expect(canRecordEvent("handed_over", [])).toEqual({
      ok: false,
      reason: "Not bagged yet",
    });
    expect(canRecordEvent("sealed", [bagged])).toEqual({ ok: true });
  });

  it("seals once, and can hand over more than once", () => {
    const sealed = event("sealed", "2026-09-20T09:10:00Z");
    expect(canRecordEvent("sealed", [bagged, sealed])).toEqual({
      ok: false,
      reason: "Already sealed",
    });
    const handed = event("handed_over", "2026-09-20T09:20:00Z", {
      recipient: "Courier",
    });
    expect(canRecordEvent("handed_over", [bagged, sealed, handed])).toEqual({
      ok: true,
    });
  });

  it("records nothing after dispatch", () => {
    const dispatched = event("dispatched", "2026-09-20T10:00:00Z");
    expect(canRecordEvent("handed_over", [bagged, dispatched])).toEqual({
      ok: false,
      reason: "Already dispatched to the lab",
    });
  });

  it("a voided bagging can be recorded again", () => {
    const mistake = event("bagged", "2026-09-20T09:00:00Z");
    const fix = event("correction", "2026-09-20T09:30:00Z", {
      correctsEventId: mistake.id,
      note: "x",
    });
    expect(canRecordEvent("bagged", [mistake, fix])).toEqual({ ok: true });
  });
});

describe("splitByEligibility", () => {
  it("separates samples that can take the event and says why the others cannot", () => {
    const a = { id: "a" };
    const b = { id: "b" };
    const events = new Map([
      ["b", [event("bagged", "2026-09-20T09:00:00Z", { sampleId: "b" })]],
    ]);
    const result = splitByEligibility("bagged", [a, b], events);
    expect(result.eligible).toEqual([a]);
    expect(result.skipped).toEqual([{ sample: b, reason: "Already bagged" }]);
  });
});

describe("dispatch rules", () => {
  it("numbers dispatches one after the highest used", () => {
    expect(nextDispatchNumber([])).toBe("DSP-001");
    expect(nextDispatchNumber(["DSP-001", "DSP-007", "DSP-003"])).toBe(
      "DSP-008",
    );
    expect(nextDispatchNumber(["custom"])).toBe("DSP-001");
  });

  it("needs a laboratory and at least one sample", () => {
    expect(
      validateDispatch({ laboratory: " ", sampleCount: 0 }).map((e) => e.field),
    ).toEqual(["laboratory", "samples"]);
    expect(validateDispatch({ laboratory: "Lab", sampleCount: 2 })).toEqual([]);
  });

  it("only bagged, live samples in no other open dispatch can join", () => {
    expect(
      canJoinDispatch({ status: "bagged", deletedAt: null }, false),
    ).toEqual({ ok: true });
    expect(
      canJoinDispatch({ status: "created", deletedAt: null }, false),
    ).toEqual({
      ok: false,
      reason: "Not bagged yet",
    });
    expect(
      canJoinDispatch({ status: "dispatched", deletedAt: null }, false),
    ).toEqual({
      ok: false,
      reason: "Already dispatched",
    });
    expect(
      canJoinDispatch(
        { status: "bagged", deletedAt: "2026-09-01T00:00:00Z" },
        false,
      ),
    ).toEqual({
      ok: false,
      reason: "Removed",
    });
    expect(
      canJoinDispatch({ status: "bagged", deletedAt: null }, true),
    ).toEqual({
      ok: false,
      reason: "In another open dispatch",
    });
  });
});

describe("dispatchSheet", () => {
  const sheet = dispatchSheet({
    projectName: "Alberta sample project",
    dispatch: {
      dispatchNumber: "DSP-002",
      laboratory: "Lab, Inc.",
      preparationRequest: "Crush and pulverise",
      handoverAt: "2026-09-20",
      note: null,
    },
    handedOverBy: "A. Geologist",
    samples: [
      {
        sampleNumber: "AGS-00010",
        type: "primary",
        holeId: "H1",
        fromM: 3,
        toM: 4,
        standardRef: null,
        parentSampleNumber: null,
      },
      {
        sampleNumber: "AGS-00002",
        type: "standard",
        holeId: "H1",
        fromM: null,
        toM: null,
        standardRef: "OREAS 45e",
        parentSampleNumber: null,
      },
      {
        sampleNumber: "AGS-00011",
        type: "duplicate",
        holeId: "H1",
        fromM: 3,
        toM: 4,
        standardRef: null,
        parentSampleNumber: "AGS-00010",
      },
    ],
  });

  it("counts by type", () => {
    expect(sheet.total).toBe(3);
    expect(sheet.byType).toEqual({
      primary: 1,
      standard: 1,
      blank: 0,
      duplicate: 1,
    });
  });

  it("names the file after the dispatch", () => {
    expect(sheet.filename).toBe("dsp-002-sheet.csv");
  });

  it("says who it is for and lists samples in number order", () => {
    const lines = sheet.csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe("Dispatch,DSP-002");
    expect(lines[2]).toBe('Laboratory,"Lab, Inc."');
    expect(lines[7]).toBe("Samples,3");
    const table = lines.slice(
      lines.indexOf("SAMPLE_ID,TYPE,HOLEID,FROM,TO,QC"),
    );
    expect(table).toEqual([
      "SAMPLE_ID,TYPE,HOLEID,FROM,TO,QC",
      "AGS-00002,Standard,H1,,,Reference material OREAS 45e",
      "AGS-00010,Primary,H1,3,4,",
      "AGS-00011,Duplicate,H1,3,4,Duplicate of AGS-00010",
    ]);
  });
});
