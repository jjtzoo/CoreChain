// Who can do what (decision D13 and the roles work that follows it).
// The owner creates every account during the pilot and picks a tier for it.
//
//   admin           the owner: creates accounts and sets tiers (web only).
//   project_manager follows the team's projects and logs; also uses the phone
//                   app like a geologist. Team features arrive after the
//                   field test; until then this tier is stored, not acted on.
//   geologist       the field user: works alone in a personal workspace.

export const USER_ROLES = ["admin", "project_manager", "geologist"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DEFAULT_ROLE: UserRole = "geologist";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  project_manager: "Project manager",
  geologist: "Field geologist",
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

/** Anything that isn't a known tier is treated as the least-privileged one. */
export function toUserRole(value: unknown): UserRole {
  return isUserRole(value) ? value : DEFAULT_ROLE;
}

/** Only admins may open the admin area. */
export function canManageUsers(role: unknown): boolean {
  return role === "admin";
}
