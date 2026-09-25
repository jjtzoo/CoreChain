import type { Route } from "next";
import { StandardsPage } from "@/components/qc-references/standards-page";
import { requireQaqc } from "@/lib/session";

// E12-4: the laboratory QA/QC reviewer keeps the list; reviewers for the
// other stages can read it.

export default async function QaqcStandardsPage() {
  const session = await requireQaqc();
  return (
    <StandardsPage
      userId={session.user.id}
      back={{ href: "/qaqc" as Route, label: "QA/QC" }}
    />
  );
}
