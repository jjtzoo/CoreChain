"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

// A project page's tabs. The 3D view is one of them (D18, E18).
const TABS = [
  { path: "", label: "Summary" },
  { path: "/holes", label: "Holes" },
  { path: "/3d", label: "3D view" },
  { path: "/lab", label: "Samples & lab" },
  { path: "/report", label: "Progress report" },
] as const;

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/team/projects/${projectId}`;
  return (
    <nav className="mg-tabs mg-no-print" aria-label="Project">
      {TABS.map((tab) => {
        const href = `${base}${tab.path}`;
        const active = pathname === href;
        return (
          <Link
            key={tab.label}
            href={href as Route}
            className={active ? "is-active" : undefined}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
