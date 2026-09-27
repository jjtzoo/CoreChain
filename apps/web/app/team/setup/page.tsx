import type { Route } from "next";
import Link from "next/link";
import { NoTeam, PageHead, Panel } from "@/components/manager/parts";
import { managerTeam } from "@/lib/manager/data";
import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/session";

// Setup: the lists the team logs and samples against, and each project's
// sampling settings. The settings are shown, not edited: a project belongs to
// the phones that sync it, and they change it under the project's Settings.

const LISTS: { href: string; title: string; detail: string }[] = [
  {
    href: "/team/codes",
    title: "Code library",
    detail: "Lithology, alteration, mineralisation and weathering codes, imported from a spreadsheet.",
  },
  {
    href: "/team/standards",
    title: "Standards and blanks",
    detail: "Certified values and limits the laboratory checks use.",
  },
  {
    href: "/team/tags",
    title: "Print tags",
    detail: "QR labels for sample bags, for a hole or a dispatch.",
  },
];

function rate(everyN: number): string {
  return everyN > 0 ? `1 in ${everyN}` : "Off";
}

export default async function SetupPage() {
  const session = await requireProjectManager();
  const team = await managerTeam(session.user.id);
  if (!team) return <NoTeam title="Setup" />;

  const projects = await prisma.project.findMany({
    where: { organizationId: team.organizationId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      coordinateSystem: true,
      samplePrefix: true,
      qcStandardEveryN: true,
      qcBlankEveryN: true,
      qcDuplicateEveryN: true,
      photoMaxMb: true,
    },
  });

  return (
    <>
      <PageHead title="Setup" intro="The lists the team logs and samples against, and each project's sampling settings." />

      <div className="mg-grid-even">
        <Panel title="Team lists">
          <ul className="mg-links">
            {LISTS.map((item) => (
              <li key={item.href}>
                <div>
                  {item.title}
                  <small>{item.detail}</small>
                </div>
                <Link href={item.href as Route} className="mg-button">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Project settings"
          note="Set on the phone, under the project's Settings. Changes reach this page after the phone syncs."
        >
          {projects.length === 0 ? (
            <p className="mg-empty">No projects yet.</p>
          ) : (
            <div className="mg-table-wrap">
              <table className="mg-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Prefix</th>
                    <th>Standard</th>
                    <th>Blank</th>
                    <th>Duplicate</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/team/projects/${p.id}` as Route}>{p.name}</Link>
                        <div className="mg-note">
                          {p.coordinateSystem} · photos up to {p.photoMaxMb} MB
                        </div>
                      </td>
                      <td className="is-id">{p.samplePrefix}</td>
                      <td>{rate(p.qcStandardEveryN)}</td>
                      <td>{rate(p.qcBlankEveryN)}</td>
                      <td>{rate(p.qcDuplicateEveryN)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
