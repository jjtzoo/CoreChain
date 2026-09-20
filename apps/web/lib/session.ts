import "server-only";

import { canManageUsers } from "@corechain/domain";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/** The signed-in person for this request, or null. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Guards every admin page and action. Someone who isn't signed in goes to the
 * sign-in page; someone who is signed in but isn't an admin is sent back there
 * too, with a note, and never sees an admin page.
 */
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canManageUsers(session.user.role)) redirect("/login?reason=not-admin");
  return session;
}
