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

/** E12-4: add a line to the standards-and-blanks list, or change one. */
export async function saveQcReferenceAction(
  input: QcReferenceInput,
  id: string | null,
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

  try {
    if (id) {
      const existing = await prisma.qcReferenceValue.findUnique({
        where: { id },
        select: { organizationId: true },
      });
      if (!existing || existing.organizationId !== context.organizationId) {
        return { ok: false, error: "That line isn't on your team's list." };
      }
      await prisma.qcReferenceValue.update({ where: { id }, data: value });
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

/** E12-4: remove a line. Results already checked against it are checked again without it. */
export async function removeQcReferenceAction(id: string): Promise<ActionResult> {
  const context = await requireEditor();
  if ("error" in context) return { ok: false, error: context.error };

  const { count } = await prisma.qcReferenceValue.deleteMany({
    where: { id, organizationId: context.organizationId },
  });
  if (count === 0) return { ok: false, error: "That line isn't on your team's list." };

  revalidate();
  return { ok: true };
}
