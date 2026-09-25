"use server";

import {
  QC_REFERENCE_KINDS,
  validateQcReferenceValue,
  type QcReferenceKind,
  type QcReferenceValue,
} from "@corechain/domain";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { qcReferenceAccess } from "./access";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type QcReferenceInput = {
  kind: string;
  reference: string;
  analyte: string;
  unit: string;
  expectedValue: string;
  standardDeviation: string;
  maxValue: string;
};

function toNumber(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

async function requireEditor(): Promise<
  { userId: string; organizationId: string } | { error: string }
> {
  const session = await getSession();
  if (!session) return { error: "Sign in again." };
  const access = await qcReferenceAccess(session.user.id);
  if (!access.organizationId) return { error: "You aren't on a team yet." };
  if (!access.canEdit) {
    return {
      error:
        "Only the project manager or the laboratory QA/QC reviewer can change this list.",
    };
  }
  return { userId: access.userId, organizationId: access.organizationId };
}

function revalidate() {
  revalidatePath("/team/standards");
  revalidatePath("/qaqc/standards");
  revalidatePath("/qaqc");
}

const CHANGED_ELSEWHERE =
  "This line was changed or removed since the page opened. Reload to see the current list.";

function sameValues(a: QcReferenceValue, b: QcReferenceValue): boolean {
  return (
    a.reference === b.reference &&
    a.analyte === b.analyte &&
    (a.unit ?? null) === (b.unit ?? null) &&
    a.expectedValue === b.expectedValue &&
    a.standardDeviation === b.standardDeviation &&
    a.maxValue === b.maxValue
  );
}

/**
 * E12-4: add a line to the standards-and-blanks list, or change one. A change
 * never edits the line in place (change register item 2): it retires the
 * current revision and adds the next, with who changed it and why, so the
 * values behind earlier QA/QC decisions stay readable.
 */
export async function saveQcReferenceAction(
  input: QcReferenceInput,
  id: string | null,
  changeReason = "",
): Promise<ActionResult> {
  const context = await requireEditor();
  if ("error" in context) return { ok: false, error: context.error };

  if (!QC_REFERENCE_KINDS.includes(input.kind as QcReferenceKind)) {
    return { ok: false, error: "Choose standard or blank." };
  }
  const kind = input.kind as QcReferenceKind;
  const value: QcReferenceValue = {
    kind,
    reference: input.reference.trim(),
    analyte: input.analyte.trim(),
    unit: input.unit.trim() || null,
    expectedValue: kind === "standard" ? toNumber(input.expectedValue) : null,
    standardDeviation: kind === "standard" ? toNumber(input.standardDeviation) : null,
    maxValue: kind === "blank" ? toNumber(input.maxValue) : null,
  };
  const error = validateQcReferenceValue(value);
  if (error) return { ok: false, error };

  const reason = changeReason.trim().slice(0, 500);
  try {
    if (id) {
      const existing = await prisma.qcReferenceValue.findUnique({ where: { id } });
      if (!existing || existing.organizationId !== context.organizationId) {
        return { ok: false, error: "That line isn't on your team's list." };
      }
      if (existing.retiredAt) return { ok: false, error: CHANGED_ELSEWHERE };
      if (existing.kind !== value.kind) {
        return { ok: false, error: "A standard can't become a blank. Add a new line instead." };
      }
      if (sameValues(existing, value)) return { ok: true };
      if (!reason) {
        return {
          ok: false,
          error: "Say why this line is changing, for example \"corrected from the certificate\".",
        };
      }
      const outcome = await prisma.$transaction(async (tx) => {
        // Retire first: the new revision takes over the one current line.
        const { count } = await tx.qcReferenceValue.updateMany({
          where: { id, organizationId: context.organizationId, retiredAt: null },
          data: { retiredAt: new Date(), retiredBy: context.userId },
        });
        if (count === 0) return "changed" as const;
        await tx.qcReferenceValue.create({
          data: {
            ...value,
            organizationId: context.organizationId,
            createdBy: context.userId,
            revision: existing.revision + 1,
            supersedesId: existing.id,
            changeReason: reason,
          },
        });
        return "saved" as const;
      });
      if (outcome === "changed") return { ok: false, error: CHANGED_ELSEWHERE };
    } else {
      await prisma.qcReferenceValue.create({
        data: {
          ...value,
          organizationId: context.organizationId,
          createdBy: context.userId,
        },
      });
    }
  } catch (caught) {
    if (
      caught instanceof Prisma.PrismaClientKnownRequestError &&
      caught.code === "P2002"
    ) {
      return {
        ok: false,
        error: `${value.reference} already has a ${value.analyte} line. Edit that one instead.`,
      };
    }
    throw caught;
  }

  revalidate();
  return { ok: true };
}

/**
 * E12-4: stop using a line. It is retired, never deleted, so earlier
 * decisions can still show what it said; results are checked again without it.
 */
export async function removeQcReferenceAction(
  id: string,
  retireReason = "",
): Promise<ActionResult> {
  const context = await requireEditor();
  if ("error" in context) return { ok: false, error: context.error };

  const reason = retireReason.trim().slice(0, 500);
  if (!reason) {
    return { ok: false, error: "Say why this line is no longer used." };
  }
  const { count } = await prisma.qcReferenceValue.updateMany({
    where: { id, organizationId: context.organizationId, retiredAt: null },
    data: { retiredAt: new Date(), retiredBy: context.userId, retireReason: reason },
  });
  if (count === 0) return { ok: false, error: "That line isn't on your team's current list." };

  revalidate();
  return { ok: true };
}
