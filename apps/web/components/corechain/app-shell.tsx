import Link from "next/link";
import Image from "next/image";
import type { Route } from "next";
import {
  Database,
  Drill,
  FileChartColumnIncreasing,
  FolderKanban,
  PackageCheck,
  TestTubeDiagonal,
} from "lucide-react";
import {
  albertaDemoProject,
  workspaceNavigation,
} from "@/lib/demo/alberta-project";

type AppShellProps = {
  activeItem:
    | "Overview"
    | "Projects"
    | "Drillholes"
    | "Samples"
    | "Dispatches"
    | "Assays and QA/QC";
  children: React.ReactNode;
};

const navigationIcons = {
  Overview: FileChartColumnIncreasing,
  Drillholes: Drill,
  Samples: TestTubeDiagonal,
  Dispatches: PackageCheck,
  "Assays and QA/QC": Database,
} as const;

export function AppShell({ activeItem, children }: AppShellProps) {
  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#main-content">
        Skip to workspace content
      </a>
      <header className="workspace-mobile-header">
        <Link className="workspace-brand" href="/" aria-label="CoreChain home">
          <Image className="brand-logo" src="/branding/corechain-primary-horizontal.svg" alt="CoreChain" width={150} height={42} priority />
        </Link>
        <span className="workspace-mobile-label">Demo workspace</span>
      </header>

      <aside className="workspace-sidebar">
        <div>
          <Link
            className="workspace-brand"
            href="/"
            aria-label="CoreChain home"
          >
          <Image className="brand-logo" src="/branding/corechain-primary-horizontal.svg" alt="CoreChain" width={150} height={42} priority />
        </Link>
          <p className="workspace-brand-note">Exploration workflow workspace</p>
        </div>

        <nav className="workspace-nav" aria-label="Project navigation">
          <Link
            className={`workspace-nav-item${activeItem === "Projects" ? " is-active" : ""}`}
            href="/projects"
          >
            <FolderKanban aria-hidden="true" size={17} strokeWidth={1.5} />
            Projects
          </Link>
          {workspaceNavigation.map((item) =>
            item.available ? (
              <Link
                className={`workspace-nav-item${activeItem === item.label ? " is-active" : ""}`}
                href={item.href as Route}
                key={item.label}
              >
                {(() => {
                  const Icon = navigationIcons[item.label];
                  return (
                    <Icon aria-hidden="true" size={17} strokeWidth={1.5} />
                  );
                })()}
                {item.label}
              </Link>
            ) : (
              <span
                className="workspace-nav-item is-disabled"
                aria-disabled="true"
                key={item.label}
              >
                {item.label}
              </span>
            ),
          )}
        </nav>

        <div className="workspace-source">
          <Database aria-hidden="true" size={17} strokeWidth={1.5} />
          <div>
            <span>Current workspace</span>
            <strong>{albertaDemoProject.dataOrigin}</strong>
          </div>
        </div>
      </aside>

      <main className="workspace-main" id="main-content">
        {children}
      </main>
    </div>
  );
}
