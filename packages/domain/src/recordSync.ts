// Per-record sync state (docs/product/corechain-mobile-mvp-scrum-plan.md, E8-4).
//
// The overall line ("Up to date", "3 changes waiting") lives in syncStatus.ts.
// This is the same idea for one record in a list: has it reached the server, is
// it still waiting, or did the server refuse something about it? A record is
// "waiting" when it, or anything filed under it, has a change not yet confirmed.
// Being out of signal is normal at a rig, so waiting is worded calmly; only a
// refused change asks for attention.

export type RecordSyncState = "sent" | "waiting" | "attention";

export type RecordSyncMarkers = {
  /** Ids of records with a change the server has not confirmed yet. */
  waiting: ReadonlySet<string>;
  /** Ids of records with a change the server refused. */
  attention: ReadonlySet<string>;
};

/** A refused change outranks a waiting one, which outranks a sent record. */
export function recordSyncState(
  id: string,
  markers: RecordSyncMarkers,
): RecordSyncState {
  if (markers.attention.has(id)) return "attention";
  if (markers.waiting.has(id)) return "waiting";
  return "sent";
}

/** The label for a badge, or null when the record is sent and needs none. */
export function recordSyncLabel(state: RecordSyncState): string | null {
  switch (state) {
    case "attention":
      return "Needs attention";
    case "waiting":
      return "Waiting to send";
    case "sent":
      return null;
  }
}

/** The plain-words line for a record's own screen, which always says something. */
export function recordSyncDetail(state: RecordSyncState): string {
  switch (state) {
    case "attention":
      return "The server did not accept a change here. Open Account to review it.";
    case "waiting":
      return "Saved on this phone. It goes to the server when you have signal.";
    case "sent":
      return "Sent to the server.";
  }
}
