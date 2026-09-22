"use server";

import { DRILLHOLE_PRIORITIES, type DrillholePriority } from "@corechain/domain";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/session";

export type ActionResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };

// E11-2 / dynamic assignment / E11-7: a manager only ever acts within their
// own organization_id, so one team can never see or touch another's holes or
// people, same isolation as the sync rules.

type ManagerContext = { userId: string; organizationId: string };

async function requireOwnHole(
  drillholeId: string,
): Promise<ManagerContext | { error: string }> {
  const session = await requireProjectManager();
  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? null;
  if (!organizationId) return { error: "You aren't on a team yet." };

  const hole = await prisma.drillhole.findUnique({
    where: { id: drillholeId },
    select: { organizationId: true },
  });
  if (!hole || hole.organizationId !== organizationId) {
    return { error: "That hole isn't on your team." };
  }
  return { userId: session.user.id, organizationId };
}

export async function assignHoleAction(
  drillholeId: string,
  userId: string | null,
): Promise<ActionResult> {
  const context = await requireOwnHole(drillholeId);
  if ("error" in context) return { ok: false, error: context.error };
  const { organizationId } = context;

  if (userId) {
    const member = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!member || member.organizationId !== organizationId) {
      return { ok: false, error: "That person isn't on your team." };
    }
    await prisma.holeAssignment.upsert({
      where: { drillholeId },
      create: {
        drillholeId,
        userId,
        assignedBy: context.userId,
      },
      update: {
        userId,
        assignedBy: context.userId,
        assignedAt: new Date(),
      },
    });
  } else {
    await prisma.holeAssignment.deleteMany({ where: { drillholeId } });
  }

  revalidatePath("/team");
  return { ok: true };
}

export async function setHolePriorityAction(
  drillholeId: string,
  priority: string,
  note: string,
): Promise<ActionResult> {
  if (!DRILLHOLE_PRIORITIES.includes(priority as DrillholePriority)) {
    return { ok: false, error: "Unknown priority." };
  }
  const context = await requireOwnHole(drillholeId);
  if ("error" in context) return { ok: false, error: context.error };

  const trimmedNote = note.trim().slice(0, 280) || null;
  await prisma.drillhole.update({
    where: { id: drillholeId },
    data: {
      priority: priority as DrillholePriority,
      priorityNote: priority === "urgent" ? trimmedNote : null,
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  revalidatePath("/team");
  return { ok: true };
}
