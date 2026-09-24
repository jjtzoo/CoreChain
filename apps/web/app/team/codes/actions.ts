"use server";

import { randomUUID } from "node:crypto";
import {
  CODE_CATEGORIES,
  CODE_IMPORT_MAX_ROWS,
  classifyCodeImport,
  summariseCodeImport,
  type CodeCategory,
  type CodeImportCandidate,
  type CodeImportRow,
  type CodeImportSummary,
} from "@corechain/domain";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/session";

export type ActionResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };

export type CodeImportOutcome = {
  summary: CodeImportSummary;
  /** Every row that was not added, with its reason, for the summary. */
  skipped: CodeImportRow[];
};

function isCodeCategory(value: unknown): value is CodeCategory {
  return (
    typeof value === "string" &&
    (CODE_CATEGORIES as readonly string[]).includes(value)
  );
}

function toCandidate(row: unknown): CodeImportCandidate | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  if (
    typeof r.rowNumber !== "number" ||
    typeof r.code !== "string" ||
    typeof r.description !== "string" ||
    typeof r.categoryText !== "string"
  ) {
    return null;
  }
  return {
    rowNumber: r.rowNumber,
    categoryText: r.categoryText.slice(0, 100),
    category: isCodeCategory(r.category) ? r.category : null,
    code: r.code.trim(),
    description: r.description.trim(),
  };
}

/**
 * E16: adds a spreadsheet's codes to one project's code library. The rows
 * were read and previewed in the browser, but every one is checked again
 * here against the library as it is now (a geologist's phone may have
 * synced a new code since the preview), with the same shared rule the
 * phone uses. Existing codes are never changed. New rows sync to every
 * phone on the project through the code_library stream like any other.
 */
export async function importCodesAction(
  projectId: string,
  rows: CodeImportCandidate[],
): Promise<ActionResult<CodeImportOutcome>> {
  const session = await requireProjectManager();
  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? null;
  if (!organizationId) return { ok: false, error: "You aren't on a team yet." };

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!project) return { ok: false, error: "That project isn't on your team." };

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "The file has no code rows to import." };
  }
  if (rows.length > CODE_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      error: `One import takes up to ${CODE_IMPORT_MAX_ROWS} rows. Split the file and import each part.`,
    };
  }
  const candidates: CodeImportCandidate[] = [];
  for (const row of rows) {
    const candidate = toCandidate(row);
    if (!candidate) return { ok: false, error: "The import could not be read. Upload the file again." };
    candidates.push(candidate);
  }

  const classified = await prisma.$transaction(async (tx) => {
    const existing = await tx.codeLibraryEntry.findMany({
      where: { projectId, deletedAt: null },
      select: { category: true, code: true, description: true },
    });
    const checked = classifyCodeImport(candidates, existing);

    const now = new Date();
    const data = checked.flatMap((row) =>
      row.status === "new"
        ? [
            {
              id: randomUUID(),
              organizationId,
              projectId,
              createdBy: session.user.id,
              category: row.category,
              code: row.code,
              description: row.description,
              hidden: false,
              createdAt: now,
              updatedAt: now,
              version: 1,
            },
          ]
        : [],
    );
    if (data.length > 0) await tx.codeLibraryEntry.createMany({ data });
    return checked;
  });

  revalidatePath("/team/codes");
  return {
    ok: true,
    summary: summariseCodeImport(classified),
    skipped: classified.filter((row) => row.status !== "new"),
  };
}
