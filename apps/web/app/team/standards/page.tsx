import type { Route } from "next";
import { StandardsPage } from "@/components/qc-references/standards-page";
import { requireProjectManager } from "@/lib/session";

// E12-4: the project manager keeps the team's standards-and-blanks list.

export default async function TeamStandardsPage() {
  const session = await requireProjectManager();
  return (
    <StandardsPage
      userId={session.user.id}
      back={{ href: "/team" as Route, label: "Team overview" }}
    />
  );
}
