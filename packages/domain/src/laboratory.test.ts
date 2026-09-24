import { describe, expect, it } from "vitest";
import {
  findSampleByTag,
  matchScan,
  missingSampleIds,
  preparationQueue,
  receiptStatus,
  resultsStatus,
  scannedSampleNumber,
  type ScanCandidate,
} from "./laboratory";

describe("receiptStatus", () => {
  it("is not_received when nothing has arrived", () => {
    expect(receiptStatus(["a", "b"], [])).toBe("not_received");
  });

  it("is not_received for a dispatch with no samples", () => {
    expect(receiptStatus([], [])).toBe("not_received");
  });

  it("is partially_received when some but not all arrived", () => {
    expect(receiptStatus(["a", "b", "c"], ["a"])).toBe("partially_received");
  });

  it("is received when every dispatched sample arrived", () => {
    expect(receiptStatus(["a", "b"], ["b", "a"])).toBe("received");
  });

  it("ignores a received id that wasn't actually dispatched", () => {
    expect(receiptStatus(["a"], ["a", "z"])).toBe("received");
  });
});

describe("missingSampleIds", () => {
  it("returns dispatched samples with no received event", () => {
    expect(missingSampleIds(["a", "b", "c"], ["a"])).toEqual(["b", "c"]);
  });

  it("returns nothing missing once everything arrived", () => {
    expect(missingSampleIds(["a", "b"], ["a", "b"])).toEqual([]);
  });
});

describe("resultsStatus", () => {
  it("is not_started with no results and not marked complete", () => {
    expect(resultsStatus([], null)).toBe("not_started");
  });

  it("is in_progress once some results exist but the batch isn't marked done", () => {
    expect(resultsStatus(["s1"], null)).toBe("in_progress");
  });

  it("is complete once resultsReturnedAt is set, even with no results entered", () => {
    expect(resultsStatus([], "2026-09-22T00:00:00.000Z")).toBe("complete");
  });

  it("is complete when marked done after results were entered", () => {
    expect(resultsStatus(["s1", "s2"], "2026-09-22T00:00:00.000Z")).toBe(
      "complete",
    );
  });
});

describe("scannedSampleNumber", () => {
  it("drops spaces and the scanner's control characters", () => {
    expect(scannedSampleNumber("  AB-0041\r\n")).toBe("AB-0041");
    expect(scannedSampleNumber("\u0002AB-0041\u0003")).toBe("AB-0041");
  });

  it("keeps only the last path segment of a link in a QR code", () => {
    expect(scannedSampleNumber("https://example.com/samples/AB-0041")).toBe("AB-0041");
    expect(scannedSampleNumber("https://example.com/s/AB%200041/?x=1#top")).toBe("AB 0041");
  });

  it("leaves a plain number alone, even with a slash in it", () => {
    expect(scannedSampleNumber("DDH-01/0041")).toBe("DDH-01/0041");
  });
});

describe("matchScan", () => {
  const candidate = (
    sampleId: string,
    sampleNumber: string,
    dispatchId: string,
    receivedAt: string | null = null,
  ): ScanCandidate => ({
    sampleId,
    sampleNumber,
    dispatchId,
    dispatchNumber: dispatchId.toUpperCase(),
    receivedAt,
  });

  it("receives a dispatched sample, ignoring capitals", () => {
    const outcome = matchScan("ab-0041", [candidate("s1", "AB-0041", "dsp-002")]);
    expect(outcome).toMatchObject({ kind: "receive", candidate: { sampleId: "s1" } });
  });

  it("says when the bag was already received", () => {
    const outcome = matchScan("AB-0041", [
      candidate("s1", "AB-0041", "dsp-002", "2026-09-25T01:00:00Z"),
    ]);
    expect(outcome.kind).toBe("already_received");
  });

  it("prefers the dispatch still waiting for the bag", () => {
    const outcome = matchScan("AB-0041", [
      candidate("s1", "AB-0041", "dsp-001", "2026-09-20T01:00:00Z"),
      candidate("s1", "AB-0041", "dsp-003"),
    ]);
    expect(outcome).toMatchObject({ kind: "receive", candidate: { dispatchId: "dsp-003" } });
  });

  it("flags a bag that isn't on any dispatch, and ignores an empty scan", () => {
    expect(matchScan("AB-9999", [candidate("s1", "AB-0041", "dsp-002")])).toEqual({
      kind: "not_dispatched",
      code: "AB-9999",
    });
    expect(matchScan(" \r\n", [])).toEqual({ kind: "empty" });
  });
});

describe("preparationQueue", () => {
  const row = (
    sampleNumber: string,
    receivedAt: string | null,
    extra: Partial<Parameters<typeof preparationQueue>[0][number]> = {},
  ) => ({
    sampleId: sampleNumber,
    sampleNumber,
    dispatchNumber: "DSP-002",
    holeId: "AB-001",
    projectName: "Alberta",
    receivedAt,
    priority: "normal" as const,
    priorityNote: null,
    hasResults: false,
    resultsComplete: false,
    ...extra,
  });

  it("puts urgent holes first, then first received, then sample number", () => {
    const queue = preparationQueue([
      row("S-10", "2026-09-25T02:00:00Z"),
      row("S-2", "2026-09-25T02:00:00Z"),
      row("S-1", "2026-09-25T01:00:00Z"),
      row("S-9", "2026-09-25T03:00:00Z", { priority: "urgent", holeId: "AB-004" }),
    ]);
    expect(queue.map((s) => s.sampleNumber)).toEqual(["S-9", "S-1", "S-2", "S-10"]);
  });

  it("leaves out samples not received, with results, or in a completed batch", () => {
    const queue = preparationQueue([
      row("S-1", null),
      row("S-2", "2026-09-25T01:00:00Z", { hasResults: true }),
      row("S-3", "2026-09-25T01:00:00Z", { resultsComplete: true }),
      row("S-4", "2026-09-25T01:00:00Z"),
    ]);
    expect(queue.map((s) => s.sampleNumber)).toEqual(["S-4"]);
    expect(queue[0]).not.toHaveProperty("hasResults");
  });
});

describe("findSampleByTag", () => {
  const samples = [
    { id: "a", sampleNumber: "AB-0041", deletedAt: null },
    { id: "b", sampleNumber: "AB-0042", deletedAt: "2026-09-20T00:00:00Z" },
  ];

  it("finds the sample a tag names, ignoring capitals and scanner characters", () => {
    expect(findSampleByTag("ab-0041\r\n", samples)?.id).toBe("a");
  });

  it("never matches a deleted sample, an unknown tag or an empty scan", () => {
    expect(findSampleByTag("AB-0042", samples)).toBeNull();
    expect(findSampleByTag("AB-9999", samples)).toBeNull();
    expect(findSampleByTag("   ", samples)).toBeNull();
  });
});
