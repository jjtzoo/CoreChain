import { canManageUsers } from "@corechain/domain";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { signOutAction } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in | CoreChain" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const session = await getSession();
  if (session && canManageUsers(session.user.role)) redirect("/admin/users");

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="sign-in-title">
        <Image
          className="brand-logo"
          src="/branding/corechain-primary-horizontal.svg"
          alt="CoreChain"
          width={150}
          height={42}
          priority
        />
        <div className="auth-heading">
          <h1 id="sign-in-title">Sign in</h1>
          <p>The admin area is where accounts are created and tiers are set.</p>
        </div>

        {session ? (
          <div className="auth-notice" role="status">
            <p>
              {reason === "not-admin"
                ? `${session.user.email} is signed in, but this account can't open the admin area.`
                : `${session.user.email} is signed in.`}{" "}
              Sign out to use an admin account.
            </p>
            <form action={signOutAction}>
              <button type="submit" className="admin-button">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <LoginForm />
        )}
      </section>
    </main>
  );
}
