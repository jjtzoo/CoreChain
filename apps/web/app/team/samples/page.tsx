import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/session";

// Find a sample by the number on its tag, or a hole by its name, then open it.
// An exact match (ignoring capitals) opens straight away; otherwise the
// closest samples and holes are listed. The top bar's search box lands here.

type SampleMatch = { id: string; sampleNumber: string; holeId: string; projectName: string };
type HoleMatch = { id: string; holeId: string; projectName: string };

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

  let samples: SampleMatch[] = [];
  let holes: HoleMatch[] = [];
  if (organizationId && query) {
    const [foundSamples, foundHoles] = await Promise.all([
      prisma.sample.findMany({
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
      }),
      prisma.drillhole.findMany({
        where: { organizationId, deletedAt: null, holeId: { contains: query, mode: "insensitive" } },
        take: 10,
        select: { id: true, holeId: true, project: { select: { name: true } } },
      }),
    ]);
    const lower = query.toLowerCase();
    const exactSamples = foundSamples.filter((s) => s.sampleNumber.toLowerCase() === lower);
    const exactHoles = foundHoles.filter((h) => h.holeId.toLowerCase() === lower);
    if (exactSamples.length === 1 && exactHoles.length === 0) {
      redirect(`/team/samples/${exactSamples[0].id}` as Route);
    }
    if (exactHoles.length === 1 && exactSamples.length === 0) {
      redirect(`/team/holes/${exactHoles[0].id}` as Route);
    }
    samples = foundSamples
      .map((s) => ({
        id: s.id,
        sampleNumber: s.sampleNumber,
        holeId: s.drillhole.holeId,
        projectName: s.project.name,
      }))
      .sort((a, b) => a.sampleNumber.localeCompare(b.sampleNumber, undefined, { numeric: true }));
    holes = foundHoles
      .map((h) => ({ id: h.id, holeId: h.holeId, projectName: h.project.name }))
      .sort((a, b) => a.holeId.localeCompare(b.holeId, undefined, { numeric: true }));
  }

  return (
    <>
      <div className="admin-page-header">
        <div>
          <Link href={"/team/lab" as Route} className="admin-link">
            ← Samples &amp; lab
          </Link>
          <h1>Find a sample or hole</h1>
          <p>
            Type the number on a bag tag to see that sample&apos;s whole
            chain: where it came from, every custody step, and its results.
            A hole&apos;s name opens its log.
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
              placeholder="Sample number or hole, e.g. AB-0041"
              aria-label="Sample number or hole"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <button type="submit" className="auth-submit">
              Find
            </button>
          </form>
          {query ? (
            samples.length === 0 && holes.length === 0 ? (
              <p className="admin-hint" style={{ margin: 0 }}>
                No sample or hole on your team matches &quot;{query}&quot;.
              </p>
            ) : (
              <ul className="admin-users">
                {holes.map((h) => (
                  <li key={h.id} className="admin-status">
                    <Link href={`/team/holes/${h.id}` as Route} className="record-link">
                      {h.holeId}
                    </Link>
                    <span>Hole · {h.projectName}</span>
                  </li>
                ))}
                {samples.map((m) => (
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
