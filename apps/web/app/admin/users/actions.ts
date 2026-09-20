"use server";

import {
  isUserRole,
  suggestPassphrase,
  type UserRole,
} from "@corechain/domain";
import { APIError } from "better-auth/api";
import { randomInt } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
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

  try {
    await auth.api.createUser({
      body: { name, email, password: input.password, role: input.role },
      headers: await headers(),
    });
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
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
