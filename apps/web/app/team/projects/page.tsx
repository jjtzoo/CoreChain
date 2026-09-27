import { NoTeam, PageHead, ProjectCard } from "@/components/manager/parts";
import { loadHoles, loadProjectCards, loadSampleIdsWithResults, managerTeam } from "@/lib/manager/data";
import { requireProjectManager } from "@/lib/session";

// Projects: the team's projects. Each opens its own page: summary, holes, 3D
// view, samples and laboratory, and a progress report.

export default async function ProjectsPage() {
  const session = await requireProjectManager();
  const team = await managerTeam(session.user.id);
  if (!team) return <NoTeam title="Projects" />;

  const [holes, withResults] = await Promise.all([
    loadHoles(team.organizationId),
    loadSampleIdsWithResults(team.organizationId),
  ]);
  const projects = await loadProjectCards(team.organizationId, holes, withResults);

  return (
    <>
      <PageHead
        title="Projects"
        intro="Open a project for its summary, holes, 3D view, samples and laboratory, and a progress report to send on."
      />
      {projects.length === 0 ? (
        <p className="mg-empty">
          No projects yet. A project appears here once a geologist on this team creates it on the
          phone and syncs.
        </p>
      ) : (
        <div className="mg-projects">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </>
  );
}
