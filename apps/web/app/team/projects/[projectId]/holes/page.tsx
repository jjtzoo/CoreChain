import { notFound } from "next/navigation";
import { HoleBoard } from "@/components/manager/hole-board";
import { loadDecisionRows, loadHoles, loadMembers, managedProject, toHoleRows } from "@/lib/manager/data";
import { requireProjectManager } from "@/lib/session";

// A project's holes tab: the same hole board as Holes, for this project only.

export default async function ProjectHolesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const session = await requireProjectManager();
  const { projectId } = await params;
  const project = await managedProject(session.user.id, projectId);
  if (!project) notFound();

  const now = new Date();
  const members = await loadMembers(project.organizationId);
  const [holes, decisions] = await Promise.all([
    loadHoles(project.organizationId, projectId),
    loadDecisionRows(project.organizationId, members, projectId),
  ]);

  return <HoleBoard holes={toHoleRows(holes, members, decisions, now)} members={members} showProject={false} />;
}
