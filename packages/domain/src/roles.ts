// Who can do what (decisions D13 and D15). The owner creates every account
// during the pilot and picks a tier for it. The tiers follow the people who
// actually touch a drill hole's evidence, in the order the chain runs, plus the
// admin who looks after the accounts (docs/product/mining-operations-context-and-roles.md).
//
//   geologist        the field geologist: logs core, photographs and samples
//                    at the rig or core yard (the phone app). The default.
//   qaqc             quality control for one stage of the chain: checks the
//                    evidence and exceptions for the core and logging, the
//                    sampling and custody, or the laboratory and assays.
//                    QA/QC starts in the field, so it is not one sign-off role.
//   laboratory       laboratory personnel: receive dispatches, prepare and
//                    assay samples, and return results.
//   project_manager  the resident or project manager: follows the team's
//                    projects and logs and the state of the whole chain.
//   admin            looks after accounts and tiers (web only). Not a mining
//                    role: it is how the owner runs the pilot.
//
// Only "admin" has any extra rights today. The other tiers are stored on the
// account and used to choose what to show (and which guide); the screens for
// them arrive after the field test.

export const USER_ROLES = [
  "geologist",
  "qaqc",
  "laboratory",
  "project_manager",
  "admin",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const DEFAULT_ROLE: UserRole = "geologist";

export const ROLE_LABELS: Record<UserRole, string> = {
  geologist: "Field geologist",
  qaqc: "QA/QC",
  laboratory: "Laboratory",
  project_manager: "Resident / project manager",
  admin: "Admin",
};

/** One line for the admin screen, so the choice explains itself. */
export const ROLE_SUMMARIES: Record<UserRole, string> = {
  geologist: "Logs core, photographs and samples in the field, on the phone app.",
  qaqc: "Checks the evidence and exceptions for one stage: core and logging, sampling and custody, or laboratory and assays.",
  laboratory: "Receives dispatched samples, prepares and assays them, and returns results.",
  project_manager: "Follows the team's projects, logs and the state of the chain.",
  admin: "Creates accounts and sets tiers. Web only.",
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

/** Only a resident / project manager may open the team overview (E11-2). */
export function canViewTeamOverview(role: unknown): boolean {
  return role === "project_manager";
}

/** Only a QA/QC account may open the exceptions queue (E12). */
export function canReviewQaqc(role: unknown): boolean {
  return role === "qaqc";
}

/** Only a laboratory account may open the dispatch inbox (E13). */
export function canReviewLaboratory(role: unknown): boolean {
  return role === "laboratory";
}

/**
 * The web page each tier opens after signing in, or null for a field
 * geologist, who works on the phone and has no web page. Sign-in and the
 * admin's "View as" both use it.
 */
export type WebHome = "/team" | "/qaqc" | "/laboratory" | "/admin/users";

export function webHomeForRole(role: unknown): WebHome | null {
  if (canViewTeamOverview(role)) return "/team";
  if (canReviewQaqc(role)) return "/qaqc";
  if (canReviewLaboratory(role)) return "/laboratory";
  if (canManageUsers(role)) return "/admin/users";
  return null;
}

/**
 * Whether the admin may open the web app as this person ("View as"): anyone
 * with a web page who is not an admin and not switched off.
 */
export function canBeViewedAs(user: {
  role: unknown;
  banned?: boolean | null;
}): boolean {
  if (user.banned === true || canManageUsers(user.role)) return false;
  return webHomeForRole(user.role) !== null;
}
