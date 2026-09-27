import { HoleBoard } from "@/components/manager/hole-board";
import { NoTeam, PageHead } from "@/components/manager/parts";
import { loadDecisionRows, loadHoles, loadMembers, managerTeam, toHoleRows } from "@/lib/manager/data";
import { requireProjectManager } from "@/lib/session";

// Holes: every hole in the team, across projects. Assign a geologist and mark
// a hole urgent here.

export default async function HolesPage({
  searchParams,
}: {
  searchParams: Promise<{ hole?: string | string[] }>;
}) {
  const session = await requireProjectManager();
  const team = await managerTeam(session.user.id);
  if (!team) return <NoTeam title="Holes" />;
  const { hole } = await searchParams;

  const now = new Date();
  const members = await loadMembers(team.organizationId);
  const [holes, decisions] = await Promise.all([
    loadHoles(team.organizationId),
    loadDecisionRows(team.organizationId, members),
  ]);

  return (
    <>
      <PageHead
        title="Holes"
        intro="Every hole in the team, across projects. Urgent holes are listed first. Choose one to assign a geologist or mark it urgent."
      />
      <HoleBoard
        holes={toHoleRows(holes, members, decisions, now)}
        members={members}
        showProject
        initialHoleId={typeof hole === "string" ? hole : null}
      />
    </>
  );
}
