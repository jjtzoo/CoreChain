"use server";

import { isQaqcDecision, type QaqcStage } from "@corechain/domain";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  computeDeviceExceptions,
  computeStageExceptions,
  loadStageHoles,
} from "@/lib/qaqc/stage-exceptions";
import { requireQaqc } from "@/lib/session";

export type ActionResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };

// E12-2 / E12-3: a QA/QC reviewer only ever acts within their own
// organization_id, same isolation as the team overview and sync rules.

async function requireOwnOrganization(): Promise<
  | { userId: string; organizationId: string; stage: QaqcStage | null }
  | { error: string }
> {
  const session = await requireQaqc();
  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true, qaqcStage: true },
  });
  const organizationId = self?.organizationId ?? null;
  if (!organizationId) return { error: "You aren't on a team yet." };
  return {
    userId: session.user.id,
    organizationId,
    stage: (self?.qaqcStage as QaqcStage | null) ?? null,
  };
}

/**
 * The reviewer's stage's exceptions as they stand now, so a resolution or a
 * decision keeps the evidence it was made on (change register item 2).
 */
async function currentExceptions(organizationId: string, stage: QaqcStage | null) {
  // Every hole, not just the one decided on: the laboratory checks read a
  // whole dispatch ("two in a row"), which can span holes.
  const now = new Date();
  const holes = await loadStageHoles(organizationId);
  const [stageExceptions, deviceExceptions] = await Promise.all([
    stage ? computeStageExceptions(organizationId, stage, holes, now) : [],
    computeDeviceExceptions(organizationId, now),
  ]);
  return [...stageExceptions, ...deviceExceptions];
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

  const exception = (
    await currentExceptions(context.organizationId, context.stage)
  ).find((e) => e.key === exceptionKey);
  // Resolving again after the condition has gone keeps the earlier copy.
  const snapshot = exception
    ? {
        drillholeId: exception.drillholeId || null,
        summary: exception.summary,
        evidence: exception.evidence,
      }
    : {};

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
      ...snapshot,
    },
    update: {
      ...snapshot,
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

  const resolved = new Set(
    (
      await prisma.qaqcExceptionResolution.findMany({
        where: { organizationId: context.organizationId },
        select: { exceptionKey: true },
      })
    ).map((r) => r.exceptionKey),
  );
  const openForHole = (
    await currentExceptions(context.organizationId, context.stage)
  )
    .filter((e) => e.drillholeId === drillholeId && !resolved.has(e.key))
    .map(({ key, kind, summary, evidence }) => ({ key, kind, summary, evidence }));

  await prisma.qaqcReviewDecision.create({
    data: {
      stage: context.stage,
      evidence: openForHole,
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
