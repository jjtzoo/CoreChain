"use server";

import {
  canReviewLaboratory,
  canReviewQaqc,
  canViewTeamOverview,
  classifySignInFailure,
  signInFailureMessage,
  validateSignInInput,
} from "@corechain/domain";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getSession } from "@/lib/session";

/** `email` is sent back so a failed try keeps what was typed (React clears the form). */
export type SignInState = { error: string | null; email: string };

export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const problems = validateSignInInput(email, password);
  if (problems.email || problems.password) {
    return { error: problems.email ?? problems.password ?? null, email };
  }

  try {
    await auth.api.signInEmail({
      body: { email: email.trim(), password },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      const code = (error.body as { code?: string } | undefined)?.code;
      return {
        error: signInFailureMessage(
          classifySignInFailure(error.statusCode, code),
        ),
        email,
      };
    }
    return { error: signInFailureMessage("server"), email };
  }

  // Outside the try block: redirect() works by throwing.
  const session = await getSession();
  if (session && canViewTeamOverview(session.user.role)) redirect("/team");
  if (session && canReviewQaqc(session.user.role)) redirect("/qaqc");
  if (session && canReviewLaboratory(session.user.role)) redirect("/laboratory");
  redirect("/admin/users");
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
