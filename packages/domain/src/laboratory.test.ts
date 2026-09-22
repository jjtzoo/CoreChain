import { describe, expect, it } from "vitest";
import {
  missingSampleIds,
  receiptStatus,
  resultsStatus,
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
