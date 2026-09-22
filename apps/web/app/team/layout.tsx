import type { Metadata } from "next";
import Image from "next/image";
import { requireProjectManager } from "@/lib/session";
import { signOutAction } from "../login/actions";

export const metadata: Metadata = { title: "Team | CoreChain" };

// Every page under /team is dynamic and checks the session first.
export const dynamic = "force-dynamic";

export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireProjectManager();

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <Image
            className="brand-logo"
            src="/branding/corechain-primary-horizontal.svg"
            alt="CoreChain"
            width={150}
            height={42}
            priority
          />
          <div className="admin-account">
            <span className="admin-account-email">{session.user.email}</span>
            <form action={signOutAction}>
              <button type="submit" className="admin-button">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="admin-main admin-main--wide">{children}</main>
    </div>
  );
}
