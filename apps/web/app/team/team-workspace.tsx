"use client";

import { ROLE_LABELS, toUserRole, type DrillholePriority } from "@corechain/domain";
import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { assignHoleAction, setHolePriorityAction } from "./actions";

export type HoleRow = {
  id: string;
  holeId: string;
  projectName: string;
  status: string;
  plannedDepthM: number;
  loggedM: number;
  avgRecoveryPercent: number | null;
  waitingToBag: number;
  waitingToDispatch: number;
  loggedByNames: string[];
  assignedToUserId: string | null;
  priority: DrillholePriority;
  priorityNote: string | null;
  updatedAt: string;
};

export type MemberRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  title: string | null;
};

export type DeviceRow = {
  id: string;
  name: string;
  ownerName: string;
  lastSeenAt: string | null;
};

// A device that has gone quiet this long is worth a manager's attention.
// Same generous threshold as the activity feed (app/team/activity/page.tsx):
// weeks offline are normal for an app built to work with no signal.
const DEVICE_STALE_AFTER_DAYS = 21;

function daysSince(iso: string): number {
  return Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
}

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Never synced";
  const days = daysSince(lastSeenAt);
  if (days <= 0) return "Synced today";
  if (days === 1) return "Synced 1 day ago";
  return `Synced ${days} days ago`;
}

function isStaleDevice(lastSeenAt: string | null): boolean {
  return !lastSeenAt || daysSince(lastSeenAt) > DEVICE_STALE_AFTER_DAYS;
}

const UNASSIGNED = "";

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  drilling: "Drilling",
  complete: "Complete",
  logged: "Logged",
};

const STATUS_PILL_CLASSES: Record<string, string> = {
  planned: "admin-pill pill-planned",
  drilling: "admin-pill pill-drilling",
  complete: "admin-pill",
  logged: "admin-pill pill-success",
};

function progressPercent(loggedM: number, plannedDepthM: number): number {
  if (plannedDepthM <= 0) return 0;
  return Math.min(100, Math.round((loggedM / plannedDepthM) * 100));
}

function HoleItem({
  hole,
  members,
}: {
  hole: HoleRow;
  members: MemberRow[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(hole.priorityNote ?? "");
  const percent = progressPercent(hole.loggedM, hole.plannedDepthM);
  const urgent = hole.priority === "urgent";

  const changeAssignment = (userId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await assignHoleAction(hole.id, userId || null);
      if (!result.ok) setError(result.error);
    });
  };

  const toggleUrgent = (nextUrgent: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await setHolePriorityAction(
        hole.id,
        nextUrgent ? "urgent" : "normal",
        note,
      );
      if (!result.ok) setError(result.error);
    });
  };

  const saveNote = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await setHolePriorityAction(hole.id, "urgent", note);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <li className="admin-user">
      <div className="admin-user-who">
        <span className="admin-user-name">
          <Link href={`/team/holes/${hole.id}` as Route}>{hole.holeId}</Link>
          {urgent ? (
            <span className="admin-pill admin-pill-off">Urgent</span>
          ) : null}
        </span>
        <span className="admin-user-email">{hole.projectName}</span>
      </div>

      <div className="admin-user-meta">
        <div className="admin-status">
          <span className="admin-meta-label">Status</span>
          <span className={STATUS_PILL_CLASSES[hole.status] ?? "admin-pill"}>
            {STATUS_LABELS[hole.status] ?? hole.status}
          </span>
        </div>
        <div className="admin-status team-progress-cell">
          <span className="admin-meta-label">Logged</span>
          <span>
            {hole.loggedM.toFixed(1)} of {hole.plannedDepthM.toFixed(1)} m (
            {percent}%)
          </span>
          <span className="team-bar" aria-hidden="true">
            <i style={{ width: `${percent}%` }} />
          </span>
        </div>
        <div className="admin-status">
          <span className="admin-meta-label">Core recovery</span>
          <span>
            {hole.avgRecoveryPercent === null ? "No runs yet" : `${hole.avgRecoveryPercent}% average`}
          </span>
        </div>
        {hole.waitingToBag > 0 || hole.waitingToDispatch > 0 ? (
          <div className="admin-status">
            <span className="admin-meta-label">Samples waiting</span>
            <span>
              {hole.waitingToBag > 0 ? `${hole.waitingToBag} to bag` : null}
              {hole.waitingToBag > 0 && hole.waitingToDispatch > 0 ? ", " : null}
              {hole.waitingToDispatch > 0 ? `${hole.waitingToDispatch} to dispatch` : null}
            </span>
          </div>
        ) : null}
        {hole.loggedByNames.length > 0 ? (
          <div className="admin-status">
            <span className="admin-meta-label">Logged by</span>
            <span>{hole.loggedByNames.join(", ")}</span>
          </div>
        ) : null}
        <label className="admin-tier">
          <span className="admin-meta-label">Assigned to</span>
          <select
            value={hole.assignedToUserId ?? UNASSIGNED}
            onChange={(e) => changeAssignment(e.target.value)}
            disabled={pending}
            aria-label={`Assigned to, for ${hole.holeId}`}
          >
            <option value={UNASSIGNED}>Unassigned</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="admin-tier">
        <span className="admin-meta-label">
          <input
            type="checkbox"
            checked={urgent}
            onChange={(e) => toggleUrgent(e.target.checked)}
            disabled={pending}
            aria-label={`Mark ${hole.holeId} urgent`}
          />{" "}
          Needs urgent attention
        </span>
      </label>

      {urgent ? (
        <form className="field-with-action" onSubmit={saveNote} noValidate>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What needs attention, e.g. an urgent sample"
            maxLength={280}
            aria-label={`Urgency note for ${hole.holeId}`}
          />
          <button type="submit" className="admin-button" disabled={pending}>
            Save note
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="form-error admin-user-error">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function TeamWorkspace({
  holes,
  members,
  devices,
  totalPlannedM,
  totalLoggedM,
}: {
  holes: HoleRow[];
  members: MemberRow[];
  devices: DeviceRow[];
  totalPlannedM: number;
  totalLoggedM: number;
}) {
  const overallPercent = progressPercent(totalLoggedM, totalPlannedM);
  const urgentCount = holes.filter((hole) => hole.priority === "urgent").length;

  const statusCounts = holes.reduce<Record<string, number>>((acc, hole) => {
    acc[hole.status] = (acc[hole.status] ?? 0) + 1;
    return acc;
  }, {});
  const statusBreakdown = Object.entries(statusCounts)
    .map(([status, count]) => `${count} ${(STATUS_LABELS[status] ?? status).toLowerCase()}`)
    .join(" · ");

  const recoveries = holes
    .map((hole) => hole.avgRecoveryPercent)
    .filter((pct): pct is number => pct !== null);
  const teamRecoveryPercent =
    recoveries.length > 0
      ? Math.round(recoveries.reduce((sum, pct) => sum + pct, 0) / recoveries.length)
      : null;

  const waitingToBagTotal = holes.reduce((sum, h) => sum + h.waitingToBag, 0);
  const waitingToDispatchTotal = holes.reduce((sum, h) => sum + h.waitingToDispatch, 0);

  const syncedTodayCount = devices.filter(
    (d) => d.lastSeenAt && daysSince(d.lastSeenAt) <= 0,
  ).length;

  return (
    <div className="admin-columns">
      <div className="admin-list-column">
        <div className="team-kpis">
          <div className="team-kpi">
            <span className="admin-meta-label">Metres logged</span>
            <span className="team-kpi-value">
              {totalLoggedM.toFixed(1)} <em>of {totalPlannedM.toFixed(1)} m</em>
            </span>
            <span className="team-kpi-sub">{overallPercent}% of planned depth</span>
            <span className="team-bar" aria-hidden="true">
              <i style={{ width: `${overallPercent}%` }} />
            </span>
          </div>
          <div className="team-kpi">
            <span className="admin-meta-label">Holes</span>
            <span className="team-kpi-value">{holes.length}</span>
            <span className="team-kpi-sub">{statusBreakdown || "None yet"}</span>
          </div>
          <div className="team-kpi">
            <span className="admin-meta-label">Core recovery</span>
            <span className="team-kpi-value">
              {teamRecoveryPercent === null ? "—" : `${teamRecoveryPercent}%`}
            </span>
            <span className="team-kpi-sub">
              {teamRecoveryPercent === null ? "No runs yet" : "average across holes"}
            </span>
          </div>
          <div className="team-kpi">
            <span className="admin-meta-label">Samples waiting</span>
            <span className="team-kpi-value">
              {waitingToBagTotal + waitingToDispatchTotal}
            </span>
            <span className="team-kpi-sub">
              {waitingToBagTotal} to bag · {waitingToDispatchTotal} to dispatch
            </span>
          </div>
          <div className="team-kpi">
            <span className="admin-meta-label">Phones</span>
            <span className="team-kpi-value">
              {syncedTodayCount} <em>of {devices.length}</em>
            </span>
            <span className="team-kpi-sub">synced today</span>
          </div>
        </div>

        <section className="admin-card" aria-labelledby="holes-title">
          <div className="admin-card-head">
            <h2 id="holes-title">Holes</h2>
            <span className="admin-count">{holes.length}</span>
          </div>
          {urgentCount > 0 ? (
            <p className="admin-hint">
              {urgentCount} needing urgent attention, listed first.
            </p>
          ) : null}
          {holes.length === 0 ? (
            <p className="admin-hint">
              Nothing logged yet. Holes appear here once a phone on this team
              syncs.
            </p>
          ) : (
            <ul className="admin-users">
              {holes.map((hole) => (
                <HoleItem key={hole.id} hole={hole} members={members} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="admin-card admin-add" aria-labelledby="people-title">
        <h2 id="people-title">People</h2>
        <ul className="admin-users">
          {members.map((member) => (
            <li className="admin-user" key={member.id}>
              <div className="admin-user-who">
                <span className="admin-user-name">{member.name}</span>
                <span className="admin-user-email">{member.email}</span>
              </div>
              <div className="admin-status">
                <span className="admin-meta-label">
                  {member.title ? "Title" : "Tier"}
                </span>
                <span className="admin-pill">
                  {member.title || ROLE_LABELS[toUserRole(member.role)]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-card admin-add" aria-labelledby="devices-title">
        <h2 id="devices-title">Devices</h2>
        {devices.length === 0 ? (
          <p className="admin-hint">No phone has synced for this team yet.</p>
        ) : (
          <ul className="admin-users">
            {devices.map((device) => {
              const stale = isStaleDevice(device.lastSeenAt);
              return (
                <li className="admin-user" key={device.id}>
                  <div className="admin-user-who">
                    <span className="admin-user-name">{device.name}</span>
                    <span className="admin-user-email">{device.ownerName}</span>
                  </div>
                  <div className="admin-status">
                    <span className="admin-meta-label">Last synced</span>
                    <span className={stale ? "team-stale-text" : undefined}>
                      {formatLastSeen(device.lastSeenAt)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
