"use server";

import { isFeedbackStatus } from "@corechain/domain";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export type FeedbackActionResult = { ok: true } | { ok: false; error: string };

/** Sets a message's status and the note the tester can see later. */
export async function updateFeedbackAction(
  id: string,
  status: string,
  note: string,
): Promise<FeedbackActionResult> {
  await requireAdmin();
  if (!isFeedbackStatus(status)) return { ok: false, error: "Unknown status." };
  const trimmed = note.trim().slice(0, 1000);
  try {
    await prisma.feedback.update({
      where: { id },
      data: { status, note: trimmed.length > 0 ? trimmed : null },
    });
  } catch {
    return { ok: false, error: "That message could not be found." };
  }
  revalidatePath("/admin/feedback");
  return { ok: true };
}
