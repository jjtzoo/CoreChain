"use server";

import { matchScan, scannedSampleNumber } from "@corechain/domain";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireLaboratory } from "@/lib/session";

export type ActionResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };

// E13: a laboratory account only ever acts within its own organization_id,
// same isolation as the team overview and QA/QC queue.

async function requireOwnOrganization(): Promise<
  { userId: string; userName: string; organizationId: string } | { error: string }
> {
  const session = await requireLaboratory();
  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? null;
  if (!organizationId) return { error: "You aren't on a team yet." };
  return { userId: session.user.id, userName: session.user.name, organizationId };
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
      handledBy: context.userName,
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

export type AssayImportInput = {
  sampleId: string;
  analyte: string;
  value: number | null;
  unit: string | null;
  belowDetection: boolean;
};

/**
 * Bulk version of enterAssayResultAction: the Laboratory screen's "Upload
 * results" import builds these rows client-side (packages/domain's
 * assayImport.ts) from a CSV the chemist maps themselves — there's no
 * official lab-certificate format to parse against, so every row is
 * re-validated here exactly as a manually typed one would be, batched into
 * one insert.
 */
export async function importAssayResultsAction(
  dispatchId: string,
  results: AssayImportInput[],
): Promise<ActionResult<{ imported: number }>> {
  const context = await requireOwnOrganization();
  if ("error" in context) return { ok: false, error: context.error };

  const dispatch = await ownDispatch(dispatchId, context.organizationId);
  if (!dispatch) return { ok: false, error: "That dispatch isn't on your team." };

  if (results.length === 0) {
    return { ok: false, error: "Nothing to import." };
  }
  if (results.length > 2000) {
    return { ok: false, error: "That's more results than one import can hold — split the file." };
  }

  const dispatchSamples = await prisma.dispatchSample.findMany({
    where: { dispatchId, deletedAt: null },
    select: { sampleId: true },
  });
  const dispatchedIds = new Set(dispatchSamples.map((s) => s.sampleId));

  const rows: {
    organizationId: string;
    dispatchId: string;
    sampleId: string;
    analyte: string;
    value: number | null;
    unit: string | null;
    belowDetection: boolean;
    enteredBy: string;
  }[] = [];
  for (const result of results) {
    if (!dispatchedIds.has(result.sampleId)) {
      return { ok: false, error: "One of those samples isn't in this dispatch." };
    }
    const analyte = result.analyte.trim();
    if (!analyte) {
      return { ok: false, error: "Every result needs an analyte." };
    }
    rows.push({
      organizationId: context.organizationId,
      dispatchId,
      sampleId: result.sampleId,
      analyte: analyte.slice(0, 40),
      value: result.value !== null && Number.isFinite(result.value) ? result.value : null,
      unit: result.unit?.trim().slice(0, 20) || null,
      belowDetection: result.belowDetection,
      enteredBy: context.userId,
    });
  }

  await prisma.assayResult.createMany({ data: rows });

  revalidatePath("/laboratory");
  return { ok: true, imported: rows.length };
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

export type ScanResult = {
  outcome: "received" | "already_received" | "not_dispatched";
  code: string;
  sampleNumber: string | null;
  dispatchNumber: string | null;
  holeId: string | null;
  projectName: string | null;
  urgent: boolean;
  receivedAt: string | null;
};

/**
 * Receive by scan: one bag's tag, scanned or typed. Finds the sample in any
 * batch dispatched to this team and records its "received" custody event,
 * the same event the dispatch's checklist records. A bag already received,
 * or not on any dispatch, is reported and nothing is written.
 */
export async function receiveScannedSampleAction(
  raw: string,
): Promise<ActionResult<{ scan: ScanResult }>> {
  const context = await requireOwnOrganization();
  if ("error" in context) return { ok: false, error: context.error };

  const code = scannedSampleNumber(raw);
  if (!code) return { ok: false, error: "Scan or type a sample number." };

  const lines = await prisma.dispatchSample.findMany({
    where: {
      organizationId: context.organizationId,
      deletedAt: null,
      dispatch: { deletedAt: null, status: "dispatched" },
      sample: {
        deletedAt: null,
        sampleNumber: { equals: code, mode: "insensitive" },
      },
    },
    select: {
      dispatch: { select: { id: true, dispatchNumber: true, projectId: true } },
      sample: {
        select: {
          id: true,
          sampleNumber: true,
          drillhole: {
            select: { holeId: true, priority: true, project: { select: { name: true } } },
          },
        },
      },
    },
  });
  const received = lines.length
    ? await prisma.custodyEvent.findMany({
        where: {
          eventType: "received",
          sampleId: { in: lines.map((l) => l.sample.id) },
          dispatchId: { in: lines.map((l) => l.dispatch.id) },
        },
        select: { sampleId: true, dispatchId: true, occurredAt: true },
      })
    : [];
  const receivedAt = (sampleId: string, dispatchId: string) =>
    received
      .find((e) => e.sampleId === sampleId && e.dispatchId === dispatchId)
      ?.occurredAt.toISOString() ?? null;

  const outcome = matchScan(
    code,
    lines.map((l) => ({
      sampleId: l.sample.id,
      sampleNumber: l.sample.sampleNumber,
      dispatchId: l.dispatch.id,
      dispatchNumber: l.dispatch.dispatchNumber,
      receivedAt: receivedAt(l.sample.id, l.dispatch.id),
    })),
  );
  if (outcome.kind === "empty") {
    return { ok: false, error: "Scan or type a sample number." };
  }
  if (outcome.kind === "not_dispatched") {
    return {
      ok: true,
      scan: {
        outcome: "not_dispatched",
        code,
        sampleNumber: null,
        dispatchNumber: null,
        holeId: null,
        projectName: null,
        urgent: false,
        receivedAt: null,
      },
    };
  }

  const { candidate } = outcome;
  const line = lines.find(
    (l) => l.sample.id === candidate.sampleId && l.dispatch.id === candidate.dispatchId,
  )!;
  const scan: ScanResult = {
    outcome: outcome.kind === "receive" ? "received" : "already_received",
    code,
    sampleNumber: candidate.sampleNumber,
    dispatchNumber: candidate.dispatchNumber,
    holeId: line.sample.drillhole.holeId,
    projectName: line.sample.drillhole.project.name,
    urgent: line.sample.drillhole.priority === "urgent",
    receivedAt: candidate.receivedAt,
  };

  if (outcome.kind === "receive") {
    const occurredAt = new Date();
    await prisma.custodyEvent.create({
      data: {
        id: randomUUID(),
        organizationId: context.organizationId,
        projectId: line.dispatch.projectId,
        createdBy: context.userId,
        sampleId: candidate.sampleId,
        eventType: "received",
        occurredAt,
        handledBy: context.userName,
        note: "Received by scan",
        dispatchId: candidate.dispatchId,
        createdAt: occurredAt,
      },
    });
    scan.receivedAt = occurredAt.toISOString();
    revalidatePath("/laboratory");
  }

  return { ok: true, scan };
}
