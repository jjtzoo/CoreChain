import { describe, expect, it } from "vitest";
import { sessionMessage, sessionStatus } from "./session";

const SIGNED_IN = "2026-09-01T08:00:00.000Z";
const at = (iso: string) => new Date(iso);

describe("sessionStatus", () => {
  it("is active for most of the 30 days", () => {
    const status = sessionStatus(SIGNED_IN, at("2026-09-10T08:00:00.000Z"));
    expect(status.state).toBe("active");
    expect(status.daysLeft).toBe(21);
    expect(status.canSync).toBe(true);
    expect(status.expiresAt).toBe("2026-10-01T08:00:00.000Z");
  });

  it("warns from 3 days before it expires", () => {
    expect(sessionStatus(SIGNED_IN, at("2026-09-28T09:00:00.000Z")).state).toBe(
      "expiring",
    );
    expect(sessionStatus(SIGNED_IN, at("2026-09-28T07:00:00.000Z")).state).toBe(
      "active",
    );
  });

  it("rounds a part-day up so 'days left' never reads 0 while it still works", () => {
    const status = sessionStatus(SIGNED_IN, at("2026-10-01T02:00:00.000Z"));
    expect(status.state).toBe("expiring");
    expect(status.daysLeft).toBe(1);
    expect(status.canSync).toBe(true);
  });

  it("expires exactly at the end and keeps local data readable", () => {
    const status = sessionStatus(SIGNED_IN, at("2026-10-01T08:00:00.000Z"));
    expect(status.state).toBe("expired");
    expect(status.daysLeft).toBe(0);
    expect(status.canSync).toBe(false);
    expect(status.canReadLocalData).toBe(true);
  });

  it("honours a configured lifetime and warning window", () => {
    const status = sessionStatus(SIGNED_IN, at("2026-09-10T08:00:00.000Z"), {
      lifetimeDays: 14,
      warnDays: 7,
    });
    expect(status.state).toBe("expiring");
    expect(status.daysLeft).toBe(5);
  });

  it("refuses a timestamp it cannot read", () => {
    expect(() => sessionStatus("not a date", new Date())).toThrow(/Invalid/);
  });
});

describe("sessionMessage", () => {
  it("says nothing while the session is healthy", () => {
    expect(sessionMessage(sessionStatus(SIGNED_IN, at("2026-09-05T08:00:00.000Z")))).toBeNull();
  });

  it("tells the geologist how long they have, and that data is safe", () => {
    const message = sessionMessage(sessionStatus(SIGNED_IN, at("2026-09-29T08:00:00.000Z")));
    expect(message).toContain("2 days");
    expect(message).toContain("safe on this phone");
  });

  it("uses the singular for one day", () => {
    const message = sessionMessage(sessionStatus(SIGNED_IN, at("2026-09-30T08:00:00.000Z")));
    expect(message).toContain("1 day");
    expect(message).not.toContain("1 days");
  });

  it("explains an expired session without alarming about lost data", () => {
    const message = sessionMessage(sessionStatus(SIGNED_IN, at("2026-11-01T08:00:00.000Z")));
    expect(message).toContain("expired");
    expect(message).toContain("safe on this phone");
  });
});
