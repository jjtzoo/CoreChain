import type { Route } from "next";
import Link from "next/link";
import {
  ActivityList,
  AttentionList,
  Kpi,
  NoTeam,
  PageHead,
  Panel,
  ProjectCard,
} from "@/components/manager/parts";
import {
  loadDecisionRows,
  loadDevices,
  loadDispatchRows,
  loadHoles,
  loadMembers,
  loadProjectCards,
  loadSampleIdsWithResults,
  managerTeam,
  recentActivity,
  teamAttention,
  toHoleRows,
} from "@/lib/manager/data";
import { plural } from "@/lib/manager/labels";
import { formatDay, isHeldOrRejected, metresDrilledBetween, RESULTS_OVERDUE_AFTER_DAYS } from "@/lib/manager/stats";
import { requireProjectManager } from "@/lib/session";

// Today: what needs the project manager now, across the team's projects.
// Each project card opens the project's page and its 3D view.

const DAY_MS = 86_400_000;

export default async function TodayPage() {
  const session = await requireProjectManager();
  const team = await managerTeam(session.user.id);
  if (!team) return <NoTeam title="Today" />;

  const now = new Date();
  const members = await loadMembers(team.organizationId);
  const [holes, devices, decisions, dispatches, withResults] = await Promise.all([
    loadHoles(team.organizationId),
    loadDevices(team.organizationId, members),
    loadDecisionRows(team.organizationId, members),
    loadDispatchRows(team.organizationId, now),
    loadSampleIdsWithResults(team.organizationId),
  ]);
  const holeRows = toHoleRows(holes, members, decisions, now);
  const projects = await loadProjectCards(team.organizationId, holes, withResults);
  const attention = teamAttention({ holes: holeRows, decisions, dispatches, devices, now });
  const activity = recentActivity(holes, members, now, 6);

  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY_MS);
  const runs = holes.flatMap((h) => h.runs);
  const drilledThisWeek = metresDrilledBetween(runs, weekAgo, now);
  const drilledLastWeek = metresDrilledBetween(runs, twoWeeksAgo, weekAgo);

  const drilling = holeRows.filter((h) => h.status === "drilling");
  const waitingToBag = holeRows.reduce((sum, h) => sum + h.waitingToBag, 0);
  const waitingToDispatch = holeRows.reduce((sum, h) => sum + h.waitingToDispatch, 0);
  const overdue = dispatches.filter((d) => d.state.kind === "waiting" && d.state.overdue);
  const atLab = dispatches.filter((d) => d.state.kind === "waiting");
  const heldOrRejected = decisions.filter(isHeldOrRejected);
  const rejected = heldOrRejected.filter((d) => d.decision === "reject").length;

  const workload = members
    .map((member) => ({
      member,
      holes: holeRows.filter((h) => h.assignedToUserId === member.id),
      lastSync: devices
        .filter((d) => d.userId === member.id && d.lastSeenAt)
        .map((d) => d.lastSeenAt as string)
        .sort()
        .at(-1),
    }))
    .filter((row) => row.holes.length > 0 || row.lastSync);

  return (
    <>
      <PageHead
        title="Today"
        intro={`${team.name} · ${plural(projects.length, "project")} · ${plural(holeRows.length, "hole")} · ${plural(members.length, "person", "people")}`}
        aside={<div className="mg-asof">As of {formatDay(now)}, from phones that have synced</div>}
      />

      <div className="mg-kpis">
        <Kpi
          label="Drilled, last 7 days"
          value={drilledThisWeek.toFixed(1)}
          unit="m"
          sub={`${drilledLastWeek.toFixed(1)} m the 7 days before`}
        />
        <Kpi
          label="Holes drilling"
          value={drilling.length}
          sub={drilling.length > 0 ? drilling.map((h) => h.holeId).join(", ") : "None right now"}
        />
        <Kpi
          label="Samples waiting"
          value={waitingToBag + waitingToDispatch}
          sub={`${waitingToBag} to bag · ${waitingToDispatch} to dispatch`}
        />
        <Kpi
          label="Results overdue"
          value={overdue.length}
          unit={overdue.length === 1 ? "dispatch" : "dispatches"}
          tone={overdue.length > 0 ? "warn" : undefined}
          sub={
            overdue.length > 0
              ? `More than ${RESULTS_OVERDUE_AFTER_DAYS} days at the laboratory`
              : `${atLab.length} at the laboratory, none past ${RESULTS_OVERDUE_AFTER_DAYS} days`
          }
        />
        <Kpi
          label="QA/QC held or rejected"
          value={heldOrRejected.length}
          tone={rejected > 0 ? "danger" : heldOrRejected.length > 0 ? "warn" : undefined}
          sub={
            heldOrRejected.length > 0
              ? `${heldOrRejected.length - rejected} held, ${rejected} rejected`
              : "Nothing held or rejected"
          }
        />
      </div>

      <div className="mg-grid">
        <div className="mg-stack">
          {projects.length === 0 ? (
            <Panel title="Projects">
              <p className="mg-empty">
                No projects yet. A project appears here once a geologist on this team creates it on
                the phone and syncs.
              </p>
            </Panel>
          ) : (
            <div className="mg-projects">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}

          <Panel
            title="Team this week"
            note="Holes assigned to each person, and when their phone last synced."
            action={
              <Link href={"/team/people" as Route} className="admin-link">
                Team
              </Link>
            }
          >
            {workload.length === 0 ? (
              <p className="mg-empty">No holes assigned and no phone synced yet.</p>
            ) : (
              <div className="mg-table-wrap">
                <table className="mg-table">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Holes assigned</th>
                      <th>Last sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workload.map(({ member, holes: assigned, lastSync }) => (
                      <tr key={member.id}>
                        <td>{member.name}</td>
                        <td>
                          {assigned.length > 0 ? (
                            assigned.map((h) => h.holeId).join(", ")
                          ) : (
                            <span className="is-muted">None</span>
                          )}
                        </td>
                        <td className="is-muted">
                          {lastSync ? formatDay(new Date(lastSync)) : "No phone yet"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="mg-stack">
          <Panel
            title="Needs attention"
            tone={attention.length > 0 ? "warn" : undefined}
            note={attention.length > 6 ? `The first 6 of ${attention.length}.` : undefined}
          >
            <AttentionList rows={attention} limit={6} />
          </Panel>
          <Panel
            title="Recent activity"
            action={
              <Link href={"/team/activity" as Route} className="admin-link">
                All activity
              </Link>
            }
          >
            <ActivityList rows={activity} />
          </Panel>
        </div>
      </div>
    </>
  );
}
