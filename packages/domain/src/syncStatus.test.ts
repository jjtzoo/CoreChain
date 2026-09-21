import { describe, expect, it } from "vitest";
import {
  describeSyncIssue,
  formatAgo,
  syncSummary,
  type SyncFacts,
} from "./syncStatus";

const NOW = new Date("2026-09-20T10:00:00.000Z");

const settled: SyncFacts = {
  canSync: true,
  outdated: false,
  connected: true,
  connecting: false,
  uploading: false,
  downloading: false,
  hasSynced: true,
  lastSyncedAt: "2026-09-20T09:58:00.000Z",
  pending: 0,
  issues: 0,
};

describe("formatAgo", () => {
  it("reads naturally at each scale", () => {
    expect(formatAgo("2026-09-20T09:59:40.000Z", NOW)).toBe("just now");
    expect(formatAgo("2026-09-20T09:55:00.000Z", NOW)).toBe("5 min ago");
    expect(formatAgo("2026-09-20T07:00:00.000Z", NOW)).toBe("3 h ago");
    expect(formatAgo("2026-09-19T09:00:00.000Z", NOW)).toBe("yesterday");
    expect(formatAgo("2026-09-16T10:00:00.000Z", NOW)).toBe("4 days ago");
  });

  it("never says a time in the future or nonsense", () => {
    expect(formatAgo("2026-09-21T10:00:00.000Z", NOW)).toBe("just now");
    expect(formatAgo("garbage", NOW)).toBe("a while ago");
  });
});

describe("syncSummary", () => {
  it("is calm when everything is sent", () => {
    expect(syncSummary(settled, NOW)).toEqual({
      tone: "ok",
      title: "Up to date",
      detail: "Last synced 2 min ago.",
    });
  });

  it("does not alarm someone who is simply out of signal", () => {
    const offline = syncSummary({ ...settled, connected: false }, NOW);
    expect(offline.tone).toBe("waiting");
    expect(offline.title).toBe("Working offline");
    expect(offline.detail).toContain("saved on this phone");
  });

  it("says how much is waiting to be sent, in the singular and plural", () => {
    const one = syncSummary({ ...settled, connected: false, pending: 1 }, NOW);
    expect(one.title).toBe("Waiting for signal");
    expect(one.detail).toContain("1 change saved");
    const many = syncSummary({ ...settled, connected: false, pending: 12 }, NOW);
    expect(many.detail).toContain("12 changes saved");
  });

  it("shows progress while sending", () => {
    const sending = syncSummary({ ...settled, uploading: true, pending: 4 }, NOW);
    expect(sending.tone).toBe("busy");
    expect(sending.detail).toBe("4 changes left to send.");
  });

  it("explains the first download", () => {
    expect(
      syncSummary({ ...settled, hasSynced: false, lastSyncedAt: null }, NOW).title,
    ).toBe("Loading your projects");
    expect(
      syncSummary(
        { ...settled, hasSynced: false, lastSyncedAt: null, connected: false },
        NOW,
      ).title,
    ).toBe("Not synced yet");
  });

  it("puts changes the server refused first, because those need a person", () => {
    const summary = syncSummary({ ...settled, issues: 2, pending: 3 }, NOW);
    expect(summary.tone).toBe("attention");
    expect(summary.title).toBe("2 changes could not be sent");
  });

  it("says plainly when the sign-in has run out", () => {
    const summary = syncSummary({ ...settled, canSync: false }, NOW);
    expect(summary.tone).toBe("off");
    expect(summary.title).toBe("Not syncing");
  });

  it("tells the geologist to update when the app is too old to sync", () => {
    const summary = syncSummary(
      { ...settled, canSync: false, outdated: true },
      NOW,
    );
    expect(summary.tone).toBe("off");
    expect(summary.title).toBe("Update CoreChain to keep syncing");
    expect(summary.detail).toContain("safe on this phone");
  });
});

describe("describeSyncIssue", () => {
  it("explains what the server refused, in plain words", () => {
    expect(describeSyncIssue("rejected", "hard-delete-not-allowed")).toContain(
      "never deleted",
    );
    expect(describeSyncIssue("rejected", "duplicate-sample-number")).toContain(
      "sample number",
    );
    expect(describeSyncIssue("conflict", "newer-version-on-server")).toContain(
      "kept",
    );
    expect(describeSyncIssue("rejected", null)).toContain("could not accept");
  });
});
