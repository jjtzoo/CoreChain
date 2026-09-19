// E1-4: staying signed in offline. A geologist signs in once and can then work
// for weeks with no signal; the app never locks them out at the rig. The
// session is counted from the last time the server confirmed it (sign-in or a
// successful sync). An expired session keeps local data readable but can't
// sync until the person signs in again.

export const OFFLINE_SESSION_DAYS = 30;
export const SESSION_WARN_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type SessionState = "active" | "expiring" | "expired";

export type SessionStatus = {
  state: SessionState;
  /** When the session stops being able to sync (ISO 8601). */
  expiresAt: string;
  /** Whole days left, rounded up; 0 once expired. */
  daysLeft: number;
  /** Local data stays readable in every state. */
  canReadLocalData: true;
  /** Only an unexpired session may upload or download. */
  canSync: boolean;
};

export type SessionOptions = {
  lifetimeDays?: number;
  warnDays?: number;
};

export function sessionStatus(
  lastVerifiedAt: string,
  now: Date,
  options: SessionOptions = {},
): SessionStatus {
  const lifetimeDays = options.lifetimeDays ?? OFFLINE_SESSION_DAYS;
  const warnDays = options.warnDays ?? SESSION_WARN_DAYS;

  const verified = new Date(lastVerifiedAt).getTime();
  if (Number.isNaN(verified)) {
    throw new Error(`Invalid session timestamp: ${lastVerifiedAt}`);
  }

  const expires = verified + lifetimeDays * DAY_MS;
  const msLeft = expires - now.getTime();
  const daysLeft = msLeft <= 0 ? 0 : Math.ceil(msLeft / DAY_MS);
  const state: SessionState =
    msLeft <= 0 ? "expired" : daysLeft <= warnDays ? "expiring" : "active";

  return {
    state,
    expiresAt: new Date(expires).toISOString(),
    daysLeft,
    canReadLocalData: true,
    canSync: state !== "expired",
  };
}

/** What the app tells the geologist; null when nothing needs saying. */
export function sessionMessage(status: SessionStatus): string | null {
  if (status.state === "expired") {
    return "Your sign-in has expired. Your data is safe on this phone, but it can't sync until you sign in again.";
  }
  if (status.state === "expiring") {
    const days = status.daysLeft === 1 ? "1 day" : `${status.daysLeft} days`;
    return `Connect to the internet within ${days} to keep syncing. Everything you have logged is safe on this phone.`;
  }
  return null;
}
