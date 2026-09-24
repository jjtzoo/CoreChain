import type { Metadata } from "next";
import Image from "next/image";
import { requireLaboratory } from "@/lib/session";
import { ViewAsBar } from "@/components/view-as-bar";
import { signOutAction } from "../login/actions";

export const metadata: Metadata = { title: "Laboratory | CoreChain" };

// Every page under /laboratory is dynamic and checks the session first.
export const dynamic = "force-dynamic";

export default async function LaboratoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireLaboratory();

  return (
    <div className="admin-shell">
      <ViewAsBar session={session} />
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
