import { describe, expect, it } from "vitest";
import {
  canManageUsers,
  DEFAULT_ROLE,
  isUserRole,
  ROLE_LABELS,
  ROLE_SUMMARIES,
  toUserRole,
  USER_ROLES,
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
});
