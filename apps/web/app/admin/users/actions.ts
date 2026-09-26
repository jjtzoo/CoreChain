"use server";

import {
  isUserRole,
  QAQC_STAGES,
  suggestPassphrase,
  type QaqcStage,
  type UserRole,
} from "@corechain/domain";
import { APIError } from "better-auth/api";
import { randomInt } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  loadDemoProjects,
  removeDemo,
  type DemoSummary,
} from "@/lib/demo/demoProjects";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

// Every action starts with requireAdmin(): the buttons only exist for admins,
// but the server never trusts that. Better Auth then checks the admin's rights
// again on its own side for each call.

export type ActionResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };

const MIN_PASSWORD = 10;

function describe(error: unknown): string {
  if (error instanceof APIError) {
    const code = (error.body as { code?: string } | undefined)?.code;
    if (
      code === "USER_ALREADY_EXISTS" ||
      code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
    ) {
      return "There is already an account with that email.";
    }
    if (code === "PASSWORD_TOO_SHORT") {
      return `Use at least ${MIN_PASSWORD} characters.`;
    }
  }
  return "That didn't work. Try again.";
}

export async function suggestPasswordAction(): Promise<string> {
  await requireAdmin();
  return suggestPassphrase(randomInt);
}

export async function createUserAction(input: {
  name: string;
  email: string;
  role: string;
  password: string;
  organizationId?: string | null;
  title?: string | null;
}): Promise<ActionResult<{ email: string; password: string }>> {
  await requireAdmin();
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Enter the person's name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That doesn't look like an email address." };
  }
  if (!isUserRole(input.role))
    return { ok: false, error: "Choose what this person can do." };
  if (input.password.length < MIN_PASSWORD) {
    return {
      ok: false,
      error: `The password needs at least ${MIN_PASSWORD} characters.`,
    };
  }
  const organizationId = input.organizationId?.trim() || null;
  if (organizationId) {
    const team = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!team) return { ok: false, error: "That team no longer exists." };
  }
  const title = input.title?.trim() || null;

  try {
    const created = await auth.api.createUser({
      body: { name, email, password: input.password, role: input.role },
      headers: await headers(),
    });
    if (organizationId || title) {
      await prisma.user.update({
        where: { id: created.user.id },
        data: { organizationId, title },
      });
    }
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
  // The person asked for access on the landing page: that request is now handled.
  await prisma.accessRequest.updateMany({
    where: { email, status: "new" },
    data: { status: "accepted" },
  });
  revalidatePath("/admin/users");
  return { ok: true, email, password: input.password };
}

export async function setRoleAction(
  userId: string,
  role: string,
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (!isUserRole(role)) return { ok: false, error: "Unknown tier." };
  if (userId === session.user.id) {
    return {
      ok: false,
      error: "You can't change your own tier: that could lock everyone out.",
    };
  }
  try {
    await auth.api.setRole({
      body: { userId, role: role satisfies UserRole },
      headers: await headers(),
    });
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

// E11-1: a team an admin groups accounts into, so their data stays isolated
// from every other team (and from solo testers in their own personal
// workspace). See the comment on Organization in prisma/schema.prisma for
// what changing a user's team does and does not move.

export async function createTeamAction(
  name: string,
  withDemoProjects = false,
): Promise<ActionResult<{ id: string; name: string; demo: DemoSummary[] | null }>> {
  const session = await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Enter a team name." };
  if (trimmed.length > 120) {
    return { ok: false, error: "Keep the team name under 120 characters." };
  }
  const team = await prisma.organization.create({
    data: { name: trimmed },
  });
  // The automatic option: a new team starts with the demo projects, so its
  // manager and geologists have something to look at from the first sign-in.
  let demo: DemoSummary[] | null = null;
  if (withDemoProjects) {
    try {
      demo = await loadDemoProjects(prisma, {
        organizationId: team.id,
        requestedBy: { id: session.user.id, name: session.user.name },
      });
    } catch {
      revalidatePath("/admin/users");
      return {
        ok: false,
        error: `Team "${team.name}" was created, but the demo projects could not be added. Use "Add demo projects" on the team to try again.`,
      };
    }
  }
  revalidatePath("/admin/users");
  revalidatePath("/team");
  return { ok: true, id: team.id, name: team.name, demo };
}

/**
 * The manual option: add the demo projects to a team, or replace them
 * with a fresh copy. Anything recorded in the demo projects since is replaced.
 */
export async function loadDemoProjectsAction(
  teamId: string,
): Promise<ActionResult<{ demo: DemoSummary[] }>> {
  const session = await requireAdmin();
  const team = await prisma.organization.findUnique({ where: { id: teamId } });
  if (!team) return { ok: false, error: "That team no longer exists." };
  try {
    const demo = await loadDemoProjects(prisma, {
      organizationId: team.id,
      requestedBy: { id: session.user.id, name: session.user.name },
    });
    revalidatePath("/admin/users");
    revalidatePath("/team");
    return { ok: true, demo };
  } catch {
    return { ok: false, error: "The demo projects could not be added. Try again." };
  }
}

/** Removes the demo projects from a team, with everything recorded in them, and its demo crew. */
export async function removeDemoProjectsAction(
  teamId: string,
): Promise<ActionResult<{ removed: number }>> {
  await requireAdmin();
  const team = await prisma.organization.findUnique({ where: { id: teamId } });
  if (!team) return { ok: false, error: "That team no longer exists." };
  const removed = await prisma.$transaction(
    (tx) => removeDemo(tx, team.id),
    { timeout: 60_000, maxWait: 10_000 },
  );
  revalidatePath("/admin/users");
  revalidatePath("/team");
  return { ok: true, removed };
}

export async function setUserTitleAction(
  userId: string,
  title: string,
): Promise<ActionResult> {
  await requireAdmin();
  const trimmed = title.trim();
  if (trimmed.length > 80) {
    return { ok: false, error: "Keep the title under 80 characters." };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { title: trimmed || null },
  });
  revalidatePath("/admin/users");
  revalidatePath("/team");
  return { ok: true };
}

export async function setUserTeamAction(
  userId: string,
  organizationId: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (organizationId) {
    const team = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!team) return { ok: false, error: "That team no longer exists." };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { organizationId },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

// E12-1: which stage of the chain a QA/QC account reviews. Only meaningful
// for a "qaqc" tier account; setRoleAction does not clear it when a role
// changes away from qaqc, so a stage picked earlier is still there if the
// account is switched back.

export async function setQaqcStageAction(
  userId: string,
  stage: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (stage !== null && !(QAQC_STAGES as readonly string[]).includes(stage)) {
    return { ok: false, error: "Unknown stage." };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { qaqcStage: stage as QaqcStage | null },
  });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function resetPasswordAction(
  userId: string,
): Promise<ActionResult<{ password: string }>> {
  await requireAdmin();
  const password = suggestPassphrase(randomInt);
  try {
    await auth.api.setUserPassword({
      body: { userId, newPassword: password },
      headers: await headers(),
    });
    // A reset is often because a phone was lost: end the old sign-ins too.
    await auth.api.revokeUserSessions({
      body: { userId },
      headers: await headers(),
    });
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
  revalidatePath("/admin/users");
  return { ok: true, password };
}

export async function setSwitchedOffAction(
  userId: string,
  switchedOff: boolean,
): Promise<ActionResult> {
  const session = await requireAdmin();
  if (userId === session.user.id) {
    return { ok: false, error: "You can't switch off your own account." };
  }
  try {
    if (switchedOff) {
      await auth.api.banUser({
        body: { userId, banReason: "Switched off by an admin" },
        headers: await headers(),
      });
    } else {
      await auth.api.unbanUser({ body: { userId }, headers: await headers() });
    }
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function dismissRequestAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await prisma.accessRequest.update({
      where: { id },
      data: { status: "dismissed" },
    });
  } catch {
    return { ok: false, error: "That request could not be found." };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}
