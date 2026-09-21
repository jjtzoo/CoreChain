import { describe, expect, it } from "vitest";
import { compareVersions, versionMessage, versionStatus } from "./appVersion";

describe("compareVersions", () => {
  it("compares dotted-numeric versions numerically, not lexically", () => {
    expect(compareVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
    expect(compareVersions("0.9.0", "0.10.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
  });

  it("treats a missing part as 0", () => {
    expect(compareVersions("1.2", "1.2.0")).toBe(0);
    expect(compareVersions("1.2.1", "1.2")).toBeGreaterThan(0);
  });
});

describe("versionStatus", () => {
  it("is current when the server has never answered", () => {
    const status = versionStatus("0.1.0", null);
    expect(status.state).toBe("current");
    expect(status.canSync).toBe(true);
  });

  it("is current at or above the minimum", () => {
    expect(versionStatus("0.2.0", "0.2.0").state).toBe("current");
    expect(versionStatus("0.3.0", "0.2.0").state).toBe("current");
  });

  it("is outdated below the minimum, but local data stays readable", () => {
    const status = versionStatus("0.1.0", "0.2.0");
    expect(status.state).toBe("outdated");
    expect(status.canSync).toBe(false);
    expect(status.canReadLocalData).toBe(true);
  });
});

describe("versionMessage", () => {
  it("says nothing when current", () => {
    expect(versionMessage(versionStatus("0.2.0", "0.2.0"))).toBeNull();
  });

  it("tells the geologist to update, and that data is safe", () => {
    const message = versionMessage(versionStatus("0.1.0", "0.2.0"));
    expect(message).toContain("Update CoreChain");
    expect(message).toContain("safe on this phone");
  });
});
