import { describe, expect, it } from "vitest";
import {
  classifyUploadResponse,
  countBackupStates,
  photoBackupLabel,
  photoBackupSummary,
  photosDue,
  retryDelayMs,
} from "./photoBackup";

describe("classifyUploadResponse", () => {
  it("is sent on any success", () => {
    expect(classifyUploadResponse(200)).toEqual({ kind: "sent" });
    expect(classifyUploadResponse(201)).toEqual({ kind: "sent" });
  });

  it("never blames the photo when there was no answer", () => {
    expect(classifyUploadResponse(null)).toEqual({
      kind: "retry",
      error: "no-connection",
    });
  });

  it("stops the whole run when the sign-in is not accepted", () => {
    expect(classifyUploadResponse(401)).toEqual({ kind: "signed-out" });
  });

  it("waits for the record when the server does not know the photo yet", () => {
    expect(classifyUploadResponse(404, "photo-not-found")).toEqual({
      kind: "retry",
      error: "record-not-synced",
    });
  });

  it("gives up on a file the server will never take", () => {
    expect(classifyUploadResponse(413, "too-large")).toEqual({
      kind: "failed",
      error: "too-large",
    });
    expect(classifyUploadResponse(400, "unsupported-type")).toEqual({
      kind: "failed",
      error: "unsupported-type",
    });
  });

  it("retries a cut-off upload and a server that is having a moment", () => {
    expect(classifyUploadResponse(400, "incomplete").kind).toBe("retry");
    expect(classifyUploadResponse(502, "storage-failed")).toEqual({
      kind: "retry",
      error: "storage-failed",
    });
    expect(classifyUploadResponse(503, "storage-not-configured").kind).toBe(
      "retry",
    );
    expect(classifyUploadResponse(500)).toEqual({
      kind: "retry",
      error: "server-500",
    });
  });
});

describe("retryDelayMs", () => {
  it("waits longer after each failure, up to half an hour", () => {
    const delays = [1, 2, 3, 4, 5, 6, 40].map(retryDelayMs);
    expect(delays).toEqual([
      20_000, 60_000, 300_000, 900_000, 1_800_000, 1_800_000, 1_800_000,
    ]);
  });

  it("treats no failures like the first", () => {
    expect(retryDelayMs(0)).toBe(20_000);
  });
});

describe("photosDue", () => {
  const now = new Date("2026-09-21T10:00:00.000Z");
  const photo = (
    id: string,
    attempts: number,
    lastAttemptAt: string | null,
  ) => ({
    id,
    attempts,
    lastAttemptAt,
  });

  it("sends photos never tried, and ones whose wait is over", () => {
    const due = photosDue(
      [
        photo("new", 0, null),
        photo("old", 1, "2026-09-21T09:59:00.000Z"), // 60 s ago, wait was 20 s
        photo("recent", 1, "2026-09-21T09:59:50.000Z"), // 10 s ago
      ],
      now,
    );
    expect(due.map((p) => p.id)).toEqual(["new", "old"]);
  });

  it("sends everything when the wait is to be ignored", () => {
    const due = photosDue(
      [photo("recent", 4, "2026-09-21T09:59:59.000Z")],
      now,
      {
        ignoreDelay: true,
      },
    );
    expect(due).toHaveLength(1);
  });

  it("keeps the order it was given and honours the limit", () => {
    const list = ["a", "b", "c", "d"].map((id) => photo(id, 0, null));
    expect(photosDue(list, now, { limit: 2 }).map((p) => p.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("does not stall on a time it cannot read", () => {
    expect(photosDue([photo("x", 2, "not a time")], now)).toHaveLength(1);
  });
});

describe("photoBackupSummary", () => {
  const wifi = { wifiOnly: false, onWifi: null } as const;
  const counts = (sent: number, waiting: number, failed = 0) => ({
    sent,
    waiting,
    failed,
    "no-file": 0,
  });

  it("counts states", () => {
    expect(
      countBackupStates(["sent", "sent", "waiting", "failed", "no-file"]),
    ).toEqual({ sent: 2, waiting: 1, failed: 1, "no-file": 1 });
  });

  it("is calm and empty with no photos", () => {
    const summary = photoBackupSummary(counts(0, 0), wifi);
    expect(summary.title).toBe("No photos yet");
    expect(summary.allSafe).toBe(true);
  });

  it("says every photo is safe once all are sent", () => {
    const summary = photoBackupSummary(counts(12, 0), wifi);
    expect(summary.title).toBe("12 photos backed up");
    expect(summary.allSafe).toBe(true);
    expect(photoBackupSummary(counts(1, 0), wifi).title).toBe(
      "1 photo backed up",
    );
  });

  it("says how many are waiting, and that they are safe on the phone", () => {
    const summary = photoBackupSummary(counts(9, 3), wifi);
    expect(summary.title).toBe("3 photos waiting to back up");
    expect(summary.detail).toContain("safe on this phone");
    expect(summary.allSafe).toBe(false);
  });

  it("explains a wait for Wi-Fi", () => {
    const summary = photoBackupSummary(counts(0, 2), {
      wifiOnly: true,
      onWifi: false,
    });
    expect(summary.detail).toContain("Waiting for Wi-Fi");
    // On Wi-Fi, or unknown, it is not the setting holding them back.
    expect(
      photoBackupSummary(counts(0, 2), { wifiOnly: true, onWifi: true }).detail,
    ).not.toContain("Waiting for Wi-Fi");
  });

  it("puts a file the server refused first, because it needs a person", () => {
    const summary = photoBackupSummary(counts(5, 2, 1), wifi);
    expect(summary.title).toBe("1 photo could not be backed up");
    expect(summary.allSafe).toBe(false);
  });

  it("labels each state for a photo", () => {
    expect(photoBackupLabel("sent")).toBe("Backed up");
    expect(photoBackupLabel("waiting")).toBe("Waiting to back up");
    expect(photoBackupLabel("failed")).toBe("Could not back up");
    expect(photoBackupLabel("no-file")).toBe("Taken on another phone");
  });
});
