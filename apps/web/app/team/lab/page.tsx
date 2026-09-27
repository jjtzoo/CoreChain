import type { Route } from "next";
import Link from "next/link";
import { DecisionTable, DispatchTable, Kpi, NoTeam, PageHead, Panel } from "@/components/manager/parts";
import {
  loadDecisionRows,
  loadDispatchRows,
  loadHoles,
  loadMembers,
  managerTeam,
  toHoleRows,
} from "@/lib/manager/data";
import {
  averageTurnaroundDays,
  compareDispatchesForManager,
  isHeldOrRejected,
  RESULTS_OVERDUE_AFTER_DAYS,
} from "@/lib/manager/stats";
import { requireProjectManager } from "@/lib/session";

// Samples & lab: the sample chain across the team's projects. What is waiting
// to be sent, what is at the laboratory and for how long, and what QA/QC held
// or rejected. The QA/QC reviewer decides; the manager follows up.

export default async function SamplesAndLabPage() {
  const session = await requireProjectManager();
  const team = await managerTeam(session.user.id);
  if (!team) return <NoTeam title="Samples & lab" />;

  const now = new Date();
  const members = await loadMembers(team.organizationId);
  const [holes, dispatches, decisions] = await Promise.all([
    loadHoles(team.organizationId),
    loadDispatchRows(team.organizationId, now),
    loadDecisionRows(team.organizationId, members),
  ]);
  const holeRows = toHoleRows(holes, members, decisions, now);

  const waitingToBag = holeRows.reduce((sum, h) => sum + h.waitingToBag, 0);
  const waitingToDispatch = holeRows.reduce((sum, h) => sum + h.waitingToDispatch, 0);
  const holesWaiting = holeRows.filter((h) => h.waitingToBag + h.waitingToDispatch > 0).length;
  const atLab = dispatches.filter((d) => d.state.kind === "waiting");
  const atLabSamples = atLab.reduce((sum, d) => sum + d.sampleCount, 0);
  const overdue = atLab.filter((d) => d.state.kind === "waiting" && d.state.overdue);
  const turnaround = averageTurnaroundDays(dispatches.map((d) => d.state));
  const returnedCount = dispatches.filter((d) => d.state.kind === "returned").length;
  const heldOrRejected = decisions.filter(isHeldOrRejected);

  return (
    <>
      <PageHead
        title="Samples & lab"
        intro="The sample chain across the team's projects: waiting to be sent, at the laboratory, and what QA/QC decided."
      />

      <div className="mg-kpis">
        <Kpi
          label="Waiting to be sent"
          value={waitingToBag + waitingToDispatch}
          sub={`${waitingToBag} to bag, ${waitingToDispatch} to dispatch, on ${holesWaiting} ${holesWaiting === 1 ? "hole" : "holes"}`}
        />
        <Kpi
          label="At the laboratory"
          value={atLabSamples}
          unit="samples"
          href="#dispatches"
          sub={`${atLab.length} ${atLab.length === 1 ? "dispatch" : "dispatches"} waiting for results`}
        />
        <Kpi
          label="Average turnaround"
          value={turnaround ?? "·"}
          unit={turnaround === null ? undefined : "days"}
          sub={turnaround === null ? "No results back yet" : `over ${returnedCount} ${returnedCount === 1 ? "dispatch" : "dispatches"} back`}
        />
        <Kpi
          label="Overdue"
          value={overdue.length}
          tone={overdue.length > 0 ? "warn" : undefined}
          href="#dispatches"
          sub={`more than ${RESULTS_OVERDUE_AFTER_DAYS} days at the laboratory`}
        />
        <Kpi
          label="QA/QC held or rejected"
          value={heldOrRejected.length}
          tone={heldOrRejected.some((d) => d.decision === "reject") ? "danger" : heldOrRejected.length > 0 ? "warn" : undefined}
          sub="listed below"
          href="#qaqc"
        />
      </div>

      <div className="mg-grid-even">
        <Panel id="dispatches" title="Dispatches" note="Longest waiting first, then those being put together, then results back.">
          <DispatchTable rows={[...dispatches].sort(compareDispatchesForManager)} showProject />
        </Panel>
        <Panel
          id="qaqc"
          title="QA/QC held or rejected"
          note="Read-only. The QA/QC reviewer decides; the manager follows up with the laboratory or the geologist."
        >
          <DecisionTable rows={heldOrRejected} showProject emptyText="Nothing is held or rejected." />
        </Panel>
      </div>

      <Panel
        title="Find a sample"
        note="Type the number on a bag tag to see its hole, depth, custody steps, dispatch and results."
      >
        <form className="scan-form" action="/team/samples" method="get">
          <input
            name="number"
            className="scan-input"
            placeholder="Sample number, e.g. AB-0041"
            aria-label="Sample number"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="auth-submit">
            Find
          </button>
        </form>
        <p className="mg-note">
          Tags to print are under{" "}
          <Link href={"/team/tags" as Route} className="admin-link">
            Setup, Print tags
          </Link>
          .
        </p>
      </Panel>
    </>
  );
}
