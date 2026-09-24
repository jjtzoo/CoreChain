import { describe, expect, it } from "vitest";
import { deviceWorkspaceChange, workspaceId } from "./workspace";

describe("workspaceId", () => {
  it("is the team when the account is on one", () => {
    expect(workspaceId({ id: "user-1", organizationId: "team-1" })).toBe("team-1");
  });

  it("is the personal workspace (the account's own id) otherwise", () => {
    expect(workspaceId({ id: "user-1", organizationId: null })).toBe("user-1");
  });
});

describe("deviceWorkspaceChange", () => {
  it("moves a phone registered before its account joined a team", () => {
    expect(
      deviceWorkspaceChange(
        { organizationId: "user-1" },
        { id: "user-1", organizationId: "team-1" },
      ),
    ).toBe("team-1");
  });

  it("moves a phone when its account moves to another team", () => {
    expect(
      deviceWorkspaceChange(
        { organizationId: "team-1" },
        { id: "user-1", organizationId: "team-2" },
      ),
    ).toBe("team-2");
  });

  it("moves a phone back to the personal workspace when the account leaves its team", () => {
    expect(
      deviceWorkspaceChange(
        { organizationId: "team-1" },
        { id: "user-1", organizationId: null },
      ),
    ).toBe("user-1");
  });

  it("leaves a phone that is already in the right workspace", () => {
    expect(
      deviceWorkspaceChange(
        { organizationId: "team-1" },
        { id: "user-1", organizationId: "team-1" },
      ),
    ).toBeNull();
  });
});
