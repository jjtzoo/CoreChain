"use client";

import { ROLE_LABELS, toUserRole, type DrillholePriority } from "@corechain/domain";
import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState, useTransition, type FormEvent } from "react";
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
  qaqcDecision: string | null;
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

export type DispatchSummary = {
  count: number;
  pendingResultsCount: number;
};

export type AttentionRow = {
  id: string;
  title: string;
  detail: string;
};

export type ActivityRow = {
  id: string;
  byName: string;
  summary: string;
  when: string;
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

const STATUS_PILL_CLASS: Record<string, string> = {
  planned: "status-pill is-muted",
  drilling: "status-pill is-copper",
  complete: "status-pill is-muted",
  logged: "status-pill is-success",
};

// Donut segment colours, distinct from the receipt/results pill palette so a
// "planned" hole (grey) doesn't read as a "not started" warning.
const STATUS_CHART_COLOR: Record<string, string> = {
  planned: "var(--line-strong)",
  drilling: "var(--brand-copper)",
  complete: "var(--forest)",
  logged: "var(--success)",
};

const QAQC_DECISION_DISPLAY: Record<string, { label: string; className: string }> = {
  accept: { label: "Accepted", className: "status-pill is-success" },
  hold: { label: "Held", className: "status-pill is-copper" },
  reject: { label: "Rejected", className: "status-pill is-danger" },
};
const QAQC_NOT_REVIEWED = { label: "Not reviewed", className: "status-pill is-muted" };

function qaqcDisplay(decision: string | null) {
  return decision ? (QAQC_DECISION_DISPLAY[decision] ?? QAQC_NOT_REVIEWED) : QAQC_NOT_REVIEWED;
}

function progressPercent(loggedM: number, plannedDepthM: number): number {
  if (plannedDepthM <= 0) return 0;
  return Math.min(100, Math.round((loggedM / plannedDepthM) * 100));
}

function HoleDetail({
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
  const qaqc = qaqcDisplay(hole.qaqcDecision);

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
    <div className="workspace-detail">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="workspace-row-id" style={{ fontSize: "1.25rem" }}>
              <Link href={`/team/holes/${hole.id}` as Route}>{hole.holeId}</Link>
            </span>
            {urgent ? <span className="status-pill is-danger">Urgent</span> : null}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>{hole.projectName}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={STATUS_PILL_CLASS[hole.status] ?? "status-pill is-muted"}>
            {STATUS_LABELS[hole.status] ?? hole.status}
          </span>
          <span className={qaqc.className}>QA/QC: {qaqc.label}</span>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-cell">
          <div className="stat-cell-label">Logged</div>
          <div className="stat-cell-value">
            {hole.loggedM.toFixed(1)} of {hole.plannedDepthM.toFixed(1)} m
          </div>
          <div className="kpi-bar" style={{ marginTop: 8 }}>
            <i style={{ width: `${percent}%` }} />
          </div>
        </div>
        <div className="stat-cell">
          <div className="stat-cell-label">Core recovery</div>
          <div className="stat-cell-value">
            {hole.avgRecoveryPercent === null ? "No runs yet" : `${hole.avgRecoveryPercent}% average`}
          </div>
        </div>
        <div className="stat-cell">
          <div className="stat-cell-label">Samples waiting</div>
          <div className="stat-cell-value">
            {hole.waitingToBag === 0 && hole.waitingToDispatch === 0
              ? "None"
              : `${hole.waitingToBag} to bag, ${hole.waitingToDispatch} to dispatch`}
          </div>
        </div>
        <div className="stat-cell">
          <div className="stat-cell-label">Logged by</div>
          <div className="stat-cell-value">
            {hole.loggedByNames.length > 0 ? hole.loggedByNames.join(", ") : "No one yet"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: 14, padding: "18px 20px", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "var(--radius-panel)" }}>
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
      </div>
    </div>
  );
}

export function TeamWorkspace({
  holes,
  members,
  devices,
  totalPlannedM,
  totalLoggedM,
  dispatches,
  qaqcDecidedCount,
  qaqcHeldOrRejectedCount,
  attention,
  activity,
}: {
  holes: HoleRow[];
  members: MemberRow[];
  devices: DeviceRow[];
  totalPlannedM: number;
  totalLoggedM: number;
  dispatches: DispatchSummary;
  qaqcDecidedCount: number;
  qaqcHeldOrRejectedCount: number;
  attention: AttentionRow[];
  activity: ActivityRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(holes[0]?.id ?? null);
  const selected = holes.find((h) => h.id === selectedId) ?? holes[0] ?? null;

  const overallPercent = progressPercent(totalLoggedM, totalPlannedM);
  const urgentCount = holes.filter((hole) => hole.priority === "urgent").length;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const hole of holes) counts[hole.status] = (counts[hole.status] ?? 0) + 1;
    return counts;
  }, [holes]);

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

  // Donut segments: stacked stroke-dasharray arcs on one circle
  // (r=48, circumference = 2*pi*48), each offset by the segments before it.
  const donutSegments = useMemo(() => {
    const circumference = 2 * Math.PI * 48;
    let offset = 0;
    return Object.entries(statusCounts).map(([status, count]) => {
      const length = (count / Math.max(1, holes.length)) * circumference;
      const segment = {
        status,
        label: STATUS_LABELS[status] ?? status,
        color: STATUS_CHART_COLOR[status] ?? "var(--line-strong)",
        count,
        percent: Math.round((count / Math.max(1, holes.length)) * 100),
        dasharray: `${length.toFixed(1)} ${circumference.toFixed(1)}`,
        dashoffset: -offset,
      };
      offset += length;
      return segment;
    });
  }, [statusCounts, holes.length]);

  const workload = useMemo(() => {
    const counts = members.map((member) => ({
      member,
      count: holes.filter((h) => h.assignedToUserId === member.id).length,
    }));
    const max = Math.max(1, ...counts.map((c) => c.count));
    return counts.map((c) => ({ ...c, percent: Math.round((c.count / max) * 100) }));
  }, [members, holes]);

  return (
    <>
      <div className="kpi-strip">
        <div className="kpi-card">
          <div className="kpi-card-head">
            <span className="kpi-icon is-copper" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <span>
              <span className="kpi-value" style={{ display: "block" }}>
                {totalLoggedM.toFixed(1)} <em>of {totalPlannedM.toFixed(1)} m</em>
              </span>
              <span className="kpi-label">Metres logged</span>
            </span>
          </div>
          <div className="kpi-bar">
            <i style={{ width: `${overallPercent}%` }} />
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <span className="kpi-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <path d="M4 10h16" />
              </svg>
            </span>
            <span>
              <span className="kpi-value" style={{ display: "block" }}>{holes.length}</span>
              <span className="kpi-label">Holes</span>
            </span>
          </div>
          <div className="kpi-sub is-clamped">{statusBreakdown || "None yet"}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <span className="kpi-icon is-success" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l5 5L20 6" />
              </svg>
            </span>
            <span>
              <span className="kpi-value" style={{ display: "block" }}>
                {teamRecoveryPercent === null ? "—" : `${teamRecoveryPercent}%`}
              </span>
              <span className="kpi-label">Core recovery</span>
            </span>
          </div>
          <div className="kpi-sub">{teamRecoveryPercent === null ? "No runs yet" : "average across holes"}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <span className="kpi-icon is-copper" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8l-9-5-9 5 9 5 9-5z" />
                <path d="M3 8v8l9 5 9-5V8" />
              </svg>
            </span>
            <span>
              <span className="kpi-value" style={{ display: "block" }}>{waitingToBagTotal + waitingToDispatchTotal}</span>
              <span className="kpi-label">Samples waiting</span>
            </span>
          </div>
          <div className="kpi-sub">{waitingToBagTotal} to bag · {waitingToDispatchTotal} to dispatch</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <span className="kpi-icon is-muted" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="7" y="2" width="10" height="20" rx="2" />
                <path d="M11 18h2" />
              </svg>
            </span>
            <span>
              <span className="kpi-value" style={{ display: "block" }}>
                {syncedTodayCount} <em>of {devices.length}</em>
              </span>
              <span className="kpi-label">Phones</span>
            </span>
          </div>
          <div className="kpi-sub">synced today</div>
        </div>
      </div>

      <div>
        <div className="kpi-strip-label">Lab &amp; QA/QC</div>
        <div className="kpi-strip" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <div className="kpi-card">
            <div className="kpi-card-head">
              <span className="kpi-icon is-copper" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 2v6.5L3.5 19a1.5 1.5 0 0 0 1.3 2.2h14.4a1.5 1.5 0 0 0 1.3-2.2L15 8.5V2" />
                  <path d="M9 2h6" />
                </svg>
              </span>
              <span>
                <span className="kpi-value" style={{ display: "block" }}>{dispatches.count}</span>
                <span className="kpi-label">Dispatches</span>
              </span>
            </div>
            <div className="kpi-sub">{dispatches.pendingResultsCount} awaiting results</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-card-head">
              <span className="kpi-icon is-danger" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </span>
              <span>
                <span className="kpi-value" style={{ display: "block" }}>{qaqcHeldOrRejectedCount}</span>
                <span className="kpi-label">QA/QC held or rejected</span>
              </span>
            </div>
            <div className="kpi-sub">of {qaqcDecidedCount} decided</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
        <div style={{ flex: 1, minWidth: 0, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-panel)", padding: "22px 24px" }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>Holes by status</div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2, marginBottom: 18 }}>Snapshot as of today</div>
          {holes.length === 0 ? (
            <p className="admin-hint" style={{ margin: 0 }}>Nothing logged yet.</p>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
              <svg width="140" height="140" viewBox="0 0 120 120" className="donut-chart">
                <circle cx="60" cy="60" r="48" fill="none" stroke="var(--surface-muted)" strokeWidth="16" />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.status}
                    cx="60"
                    cy="60"
                    r="48"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="16"
                    strokeDasharray={seg.dasharray}
                    strokeDashoffset={seg.dashoffset}
                  />
                ))}
              </svg>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flexGrow: 1 }}>
                {donutSegments.map((seg) => (
                  <div className="donut-legend-row" key={seg.status}>
                    <span className="donut-legend-dot" style={{ background: seg.color }} />
                    <span style={{ fontSize: "0.8rem", flexGrow: 1 }}>{seg.label}</span>
                    <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.8rem", fontWeight: 600 }}>{seg.count}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", width: 38, textAlign: "right" }}>{seg.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-panel)", padding: "22px 24px" }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>Team workload</div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2, marginBottom: 18 }}>Holes assigned per person</div>
          {workload.length === 0 ? (
            <p className="admin-hint" style={{ margin: 0 }}>No one on this team yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {workload.map(({ member, count, percent }) => (
                <div className="workload-row" key={member.id}>
                  <span className="workload-name">{member.name}</span>
                  <div className="workload-bar">
                    <i style={{ width: `${percent}%` }} />
                  </div>
                  <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.8rem", fontWeight: 600, width: 16, textAlign: "right", flexShrink: 0 }}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="workspace-columns">
        <div className="workspace-queue">
          <div className="workspace-queue-head">
            <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Holes</span>
            <span className="admin-count">{holes.length}</span>
          </div>
          {urgentCount > 0 ? (
            <p className="admin-hint" style={{ padding: "0 20px", marginTop: 10 }}>
              {urgentCount} needing urgent attention, listed first.
            </p>
          ) : null}
          <div className="workspace-queue-body">
            {holes.length === 0 ? (
              <p className="admin-hint" style={{ padding: "0 4px" }}>
                Nothing logged yet. Holes appear here once a phone on this team syncs.
              </p>
            ) : (
              holes.map((hole) => {
                const percent = progressPercent(hole.loggedM, hole.plannedDepthM);
                return (
                  <button
                    key={hole.id}
                    type="button"
                    className={`workspace-row${hole.id === selected?.id ? " is-selected" : ""}`}
                    onClick={() => setSelectedId(hole.id)}
                  >
                    <div className="workspace-row-top">
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span className="workspace-row-id">{hole.holeId}</span>
                        {hole.priority === "urgent" ? (
                          <span className="status-pill is-danger" style={{ fontSize: "0.65rem" }}>Urgent</span>
                        ) : null}
                      </span>
                      <span className={STATUS_PILL_CLASS[hole.status] ?? "status-pill is-muted"}>
                        {STATUS_LABELS[hole.status] ?? hole.status}
                      </span>
                    </div>
                    <span className="workspace-row-sub">{hole.projectName}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="kpi-bar" style={{ flexGrow: 1, margin: 0 }}>
                        <i style={{ width: `${percent}%` }} />
                      </div>
                      <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.7rem", color: "var(--muted)", flexShrink: 0 }}>
                        {percent}%
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {selected ? (
          <HoleDetail hole={selected} members={members} />
        ) : (
          <div className="workspace-detail">
            <p className="admin-hint" style={{ margin: 0 }}>Nothing logged yet.</p>
          </div>
        )}

        <div className="workspace-sidebar">
          <section className="admin-card" aria-labelledby="people-title">
            <div className="admin-card-head">
              <h2 id="people-title">People</h2>
              <span className="admin-count">{members.length}</span>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {members.map((member) => (
                <div key={member.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", background: "var(--canvas)", borderRadius: "var(--radius-control)" }}>
                  {/* A long title moves under the name rather than squeezing it. */}
                  <div style={{ flex: "1 1 9rem", minWidth: 0 }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 500 }}>{member.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {member.email}
                    </div>
                  </div>
                  <span className="admin-pill" style={{ maxWidth: "100%" }}>
                    {member.title || ROLE_LABELS[toUserRole(member.role)]}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-card" aria-labelledby="devices-title">
            <div className="admin-card-head">
              <h2 id="devices-title">Devices</h2>
              <span className="admin-count">{devices.length}</span>
            </div>
            {devices.length === 0 ? (
              <p className="admin-hint">No phone has synced for this team yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {devices.map((device) => {
                  const stale = isStaleDevice(device.lastSeenAt);
                  return (
                    <div key={device.id} style={{ padding: "10px 12px", background: "var(--canvas)", borderRadius: "var(--radius-control)" }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 500 }}>{device.name}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{device.ownerName}</span>
                        <span className={stale ? "team-stale-text" : undefined} style={{ fontSize: "0.75rem", color: stale ? undefined : "var(--muted)" }}>
                          {formatLastSeen(device.lastSeenAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
        <div style={{ flex: 1, minWidth: 0, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-panel)", padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Needs attention</span>
            <Link href="/team/activity" className="admin-link">View all</Link>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: "0.75rem", color: "var(--muted)" }}>
            Active holes with no new logging in over a week, and phones quiet longer than expected.
          </p>
          {attention.length === 0 ? (
            <p className="admin-hint" style={{ margin: 0 }}>Nothing needs attention right now.</p>
          ) : (
            <div className="exception-list">
              {attention.slice(0, 6).map((row) => (
                <div className="exception-row" key={row.id}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 500 }}>{row.title}</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", flexShrink: 0 }}>{row.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius-panel)", padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Recent activity</span>
            <Link href="/team/activity" className="admin-link">View all</Link>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: "0.75rem", color: "var(--muted)" }}>
            Everything logged in the last 24 hours, newest first.
          </p>
          {activity.length === 0 ? (
            <p className="admin-hint" style={{ margin: 0 }}>Nothing logged in the last 24 hours.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {activity.map((row) => (
                <div className="activity-row" key={row.id}>
                  <span className="activity-dot" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "0.8rem" }}>
                      <strong>{row.byName}</strong> {row.summary}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>{row.when}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
