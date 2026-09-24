import { CODE_CATEGORIES, CODE_CATEGORY_LABELS } from "@corechain/domain";
import type { Route } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/session";
import { CodeImport } from "./code-import";
import { ProjectPicker } from "./project-picker";

// E16: a project manager imports the company's code scheme into one
// project's code library from a CSV or Excel file.

export default async function CodeLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const session = await requireProjectManager();
  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? null;

  const header = (
    <div className="admin-page-header">
      <div>
        <Link href={"/team" as Route} className="admin-link">
          ← Team overview
        </Link>
        <h1>Code library</h1>
        <p>
          Import your company&apos;s logging codes from a spreadsheet. Geologists
          get them on the phone&apos;s Code library and in the log pickers after
          their next sync.
        </p>
      </div>
    </div>
  );

  if (!organizationId) {
    return (
      <>
        {header}
        <p className="admin-hint">You aren&apos;t on a team yet. Ask an admin to add you to one.</p>
      </>
    );
  }

  const projects = await prisma.project.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (projects.length === 0) {
    return (
      <>
        {header}
        <p className="admin-hint">
          Your team has no projects yet. A project appears here once a geologist
          creates it on the phone and it syncs.
        </p>
      </>
    );
  }

  const { project: requested } = await searchParams;
  const project = projects.find((p) => p.id === requested) ?? projects[0];

  const codes = await prisma.codeLibraryEntry.findMany({
    where: { projectId: project.id, deletedAt: null },
    orderBy: [{ category: "asc" }, { code: "asc" }],
    select: { category: true, code: true, description: true, hidden: true },
  });

  return (
    <>
      {header}

      <div style={{ display: "grid", gap: 20 }}>
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Project</h2>
          </div>
          <ProjectPicker projects={projects} selectedId={project.id} />
          <div>
            <div className="kpi-strip-label">Codes in this project now</div>
            <div className="code-count-grid">
              {CODE_CATEGORIES.map((category) => {
                const inCategory = codes.filter((c) => c.category === category);
                const hidden = inCategory.filter((c) => c.hidden).length;
                return (
                  <div key={category} className="stat-cell">
                    <div className="stat-cell-label">{CODE_CATEGORY_LABELS[category]}</div>
                    <div className="stat-cell-value">
                      {inCategory.length}
                      {hidden > 0 ? (
                        <span className="code-count-note"> · {hidden} hidden</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <CodeImport
          key={project.id}
          projectId={project.id}
          projectName={project.name}
          existing={codes.map((c) => ({
            category: c.category,
            code: c.code,
            description: c.description,
          }))}
        />
      </div>
    </>
  );
}
