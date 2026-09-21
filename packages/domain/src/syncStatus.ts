// E8-4: what the phone tells the geologist about syncing. One place decides the
// wording so the home screen, the account screen and any later badge agree.
// The rule of thumb: never alarm someone who is simply out of signal; that is
// normal at a rig. Only changes the server refused are worth attention.

export type SyncFacts = {
  /** The session may sync (see sessionStatus). */
  canSync: boolean;
  /** The app is below the oldest version the server still accepts (see versionStatus, E10-8). */
  outdated: boolean;
  /** Connected to the sync service right now. */
  connected: boolean;
  connecting: boolean;
  uploading: boolean;
  downloading: boolean;
  /** The first download has finished at least once on this phone. */
  hasSynced: boolean;
  lastSyncedAt: string | null;
  /** Changes made on this phone that the server has not confirmed yet. */
  pending: number;
  /** Changes the server refused, still listed. */
  issues: number;
};

export type SyncTone = "ok" | "busy" | "waiting" | "attention" | "off";

export type SyncSummary = {
  tone: SyncTone;
  title: string;
  detail: string;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function formatAgo(iso: string, now: Date): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "a while ago";
  const elapsed = Math.max(0, now.getTime() - then);
  if (elapsed < MINUTE_MS) return "just now";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min ago`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)} h ago`;
  const days = Math.floor(elapsed / DAY_MS);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

const changes = (count: number) =>
  count === 1 ? "1 change" : `${count} changes`;

export function syncSummary(facts: SyncFacts, now: Date): SyncSummary {
  if (!facts.canSync) {
    if (facts.outdated) {
      return {
        tone: "off",
        title: "Update CoreChain to keep syncing",
        detail:
          "Your data is safe on this phone and keeps saving here. Update the app to send it to the server.",
      };
    }
    return {
      tone: "off",
      title: "Not syncing",
      detail:
        "Sign in again to send your work to the server. Everything stays on this phone.",
    };
  }
  if (facts.issues > 0) {
    return {
      tone: "attention",
      title: `${changes(facts.issues)} could not be sent`,
      detail:
        "The server did not accept them. They are kept on this phone; send feedback so we can look into it.",
    };
  }
  if (facts.connected && (facts.uploading || facts.pending > 0)) {
    return {
      tone: "busy",
      title: "Sending your work",
      detail:
        facts.pending > 0
          ? `${changes(facts.pending)} left to send.`
          : "Almost done.",
    };
  }
  if (!facts.connected && facts.pending > 0) {
    return {
      tone: "waiting",
      title: "Waiting for signal",
      detail: `${changes(facts.pending)} saved on this phone. They send by themselves when you are back online.`,
    };
  }
  if (!facts.hasSynced) {
    return facts.connected || facts.connecting
      ? {
          tone: "busy",
          title: "Loading your projects",
          detail: "This only takes a moment.",
        }
      : {
          tone: "waiting",
          title: "Not synced yet",
          detail: "Connect to the internet to load your projects from the server.",
        };
  }
  const last = facts.lastSyncedAt
    ? `Last synced ${formatAgo(facts.lastSyncedAt, now)}.`
    : "";
  if (!facts.connected) {
    return {
      tone: "waiting",
      title: "Working offline",
      detail: `Everything is saved on this phone. ${last}`.trim(),
    };
  }
  return { tone: "ok", title: "Up to date", detail: last };
}

/** What the server said about a change it did not accept, in plain words. */
export function describeSyncIssue(
  status: string,
  reason: string | null,
): string {
  if (status === "conflict")
    return "Changed elsewhere at the same time. The other version was kept and yours is saved for review.";
  switch (reason) {
    case "hard-delete-not-allowed":
      return "A removal was not accepted. Records are never deleted, only marked as removed.";
    case "parent-not-found":
      return "Belongs to a project or hole the server does not have.";
    case "duplicate-sample-number":
      return "That sample number is already used in this project.";
    case "not-found":
      return "The record it changes is not on the server.";
    case "not-allowed":
      return "The server does not allow this change.";
    default:
      return "The server could not accept this change.";
  }
}
