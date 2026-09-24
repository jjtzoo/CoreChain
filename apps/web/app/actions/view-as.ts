"use server";

import { canBeViewedAs, webHomeForRole } from "@corechain/domain";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSession, requireAdmin } from "@/lib/session";
import { mergeSetCookies } from "@/lib/mergeSetCookies";

export type ViewAsResult = { ok: false; error: string };

async function viewable(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, banned: true },
  });
  return user && canBeViewedAs(user) ? user : null;
}

/** Admin, Users: open the web app as this person. */
export async function viewAsAction(userId: string): Promise<ViewAsResult> {
  await requireAdmin();
  const user = await viewable(userId);
  if (!user) {
    return {
      ok: false,
      error:
        "This account has no web page to open. Field geologists work on the phone, and admins and switched-off accounts can't be viewed.",
    };
  }
  try {
    await auth.api.impersonateUser({
      body: { userId },
      headers: await headers(),
    });
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
  redirect(webHomeForRole(user.role) ?? "/admin/users");
}

/**
 * The bar's switch buttons: back to the admin's own session, then straight
 * on as the next person, in one step.
 */
export async function switchViewAction(userId: string): Promise<void> {
  const session = await getSession();
  if (!session?.session.impersonatedBy) redirect("/login");
  const user = await viewable(userId);
  if (!user) redirect(webHomeForRole(session.user.role) ?? "/login");

  const request = await headers();
  const stopped = await auth.api.stopImpersonating({
    headers: request,
    returnHeaders: true,
  });
  const asAdmin = new Headers(request);
  asAdmin.set(
    "cookie",
    mergeSetCookies(
      request.get("cookie") ?? "",
      stopped.headers.getSetCookie(),
    ),
  );
  try {
    await auth.api.impersonateUser({ body: { userId }, headers: asAdmin });
  } catch {
    // The admin is back in their own session; the Users page says nothing
    // went wrong beyond this person not being viewable any more.
    redirect("/admin/users");
  }
  redirect(webHomeForRole(user.role) ?? "/admin/users");
}

/** The bar's "Return to admin". */
export async function stopViewingAction(): Promise<void> {
  const session = await getSession();
  if (session?.session.impersonatedBy) {
    await auth.api.stopImpersonating({ headers: await headers() });
  }
  redirect("/admin/users");
}

function failure(error: unknown): string {
  if (error instanceof APIError) {
    const message = (error.body as { message?: string } | undefined)?.message;
    if (message) return `Couldn't open this view: ${message}`;
  }
  return "Couldn't open this view. Try again.";
}
