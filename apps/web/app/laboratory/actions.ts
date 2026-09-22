"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireLaboratory } from "@/lib/session";

export type ActionResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };

// E13: a laboratory account only ever acts within its own organization_id,
// same isolation as the team overview and QA/QC queue.

async function requireOwnOrganization(): Promise<
  { userId: string; organizationId: string } | { error: string }
> {
  const session = await requireLaboratory();
  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? null;
  if (!organizationId) return { error: "You aren't on a team yet." };
  return { userId: session.user.id, organizationId };
}

async function ownDispatch(dispatchId: string, organizationId: string) {
  return prisma.dispatch.findFirst({
    where: { id: dispatchId, organizationId, deletedAt: null },
    select: { id: true, projectId: true },
  });
}

/**
 * E13-2: record which of a dispatch's samples actually arrived. Only new
 * "received" custody events are inserted — a sample already confirmed is
 * left alone — so confirming again after adding a late arrival never
 * duplicates the earlier ones.
 */
export async function confirmReceiptAction(
  dispatchId: string,
  arrivedSampleIds: string[],
  note: string,
): Promise<ActionResult> {
  const context = await requireOwnOrganization();
  if ("error" in context) return { ok: false, error: context.error };

  const dispatch = await ownDispatch(dispatchId, context.organizationId);
  if (!dispatch) return { ok: false, error: "That dispatch isn't on your team." };

  const dispatchSamples = await prisma.dispatchSample.findMany({
    where: { dispatchId, deletedAt: null },
    select: { sampleId: true },
  });
  const dispatchedIds = new Set(dispatchSamples.map((s) => s.sampleId));
  const requested = arrivedSampleIds.filter((id) => dispatchedIds.has(id));
  if (requested.length === 0) {
    return { ok: false, error: "Choose at least one sample that arrived." };
  }

  const already = await prisma.custodyEvent.findMany({
    where: { dispatchId, eventType: "received" },
    select: { sampleId: true },
  });
  const alreadyReceived = new Set(already.map((e) => e.sampleId));
  const toRecord = requested.filter((id) => !alreadyReceived.has(id));
  if (toRecord.length === 0) return { ok: true };

  const occurredAt = new Date();
  const trimmedNote = note.trim().slice(0, 500) || null;
  await prisma.custodyEvent.createMany({
    data: toRecord.map((sampleId) => ({
      id: randomUUID(),
      organizationId: context.organizationId,
      projectId: dispatch.projectId,
      createdBy: context.userId,
      sampleId,
      eventType: "received" as const,
      occurredAt,
      handledBy: context.userId,
      note: trimmedNote,
      dispatchId,
      createdAt: occurredAt,
    })),
  });

  revalidatePath("/laboratory");
  return { ok: true };
}

/** E13-3: enter one analyte's result for one sample against a dispatch. */
export async function enterAssayResultAction(
  dispatchId: string,
  sampleId: string,
  input: { analyte: string; value: string; unit: string; belowDetection: boolean },
): Promise<ActionResult> {
  const context = await requireOwnOrganization();
  if ("error" in context) return { ok: false, error: context.error };

  const dispatch = await ownDispatch(dispatchId, context.organizationId);
  if (!dispatch) return { ok: false, error: "That dispatch isn't on your team." };

  const inDispatch = await prisma.dispatchSample.findFirst({
    where: { dispatchId, sampleId, deletedAt: null },
    select: { id: true },
  });
  if (!inDispatch) return { ok: false, error: "That sample isn't in this dispatch." };

  const analyte = input.analyte.trim();
  if (!analyte) return { ok: false, error: "Enter an analyte, e.g. Au or Cu." };
  const numericValue = input.value.trim() ? Number(input.value) : null;
  if (input.value.trim() && !Number.isFinite(numericValue)) {
    return { ok: false, error: "The value must be a number." };
  }

  await prisma.assayResult.create({
    data: {
      organizationId: context.organizationId,
      dispatchId,
      sampleId,
      analyte: analyte.slice(0, 40),
      value: numericValue,
      unit: input.unit.trim().slice(0, 20) || null,
      belowDetection: input.belowDetection,
      enteredBy: context.userId,
    },
  });

  revalidatePath("/laboratory");
  return { ok: true };
}

/** E13-3: mark a batch's results entry done, or reopen it to keep adding. */
export async function setResultsCompleteAction(
  dispatchId: string,
  complete: boolean,
): Promise<ActionResult> {
  const context = await requireOwnOrganization();
  if ("error" in context) return { ok: false, error: context.error };

  const dispatch = await ownDispatch(dispatchId, context.organizationId);
  if (!dispatch) return { ok: false, error: "That dispatch isn't on your team." };

  await prisma.dispatch.update({
    where: { id: dispatchId },
    data: { resultsReturnedAt: complete ? new Date() : null },
  });

  revalidatePath("/laboratory");
  return { ok: true };
}
