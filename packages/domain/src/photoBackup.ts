// Photo backup rules (docs/product/corechain-mobile-mvp-scrum-plan.md, E5-3).
//
// A photo's record travels with the rest of the geologist's work. Its image file
// is sent separately, after the record has reached the server, so a slow photo
// never holds up a log. These rules decide what a server answer means, when to
// try again, and what to tell the geologist. They know nothing about the phone
// or the network, so they can be tested on their own.

/** Where one photo's image file stands. */
export type PhotoBackupState =
  /** On the server. */
  | "sent"
  /** Not on the server yet; the phone will keep trying. */
  | "waiting"
  /** The server will never take this file (wrong type or too big). */
  | "failed"
  /** The file is not on this phone (the photo was taken on another device). */
  | "no-file";

/** What the phone should do after the server's answer to one upload. */
export type UploadOutcome =
  | { kind: "sent" }
  /** Try this photo again later; nothing is wrong with it. */
  | { kind: "retry"; error: string }
  /** The sign-in is not accepted: stop the whole run, do not count it against the photo. */
  | { kind: "signed-out" }
  /** The server will never accept this file. */
  | { kind: "failed"; error: string };

/**
 * Turns the server's answer into an outcome. `status` is null when there was no
 * answer at all (no signal, dropped connection), which is never the photo's
 * fault.
 */
export function classifyUploadResponse(
  status: number | null,
  code?: string | null,
): UploadOutcome {
  if (status === null) return { kind: "retry", error: "no-connection" };
  if (status >= 200 && status < 300) return { kind: "sent" };
  if (status === 401 || status === 403) return { kind: "signed-out" };
  // The record has not reached the server yet; the next sync fixes that.
  if (status === 404) return { kind: "retry", error: "record-not-synced" };
  if (status === 413) return { kind: "failed", error: "too-large" };
  if (status === 400) {
    // A cut-off upload is just a bad moment on the network.
    if (code === "incomplete") return { kind: "retry", error: "incomplete" };
    return { kind: "failed", error: code ?? "refused" };
  }
  // Storage not connected (503), a rate limit (429), a server moment (5xx).
  return { kind: "retry", error: code ?? `server-${status}` };
}

// Seconds to wait before the next try, by how many tries have failed so far.
const RETRY_SECONDS = [20, 60, 300, 900, 1800];

/** How long to leave a photo alone after `attempts` failed tries. */
export function retryDelayMs(attempts: number): number {
  const index = Math.min(Math.max(attempts, 1), RETRY_SECONDS.length) - 1;
  return RETRY_SECONDS[index] * 1000;
}

export type BackupCandidate = {
  id: string;
  attempts: number;
  /** ISO time of the last try, or null when it was never tried. */
  lastAttemptAt: string | null;
};

/**
 * The photos to send in this run: every one not tried lately, oldest first, at
 * most `limit`. `ignoreDelay` (a sync just finished, or the geologist asked)
 * sends them all, because the reason for waiting may be gone.
 */
export function photosDue<T extends BackupCandidate>(
  candidates: readonly T[],
  now: Date,
  options: { limit?: number; ignoreDelay?: boolean } = {},
): T[] {
  const due = candidates.filter((photo) => {
    if (options.ignoreDelay || photo.attempts === 0 || !photo.lastAttemptAt) {
      return true;
    }
    const last = Date.parse(photo.lastAttemptAt);
    if (Number.isNaN(last)) return true;
    return now.getTime() - last >= retryDelayMs(photo.attempts);
  });
  return due.slice(0, options.limit ?? due.length);
}

export type PhotoBackupCounts = Record<PhotoBackupState, number>;

export function countBackupStates(
  states: readonly PhotoBackupState[],
): PhotoBackupCounts {
  const counts: PhotoBackupCounts = {
    sent: 0,
    waiting: 0,
    failed: 0,
    "no-file": 0,
  };
  for (const state of states) counts[state] += 1;
  return counts;
}

/** The short label shown on one photo. */
export function photoBackupLabel(state: PhotoBackupState): string {
  switch (state) {
    case "sent":
      return "Backed up";
    case "waiting":
      return "Waiting to back up";
    case "failed":
      return "Could not back up";
    case "no-file":
      return "Taken on another phone";
  }
}

const photos = (count: number) =>
  `${count} ${count === 1 ? "photo" : "photos"}`;

export type PhotoBackupSummary = {
  title: string;
  detail: string;
  /** Everything that can be backed up has been. */
  allSafe: boolean;
};

/** The Account screen's line about photos. */
export function photoBackupSummary(
  counts: PhotoBackupCounts,
  options: { wifiOnly: boolean; onWifi: boolean | null },
): PhotoBackupSummary {
  const { sent, waiting, failed } = counts;
  if (sent + waiting + failed === 0) {
    return {
      title: "No photos yet",
      detail: "Photos you take are backed up when you have signal.",
      allSafe: true,
    };
  }
  if (failed > 0) {
    return {
      title: `${photos(failed)} could not be backed up`,
      detail:
        "The server will not take the file. The photo stays on this phone.",
      allSafe: false,
    };
  }
  if (waiting > 0) {
    const holdingBack = options.wifiOnly && options.onWifi === false;
    return {
      title: `${photos(waiting)} waiting to back up`,
      detail: holdingBack
        ? "Waiting for Wi-Fi, as you chose. They stay safe on this phone."
        : "They go up by themselves when you have signal. They stay safe on this phone.",
      allSafe: false,
    };
  }
  return {
    title: `${photos(sent)} backed up`,
    detail: "Every photo is safe on the server.",
    allSafe: true,
  };
}
