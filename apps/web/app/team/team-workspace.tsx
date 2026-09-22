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
};

export type DeviceRow = {
  id: string;
  name: string;
  ownerName: string;
  lastSeenAt: string | null;
};

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Never synced";
  const days = Math.floor((Date.now() - Date.parse(lastSeenAt)) / 86_400_000);
  if (days <= 0) return "Synced today";
  if (days === 1) return "Synced 1 day ago";
  return `Synced ${days} days ago`;
}

const UNASSIGNED = "";

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  drilling: "Drilling",
  complete: "Complete",
  logged: "Logged",
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
          <span className="admin-pill">
            {STATUS_LABELS[hole.status] ?? hole.status}
          </span>
        </div>
        <div className="admin-status">
          <span className="admin-meta-label">Logged</span>
          <span>
            {hole.loggedM.toFixed(1)} of {hole.plannedDepthM.toFixed(1)} m (
            {percent}%)
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

  return (
    <div className="admin-columns">
      <div className="admin-list-column">
        <section className="admin-card">
          <div className="admin-card-head">
            <h2>Metres logged</h2>
          </div>
          <p className="admin-hint">
            {totalLoggedM.toFixed(1)} of {totalPlannedM.toFixed(1)} m planned
            across the team ({overallPercent}%).
          </p>
        </section>

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
                <span className="admin-meta-label">Tier</span>
                <span className="admin-pill">
                  {ROLE_LABELS[toUserRole(member.role)]}
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
            {devices.map((device) => (
              <li className="admin-user" key={device.id}>
                <div className="admin-user-who">
                  <span className="admin-user-name">{device.name}</span>
                  <span className="admin-user-email">{device.ownerName}</span>
                </div>
                <div className="admin-status">
                  <span className="admin-meta-label">Last synced</span>
                  <span>{formatLastSeen(device.lastSeenAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
