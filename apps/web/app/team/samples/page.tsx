import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/session";

// Find a sample by the number on its tag, then open its trace. An exact match
// (ignoring capitals) opens straight away; otherwise the closest numbers are
// listed.

type Match = { id: string; sampleNumber: string; holeId: string; projectName: string };

export default async function FindSamplePage({
  searchParams,
}: {
  searchParams: Promise<{ number?: string }>;
}) {
  const session = await requireProjectManager();
  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? null;
  const { number: raw } = await searchParams;
  const query = (raw ?? "").trim();

  let matches: Match[] = [];
  if (organizationId && query) {
    const found = await prisma.sample.findMany({
      where: {
        organizationId,
        deletedAt: null,
        sampleNumber: { contains: query, mode: "insensitive" },
      },
      take: 25,
      select: {
        id: true,
        sampleNumber: true,
        drillhole: { select: { holeId: true } },
        project: { select: { name: true } },
      },
    });
    const exact = found.filter((s) => s.sampleNumber.toLowerCase() === query.toLowerCase());
    if (exact.length === 1) redirect(`/team/samples/${exact[0].id}` as Route);
    matches = found
      .map((s) => ({
        id: s.id,
        sampleNumber: s.sampleNumber,
        holeId: s.drillhole.holeId,
        projectName: s.project.name,
      }))
      .sort((a, b) => a.sampleNumber.localeCompare(b.sampleNumber, undefined, { numeric: true }));
  }

  return (
    <>
      <div className="admin-page-header">
        <div>
          <Link href={"/team" as Route} className="admin-link">
            ← Team overview
          </Link>
          <h1>Find a sample</h1>
          <p>
            Type the number on a bag tag to see that sample&apos;s whole
            chain: where it came from, every custody step, and its results.
          </p>
        </div>
      </div>

      {!organizationId ? (
        <p className="admin-hint">You aren&apos;t on a team yet. Ask an admin to add you to one.</p>
      ) : (
        <section className="admin-card">
          <form className="scan-form" action="/team/samples" method="get">
            <input
              name="number"
              className="scan-input"
              defaultValue={query}
              placeholder="Sample number, e.g. AB-0041"
              aria-label="Sample number"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <button type="submit" className="auth-submit">
              Find
            </button>
          </form>
          {query ? (
            matches.length === 0 ? (
              <p className="admin-hint" style={{ margin: 0 }}>
                No sample on your team matches &quot;{query}&quot;.
              </p>
            ) : (
              <ul className="admin-users">
                {matches.map((m) => (
                  <li key={m.id} className="admin-status">
                    <Link href={`/team/samples/${m.id}` as Route} className="record-link">
                      {m.sampleNumber}
                    </Link>
                    <span>
                      {m.holeId} · {m.projectName}
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </section>
      )}
    </>
  );
}
