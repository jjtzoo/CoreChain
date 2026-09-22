import "server-only";

import {
  canManageUsers,
  canReviewLaboratory,
  canReviewQaqc,
  canViewTeamOverview,
} from "@corechain/domain";
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

/**
 * Guards the team overview (E11-2). Someone who isn't signed in goes to the
 * sign-in page; someone who isn't a resident / project manager is sent back
 * there too, with a note, and never sees another team's page.
 */
export async function requireProjectManager() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canViewTeamOverview(session.user.role)) {
    redirect("/login?reason=not-project-manager");
  }
  return session;
}

/**
 * Guards the QA/QC exceptions queue (E12). Someone who isn't signed in goes
 * to the sign-in page; someone who isn't a QA/QC account is sent back there
 * too, with a note, and never sees another team's evidence.
 */
export async function requireQaqc() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canReviewQaqc(session.user.role)) {
    redirect("/login?reason=not-qaqc");
  }
  return session;
}

/**
 * Guards the laboratory dispatch inbox (E13). Someone who isn't signed in
 * goes to the sign-in page; someone who isn't a laboratory account is sent
 * back there too, with a note, and never sees another team's dispatches.
 */
export async function requireLaboratory() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canReviewLaboratory(session.user.role)) {
    redirect("/login?reason=not-laboratory");
  }
  return session;
}
