import "server-only";

import { prisma } from "@/lib/prisma";

// E12-4: who may change the team's standards-and-blanks list. The project
// manager and the QA/QC reviewer for the laboratory-and-assays stage keep it;
// QA/QC reviewers for the other stages can read it but not change it.

export type QcReferenceAccess = {
  userId: string;
  organizationId: string | null;
  canEdit: boolean;
};

export async function qcReferenceAccess(userId: string): Promise<QcReferenceAccess> {
  const self = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, role: true, qaqcStage: true },
  });
  const canEdit =
    self?.role === "project_manager" ||
    (self?.role === "qaqc" && self.qaqcStage === "laboratory_assays");
  return { userId, organizationId: self?.organizationId ?? null, canEdit };
}
