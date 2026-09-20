import { describe, expect, it } from "vitest";
import { canManageUsers, DEFAULT_ROLE, isUserRole, toUserRole } from "./roles";

describe("roles", () => {
  it("knows the three tiers", () => {
    expect(isUserRole("admin")).toBe(true);
    expect(isUserRole("project_manager")).toBe(true);
    expect(isUserRole("geologist")).toBe(true);
    expect(isUserRole("superuser")).toBe(false);
    expect(isUserRole(undefined)).toBe(false);
  });

  it("falls back to the least-privileged tier for anything unknown", () => {
    expect(toUserRole("admin")).toBe("admin");
    expect(toUserRole("root")).toBe(DEFAULT_ROLE);
    expect(toUserRole(null)).toBe("geologist");
  });

  it("lets only admins manage users", () => {
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("project_manager")).toBe(false);
    expect(canManageUsers("geologist")).toBe(false);
    expect(canManageUsers(undefined)).toBe(false);
  });
});
