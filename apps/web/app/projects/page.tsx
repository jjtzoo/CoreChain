import Link from "next/link";
import { ArrowUpRight, FolderKanban } from "lucide-react";
import { AppShell } from "@/components/corechain/app-shell";
import { ProjectSnapshot } from "@/components/corechain/project-snapshot";

export default function ProjectsPage() {
  return (
    <AppShell activeItem="Projects">
      <div className="workspace-content">
        <header className="workspace-page-header">
          <div>
            <p className="page-kicker">Projects</p>
            <h1>Start with one dependable workflow.</h1>
            <p>
              The Alberta public-data workspace is the first CoreChain
              demonstration project.
            </p>
          </div>
        </header>

        <section className="project-list" aria-label="Available projects">
          <div className="project-list-marker">
            <FolderKanban aria-hidden="true" size={20} strokeWidth={1.5} />
            <span>1 available project</span>
          </div>
          <ProjectSnapshot />
        </section>

        <Link
          className="primary-action"
          href="/projects/alberta-drillhole-demo"
        >
          Open Alberta demo
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </Link>
      </div>
    </AppShell>
  );
}
