import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead } from "@/components/manager/parts";
import { ProjectTabs } from "@/components/manager/project-tabs";
import { managedProject } from "@/lib/manager/data";
import { requireProjectManager } from "@/lib/session";

// E18-1: one project, for the project manager, with tabs for its summary,
// holes, 3D evidence view, samples and laboratory, and progress report. Only
// projects in the manager's own team open; anything else is not found.

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const session = await requireProjectManager();
  const { projectId } = await params;
  const project = await managedProject(session.user.id, projectId);
  if (!project) notFound();

  const meta = [
    project.commodity,
    project.location,
    project.coordinateSystem,
    `sample prefix ${project.samplePrefix}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <div className="mg-no-print" style={{ display: "grid", gap: 14 }}>
        <PageHead
          title={project.name}
          intro={meta}
          crumb={
            <Link href={"/team/projects" as Route} className="admin-link">
              Projects
            </Link>
          }
        />
        <ProjectTabs projectId={project.id} />
      </div>
      {children}
    </>
  );
}
