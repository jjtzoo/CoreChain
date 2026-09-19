import Image from "next/image";
import { AppShell } from "@/components/corechain/app-shell";

/**
 * The office workspace starts empty, like the field app. Projects created in
 * CoreChain Field will appear here once cloud sync exists (Sprints 4-5 of the
 * mobile plan). The Alberta public-data demo still lives under
 * /projects/alberta-drillhole-demo, linked from the landing page only.
 */
export default function ProjectsPage() {
  return (
    <AppShell activeItem="Projects">
      <div className="workspace-content">
        <header className="workspace-page-header">
          <div>
            <p className="page-kicker">Projects</p>
            <h1>Projects</h1>
            <p>Follow the logs, samples and progress your field geologists record.</p>
          </div>
        </header>

        <section className="empty-state" aria-label="Projects">
          <Image
            src="/branding/corechain-symbol.svg"
            alt=""
            width={72}
            height={72}
            aria-hidden="true"
          />
          <h2>No projects yet</h2>
          <p>
            When geologists create projects and log core in the CoreChain Field
            app, they will show up here once syncing is switched on. Until then
            there is nothing to show.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
