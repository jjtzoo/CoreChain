import { notFound } from "next/navigation";
import { DecisionTable, DispatchTable, Panel } from "@/components/manager/parts";
import { loadDecisionRows, loadDispatchRows, loadMembers, managedProject } from "@/lib/manager/data";
import { compareDispatchesForManager, RESULTS_OVERDUE_AFTER_DAYS } from "@/lib/manager/stats";
import { requireProjectManager } from "@/lib/session";

// A project's samples and laboratory tab: its dispatches with how long each
// has been at the laboratory, and every standing QA/QC decision on its holes.

export default async function ProjectLabPage({
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
  const [dispatches, decisions] = await Promise.all([
    loadDispatchRows(project.organizationId, now, projectId),
    loadDecisionRows(project.organizationId, members, projectId),
  ]);

  return (
    <div className="mg-grid-even">
      <Panel
        title="Dispatches"
        note={`Longest waiting first. A dispatch more than ${RESULTS_OVERDUE_AFTER_DAYS} days at the laboratory is marked.`}
      >
        <DispatchTable rows={[...dispatches].sort(compareDispatchesForManager)} showProject={false} />
      </Panel>
      <Panel
        title="QA/QC decisions"
        note="The decision standing for each hole in each stage. The QA/QC reviewer decides; this is read-only."
      >
        <DecisionTable rows={decisions} showProject={false} emptyText="No QA/QC decisions on this project yet." />
      </Panel>
    </div>
  );
}
