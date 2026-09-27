import { recoveryPercent } from "@corechain/domain";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  DepthBars,
  Kpi,
  Panel,
  QcInsertionTable,
  StatusBar,
} from "@/components/manager/parts";
import {
  loadDecisionRows,
  loadDispatchRows,
  loadHoles,
  loadMembers,
  loadSampleIdsWithResults,
  managedProject,
  toHoleRows,
} from "@/lib/manager/data";
import { plural } from "@/lib/manager/labels";
import {
  averageTurnaroundDays,
  formatMetres,
  isHeldOrRejected,
  percentOf,
  qcInsertion,
  RESULTS_OVERDUE_AFTER_DAYS,
} from "@/lib/manager/stats";
import { requireProjectManager } from "@/lib/session";

// A project's summary tab: is the programme on track, and can we trust the
// data? Programme progress, holes, recovery, QC insertion and the laboratory.

export default async function ProjectSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ hole?: string | string[] }>;
}) {
  const session = await requireProjectManager();
  const { projectId } = await params;
  const { hole } = await searchParams;
  // Links made before the tabs ("See in 3D" opened ?hole= on this page).
  if (typeof hole === "string") redirect(`/team/projects/${projectId}/3d?hole=${encodeURIComponent(hole)}` as Route);

  const project = await managedProject(session.user.id, projectId);
  if (!project) notFound();
  const { organizationId } = project;

  const now = new Date();
  const members = await loadMembers(organizationId);
  const [holes, decisions, dispatches, withResults] = await Promise.all([
    loadHoles(organizationId, projectId),
    loadDecisionRows(organizationId, members, projectId),
    loadDispatchRows(organizationId, now, projectId),
    loadSampleIdsWithResults(organizationId, projectId),
  ]);
  const holeRows = toHoleRows(holes, members, decisions, now);

  const plannedM = holeRows.reduce((sum, h) => sum + h.plannedDepthM, 0);
  const drilledM = holeRows.reduce((sum, h) => sum + h.drilledM, 0);
  const statusCounts: Record<string, number> = {};
  for (const h of holeRows) statusCounts[h.status] = (statusCounts[h.status] ?? 0) + 1;
  const finished = (statusCounts.complete ?? 0) + (statusCounts.logged ?? 0);

  const recoveries = holes
    .flatMap((h) => h.runs)
    .map((run) => recoveryPercent(run.toM - run.fromM, run.recoveredM))
    .filter((pct): pct is number => pct !== null);
  const recovery =
    recoveries.length > 0 ? recoveries.reduce((sum, p) => sum + p, 0) / recoveries.length : null;

  const samples = holes.flatMap((h) => h.samples);
  const primary = samples.filter((s) => s.sampleType === "primary");
  const controls = samples.length - primary.length;
  const qcRows = qcInsertion(
    samples.map((s) => ({ type: s.sampleType })),
    {
      standardEveryN: project.qcStandardEveryN,
      blankEveryN: project.qcBlankEveryN,
      duplicateEveryN: project.qcDuplicateEveryN,
    },
  );
  const resultsBack = primary.filter((s) => withResults.has(s.id)).length;
  const atLab = primary.filter((s) => !withResults.has(s.id) && s.status === "dispatched").length;

  const turnaround = averageTurnaroundDays(dispatches.map((d) => d.state));
  const returnedCount = dispatches.filter((d) => d.state.kind === "returned").length;
  const overdue = dispatches.filter((d) => d.state.kind === "waiting" && d.state.overdue);
  const heldOrRejected = decisions.filter(isHeldOrRejected);
  const labHref = `/team/projects/${projectId}/lab` as Route;

  return (
    <>
      <div className="mg-kpis">
        <Kpi
          label="Programme"
          value={percentOf(drilledM, plannedM)}
          unit="%"
          sub={`${formatMetres(drilledM)} of ${formatMetres(plannedM)} planned`}
          barPercent={percentOf(drilledM, plannedM)}
          href={`/team/projects/${projectId}/holes`}
        />
        <Kpi
          label="Holes finished"
          value={finished}
          unit={`of ${holeRows.length}`}
          sub={`${statusCounts.drilling ?? 0} drilling, ${statusCounts.planned ?? 0} planned`}
          href={`/team/projects/${projectId}/holes`}
        />
        <Kpi
          label="Core recovery"
          value={recovery === null ? "·" : recovery.toFixed(1)}
          unit={recovery === null ? undefined : "%"}
          sub={recovery === null ? "No runs yet" : `average of ${plural(recoveries.length, "run")}`}
        />
        <Kpi label="Samples" value={samples.length} sub={`of which ${controls} QC inserts`} href={labHref} />
        <Kpi
          label="Laboratory turnaround"
          value={turnaround === null ? "·" : turnaround}
          unit={turnaround === null ? undefined : "days"}
          sub={
            turnaround === null
              ? "No results back yet"
              : `average, ${plural(returnedCount, "dispatch", "dispatches")} back`
          }
          href={labHref}
        />
      </div>

      <div className="mg-grid">
        <Panel
          title="Drilled against planned depth, by hole"
          note="All holes on one scale. Green: finished. Copper: still going. The dark mark is the planned depth."
        >
          <DepthBars holes={holeRows} />
        </Panel>

        <div className="mg-stack">
          <Panel title="Holes by status">
            <StatusBar counts={statusCounts} />
          </Panel>
          <Panel
            title="QC inserted against the project's rates"
            note={`${plural(primary.length, "primary sample")} so far.`}
          >
            <QcInsertionTable rows={qcRows} primaryCount={primary.length} />
          </Panel>
          <Panel
            title="Laboratory and QA/QC"
            action={
              <Link href={labHref} className="admin-link">
                Samples &amp; lab
              </Link>
            }
          >
            <div className="mg-figs">
              <div>
                <b>{resultsBack}</b>samples with results
              </div>
              <div>
                <b>{atLab}</b>at the laboratory
              </div>
              <div>
                <b>{heldOrRejected.length}</b>held or rejected
              </div>
            </div>
            {overdue.length > 0 ? (
              <p className="mg-note" style={{ color: "var(--warning-ink)" }}>
                {overdue.map((d) => d.dispatchNumber).join(", ")}{" "}
                {overdue.length === 1 ? "has" : "have"} been at the laboratory more than {RESULTS_OVERDUE_AFTER_DAYS} days.
              </p>
            ) : null}
          </Panel>
        </div>
      </div>
    </>
  );
}
