import { describe, expect, it } from "vitest";
import {
  recordSyncDetail,
  recordSyncLabel,
  recordSyncState,
  type RecordSyncMarkers,
} from "./recordSync";

const markers = (
  waiting: string[],
  attention: string[],
): RecordSyncMarkers => ({
  waiting: new Set(waiting),
  attention: new Set(attention),
});

describe("recordSyncState", () => {
  it("is sent when nothing is waiting or refused", () => {
    expect(recordSyncState("a", markers([], []))).toBe("sent");
    expect(recordSyncState("a", markers(["b"], ["c"]))).toBe("sent");
  });

  it("is waiting when a change has not been confirmed", () => {
    expect(recordSyncState("a", markers(["a"], []))).toBe("waiting");
  });

  it("is attention when the server refused a change", () => {
    expect(recordSyncState("a", markers([], ["a"]))).toBe("attention");
  });

  it("puts a refused change ahead of a waiting one", () => {
    expect(recordSyncState("a", markers(["a"], ["a"]))).toBe("attention");
  });
});

describe("labels", () => {
  it("shows a badge only when there is something to say", () => {
    expect(recordSyncLabel("sent")).toBeNull();
    expect(recordSyncLabel("waiting")).toBe("Waiting to send");
    expect(recordSyncLabel("attention")).toBe("Needs attention");
  });

  it("always has a line for a record's own screen, and stays calm about waiting", () => {
    expect(recordSyncDetail("sent")).toBe("Sent to the server.");
    expect(recordSyncDetail("waiting")).toContain("when you have signal");
    expect(recordSyncDetail("waiting")).not.toMatch(/error|fail|problem/i);
    expect(recordSyncDetail("attention")).toContain("did not accept");
  });
});
