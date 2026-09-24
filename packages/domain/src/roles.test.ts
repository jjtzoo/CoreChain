import { describe, expect, it } from "vitest";
import {
  canBeViewedAs,
  canManageUsers,
  DEFAULT_ROLE,
  isUserRole,
  ROLE_LABELS,
  ROLE_SUMMARIES,
  toUserRole,
  USER_ROLES,
  webHomeForRole,
} from "./roles";

describe("roles", () => {
  it("knows the five tiers, in the order the chain runs", () => {
    expect([...USER_ROLES]).toEqual([
      "geologist",
      "qaqc",
      "laboratory",
      "project_manager",
      "admin",
    ]);
    for (const role of USER_ROLES) expect(isUserRole(role)).toBe(true);
    expect(isUserRole("superuser")).toBe(false);
    expect(isUserRole(undefined)).toBe(false);
  });

  it("gives every tier a label and a one-line summary", () => {
    for (const role of USER_ROLES) {
      expect(ROLE_LABELS[role].length).toBeGreaterThan(0);
      expect(ROLE_SUMMARIES[role].length).toBeGreaterThan(10);
    }
    expect(ROLE_LABELS.project_manager).toBe("Resident / project manager");
  });

  it("falls back to the least-privileged tier for anything unknown", () => {
    expect(toUserRole("admin")).toBe("admin");
    expect(toUserRole("qaqc")).toBe("qaqc");
    expect(toUserRole("root")).toBe(DEFAULT_ROLE);
    expect(toUserRole(null)).toBe("geologist");
  });

  it("lets only admins manage users", () => {
    expect(canManageUsers("admin")).toBe(true);
    for (const role of USER_ROLES.filter((r) => r !== "admin")) {
      expect(canManageUsers(role)).toBe(false);
    }
    expect(canManageUsers(undefined)).toBe(false);
  });

  it("sends each tier to its own web page, and a geologist to none", () => {
    expect(webHomeForRole("project_manager")).toBe("/team");
    expect(webHomeForRole("qaqc")).toBe("/qaqc");
    expect(webHomeForRole("laboratory")).toBe("/laboratory");
    expect(webHomeForRole("admin")).toBe("/admin/users");
    expect(webHomeForRole("geologist")).toBeNull();
    expect(webHomeForRole(undefined)).toBeNull();
  });

  it("lets the admin view as web users only, never an admin or a switched-off account", () => {
    expect(canBeViewedAs({ role: "project_manager" })).toBe(true);
    expect(canBeViewedAs({ role: "qaqc", banned: false })).toBe(true);
    expect(canBeViewedAs({ role: "laboratory", banned: null })).toBe(true);
    expect(canBeViewedAs({ role: "laboratory", banned: true })).toBe(false);
    expect(canBeViewedAs({ role: "admin" })).toBe(false);
    expect(canBeViewedAs({ role: "geologist" })).toBe(false);
  });
});
