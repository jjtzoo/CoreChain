import type { Metadata } from "next";
import Image from "next/image";
import { requireAdmin } from "@/lib/session";
import { signOutAction } from "../login/actions";

export const metadata: Metadata = { title: "Admin | CoreChain" };

// Every page under /admin is dynamic and checks the session first.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();

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
          <nav className="admin-nav" aria-label="Admin">
            <span className="admin-nav-item" aria-current="page">
              Users
            </span>
          </nav>
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
      <main className="admin-main">{children}</main>
    </div>
  );
}
