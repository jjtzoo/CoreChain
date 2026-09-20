import type { Metadata } from "next";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { AdminNav } from "./admin-nav";
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
  const newFeedback = await prisma.feedback.count({ where: { status: "new" } });

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
          <AdminNav newFeedback={newFeedback} />
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
