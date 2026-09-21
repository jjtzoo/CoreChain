// E10-8: an app too old to sync safely, without ever locking a geologist out
// of their own data. The server states the oldest version it still accepts;
// below it, the phone keeps working offline exactly as before, and only
// syncing pauses until the person updates.

export type VersionState = "current" | "outdated";

export type VersionStatus = {
  state: VersionState;
  /** This phone's own app version. */
  appVersion: string;
  /** The oldest version the server still accepts, or null when not yet known. */
  minAppVersion: string | null;
  /** Local data stays readable and editable in every state. */
  canReadLocalData: true;
  /** Only a version at or above the minimum may sync. */
  canSync: boolean;
};

/**
 * Compares dotted-numeric versions, e.g. "0.10.0" > "0.9.0". A missing or
 * non-numeric part counts as 0.
 */
export function compareVersions(a: string, b: string): number {
  const partsOf = (value: string) =>
    value.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const left = partsOf(a);
  const right = partsOf(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/** `minAppVersion` is null before the server has ever answered: nothing is assumed. */
export function versionStatus(
  appVersion: string,
  minAppVersion: string | null,
): VersionStatus {
  const state: VersionState =
    minAppVersion && compareVersions(appVersion, minAppVersion) < 0
      ? "outdated"
      : "current";
  return {
    state,
    appVersion,
    minAppVersion,
    canReadLocalData: true,
    canSync: state !== "outdated",
  };
}

/** What the app tells the geologist; null when nothing needs saying. */
export function versionMessage(status: VersionStatus): string | null {
  if (status.state === "outdated") {
    return "Update CoreChain to keep syncing. Your data is safe on this phone and keeps saving here — it just cannot reach the server until you update.";
  }
  return null;
}
