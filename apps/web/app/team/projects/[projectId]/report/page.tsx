import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/manager/print-button";
import {
  loadDecisionRows,
  loadDispatchRows,
  loadHoles,
  loadMembers,
  managedProject,
  toHoleRows,
} from "@/lib/manager/data";
import { CONTROL_LABELS, STATUS_LABELS, plural } from "@/lib/manager/labels";
import { prisma } from "@/lib/prisma";
import {
  daysLabel,
  formatDay,
  formatMetres,
  metresDrilledBetween,
  percentOf,
  qcInsertion,
  REPORT_PERIOD_LABELS,
  REPORT_PERIODS,
  reportPeriodStart,
  toReportPeriod,
} from "@/lib/manager/stats";
import { requireProjectManager } from "@/lib/session";

// A project's progress report: one page for the exploration manager, printed
// or saved as PDF from the browser. Recorded data only, never a forecast.

export default async function ProjectReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const session = await requireProjectManager();
  const { projectId } = await params;
  const period = toReportPeriod((await searchParams).period);
  const project = await managedProject(session.user.id, projectId);
  if (!project) notFound();
  const { organizationId } = project;

  const now = new Date();
  const from = period === "all" ? project.createdAt : reportPeriodStart(period, now);
  const members = await loadMembers(organizationId);
  const [holes, decisions, dispatches, statusChanges] = await Promise.all([
    loadHoles(organizationId, projectId),
    loadDecisionRows(organizationId, members, projectId),
    loadDispatchRows(organizationId, now, projectId),
    prisma.drillholeStatusHistory.findMany({
      where: { organizationId, projectId, changedAt: { gte: from, lte: now } },
      orderBy: { changedAt: "asc" },
      select: { drillholeId: true, status: true, changedAt: true },
    }),
  ]);
  const holeRows = toHoleRows(holes, members, decisions, now);
  const holeName = new Map(holeRows.map((h) => [h.id, h.holeId]));
  const inPeriod = (at: Date) => at >= from && at <= now;

  const plannedM = holeRows.reduce((sum, h) => sum + h.plannedDepthM, 0);
  const drilledM = holeRows.reduce((sum, h) => sum + h.drilledM, 0);
  const drilledInPeriod = metresDrilledBetween(holes.flatMap((h) => h.runs), from, now);
  const samplesInPeriod = holes.flatMap((h) => h.samples).filter((s) => inPeriod(s.createdAt));
  const returnedInPeriod = dispatches.filter((d) => d.returnedAt && inPeriod(d.returnedAt));
  const resultsReturned = returnedInPeriod.reduce((sum, d) => sum + d.sampleCount, 0);

  const drilledByHole = holes
    .map((h) => ({ holeId: h.holeId, m: metresDrilledBetween(h.runs, from, now) }))
    .filter((row) => row.m > 0)
    .sort((a, b) => b.m - a.m);
  const changes = statusChanges
    .filter((c) => c.status === "complete" || c.status === "logged" || c.status === "drilling")
    .map((c) => `${holeName.get(c.drillholeId) ?? "A hole"} ${c.status === "drilling" ? "started drilling" : `marked ${STATUS_LABELS[c.status].toLowerCase()}`} on ${formatDay(c.changedAt)}`);
  const drilling = holeRows.filter((h) => h.status === "drilling");
  const notStarted = holeRows.filter((h) => h.status === "planned");

  const stillAtLab = dispatches.filter((d) => d.state.kind === "waiting");
  const decisionsInPeriod = decisions.filter((d) => inPeriod(d.decidedAt));
  const qcShort = qcInsertion(
    holes.flatMap((h) => h.samples).map((s) => ({ type: s.sampleType })),
    { standardEveryN: project.qcStandardEveryN, blankEveryN: project.qcBlankEveryN, duplicateEveryN: project.qcDuplicateEveryN },
  ).filter((row) => row.short);

  return (
    <>
      <div className="mg-report-bar mg-no-print">
        <div className="mg-chips" role="group" aria-label="Report period">
          {REPORT_PERIODS.map((p) => (
            <Link
              key={p}
              href={`/team/projects/${projectId}/report?period=${p}` as Route}
              className={p === period ? "is-active" : undefined}
              aria-current={p === period ? "true" : undefined}
            >
              {REPORT_PERIOD_LABELS[p]}
            </Link>
          ))}
        </div>
        <PrintButton />
      </div>

      <article className="mg-sheet">
        <h2>
          {project.name}: progress, {formatDay(from)} to {formatDay(now)}
        </h2>
        <p className="mg-note" style={{ marginTop: 4 }}>
          Prepared from CoreChain records on {formatDay(now)}. Recorded data only, as synced from the
          team&apos;s phones; no forecasts.
        </p>

        <div className="mg-sheet-figs">
          <div>
            <b>{formatMetres(drilledInPeriod)}</b>drilled in the period
          </div>
          <div>
            <b>{percentOf(drilledM, plannedM)}%</b>of planned metres to date
          </div>
          <div>
            <b>{samplesInPeriod.length}</b>samples taken
          </div>
          <div>
            <b>{resultsReturned}</b>samples with results returned
          </div>
        </div>

        <h3>Drilling</h3>
        <ul>
          <li>
            {formatMetres(drilledM)} drilled of {formatMetres(plannedM)} planned across{" "}
            {plural(holeRows.length, "hole")}.
          </li>
          {drilledByHole.length > 0 ? (
            <li>
              In the period: {drilledByHole.map((row) => `${row.holeId} ${formatMetres(row.m)}`).join(", ")}.
            </li>
          ) : (
            <li>No core runs recorded in the period.</li>
          )}
          {changes.map((line) => (
            <li key={line}>{line}.</li>
          ))}
          {drilling.length > 0 ? (
            <li>
              Drilling now:{" "}
              {drilling.map((h) => `${h.holeId} (${h.drilledM.toFixed(1)} of ${formatMetres(h.plannedDepthM)})`).join(", ")}.
            </li>
          ) : null}
          {notStarted.length > 0 ? <li>Not started: {notStarted.map((h) => h.holeId).join(", ")}.</li> : null}
        </ul>

        <h3>Laboratory</h3>
        <ul>
          {returnedInPeriod.length > 0 ? (
            returnedInPeriod.map((d) => (
              <li key={d.id}>
                {d.dispatchNumber} ({plural(d.sampleCount, "sample")}) returned on {d.returnedDay}
                {d.state.kind === "returned" ? `, ${daysLabel(d.state.days)} after hand-over` : ""}.
              </li>
            ))
          ) : (
            <li>No results returned in the period.</li>
          )}
          {stillAtLab.map((d) => (
            <li key={d.id}>
              {d.dispatchNumber} ({plural(d.sampleCount, "sample")}) at {d.laboratory} since {d.handoverDay}
              {d.state.kind === "waiting" ? `, ${daysLabel(d.state.days)}` : ""}.
            </li>
          ))}
        </ul>

        <h3>Quality</h3>
        <ul>
          {decisionsInPeriod.length > 0 ? (
            decisionsInPeriod.map((d) => (
              <li key={d.id}>
                {d.holeId} {d.decision === "accept" ? "accepted" : d.decision === "hold" ? "held" : "rejected"} at{" "}
                {d.stageLabel.toLowerCase()} on {d.decidedDay}
                {d.note?.trim() ? `: ${d.note.trim()}` : ""}.
              </li>
            ))
          ) : (
            <li>No QA/QC decisions in the period.</li>
          )}
          {qcShort.map((row) => (
            <li key={row.controlType}>
              {CONTROL_LABELS[row.controlType]} inserted: {row.inserted} of {row.expected} expected at 1 in {row.everyN}.
            </li>
          ))}
        </ul>
      </article>
    </>
  );
}
