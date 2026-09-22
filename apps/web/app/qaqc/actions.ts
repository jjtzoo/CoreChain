"use server";

import { isQaqcDecision } from "@corechain/domain";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireQaqc } from "@/lib/session";

export type ActionResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };

// E12-2 / E12-3: a QA/QC reviewer only ever acts within their own
// organization_id, same isolation as the team overview and sync rules.

async function requireOwnOrganization(): Promise<
  { userId: string; organizationId: string } | { error: string }
> {
  const session = await requireQaqc();
  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? null;
  if (!organizationId) return { error: "You aren't on a team yet." };
  return { userId: session.user.id, organizationId };
}

/** E12-2: dismiss an exception from the queue with a reason. */
export async function resolveExceptionAction(
  exceptionKey: string,
  reason: string,
): Promise<ActionResult> {
  const context = await requireOwnOrganization();
  if ("error" in context) return { ok: false, error: context.error };

  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    return { ok: false, error: "Explain why this is resolved." };
  }

  await prisma.qaqcExceptionResolution.upsert({
    where: {
      organizationId_exceptionKey: {
        organizationId: context.organizationId,
        exceptionKey,
      },
    },
    create: {
      organizationId: context.organizationId,
      exceptionKey,
      reason: trimmedReason.slice(0, 500),
      resolvedBy: context.userId,
    },
    update: {
      reason: trimmedReason.slice(0, 500),
      resolvedBy: context.userId,
      resolvedAt: new Date(),
    },
  });

  revalidatePath("/qaqc");
  return { ok: true };
}

/** E12-3: accept, hold or reject a hole, with a note. Appended, never edited. */
export async function recordQaqcDecisionAction(
  drillholeId: string,
  decision: string,
  note: string,
): Promise<ActionResult> {
  if (!isQaqcDecision(decision)) {
    return { ok: false, error: "Unknown decision." };
  }
  const context = await requireOwnOrganization();
  if ("error" in context) return { ok: false, error: context.error };

  const hole = await prisma.drillhole.findUnique({
    where: { id: drillholeId },
    select: { organizationId: true },
  });
  if (!hole || hole.organizationId !== context.organizationId) {
    return { ok: false, error: "That hole isn't on your team." };
  }

  await prisma.qaqcReviewDecision.create({
    data: {
      organizationId: context.organizationId,
      drillholeId,
      decision,
      note: note.trim().slice(0, 500) || null,
      decidedBy: context.userId,
    },
  });

  revalidatePath("/qaqc");
  return { ok: true };
}
