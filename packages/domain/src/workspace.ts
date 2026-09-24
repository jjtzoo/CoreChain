// Which workspace an account works in (decision D9, teams in E11-1): its team
// when an admin has put it on one, otherwise its personal workspace, whose id
// is the account's own id. The sync streams (`my_projects`), the team pages
// and the server's upload checks all have to agree on this one rule.

export function workspaceId(user: {
  id: string;
  organizationId: string | null;
}): string {
  return user.organizationId ?? user.id;
}

/**
 * A phone is filed under the workspace its account was in when it first
 * registered. When the account has moved since (put on a team, moved to
 * another team, or taken off one), returns the workspace to move the phone
 * to; null when it is already right.
 */
export function deviceWorkspaceChange(
  device: { organizationId: string },
  user: { id: string; organizationId: string | null },
): string | null {
  const current = workspaceId(user);
  return device.organizationId === current ? null : current;
}
