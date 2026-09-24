import "server-only";

import {
  canBeViewedAs,
  QAQC_STAGE_LABELS,
  ROLE_LABELS,
  toUserRole,
  USER_ROLES,
  type QaqcStage,
} from "@corechain/domain";
import { prisma } from "./prisma";

// "View as": the admin opens the web app exactly as one of the team sees it,
// to walk a visitor through each role without passwords. It uses the sign-in
// library's own impersonation: a short session for that person, marked with
// the admin who opened it, while the admin's own session waits in a separate
// cookie until "Return to admin".

export type ViewAsPerson = {
  id: string;
  name: string;
  /** "Laboratory", or for QA/QC the stage reviewed: "QA/QC, Core and logging". */
  roleLabel: string;
};

export function viewAsRoleLabel(role: unknown, stage: unknown): string {
  const label = ROLE_LABELS[toUserRole(role)];
  const stageLabel = QAQC_STAGE_LABELS[stage as QaqcStage];
  return toUserRole(role) === "qaqc" && stageLabel
    ? `${label}, ${stageLabel}`
    : label;
}

/**
 * The people the bar offers to switch to while viewing as `userId`: everyone
 * in the same team who has a web page, in the order the chain runs. Someone
 * in a personal workspace has no teammates, so only they are listed.
 */
export async function viewAsTeam(userId: string): Promise<ViewAsPerson[]> {
  const viewed = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  const people = await prisma.user.findMany({
    where: viewed?.organizationId
      ? { organizationId: viewed.organizationId }
      : { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      banned: true,
      qaqcStage: true,
    },
    orderBy: { name: "asc" },
  });
  const order = (role: string | null) =>
    USER_ROLES.indexOf((role ?? "") as (typeof USER_ROLES)[number]);
  return people
    .filter((person) => canBeViewedAs(person))
    .sort((a, b) => order(a.role) - order(b.role))
    .map((person) => ({
      id: person.id,
      name: person.name,
      roleLabel: viewAsRoleLabel(person.role, person.qaqcStage),
    }));
}
