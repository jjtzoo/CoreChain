"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { assignHoleAction, setHolePriorityAction } from "@/app/team/actions";
import { STATUS_LABELS, STATUS_PILL_CLASS, qaqcDisplay } from "@/lib/manager/labels";
import type { HoleRow, MemberRow } from "@/lib/manager/types";

// The hole list and the selected hole's panel: assign a geologist, mark a
// hole urgent. Used on Holes (every project) and on a project's Holes tab.

const UNASSIGNED = "";

const FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "urgent", label: "Urgent", test: (h: HoleRow) => h.priority === "urgent" },
  { key: "drilling", label: "Drilling", test: (h: HoleRow) => h.status === "drilling" },
  {
    key: "attention",
    label: "Needs attention",
    test: (h: HoleRow) => h.attention !== null || h.priority === "urgent",
  },
  { key: "unassigned", label: "Unassigned", test: (h: HoleRow) => !h.assignedToUserId },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function progressPercent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

function HoleDetail({ hole, members }: { hole: HoleRow; members: readonly MemberRow[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(hole.priorityNote ?? "");
  const urgent = hole.priority === "urgent";
  const qaqc = qaqcDisplay(hole.qaqcDecision);
  const drilledPercent = progressPercent(hole.drilledM, hole.plannedDepthM);
  const loggedPercent = progressPercent(hole.loggedM, Math.max(hole.drilledM, 0));

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
      const result = await setHolePriorityAction(hole.id, nextUrgent ? "urgent" : "normal", note);
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
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="workspace-row-id" style={{ fontSize: "1.25rem" }}>
              <Link href={`/team/holes/${hole.id}` as Route}>{hole.holeId}</Link>
            </span>
            {urgent ? <span className="status-pill is-danger">Urgent</span> : null}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>
            <Link href={`/team/projects/${hole.projectId}` as Route} className="admin-link">
              {hole.projectName}
            </Link>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <span className={STATUS_PILL_CLASS[hole.status] ?? "status-pill is-muted"}>
            {STATUS_LABELS[hole.status] ?? hole.status}
          </span>
          <span className={qaqc.className}>QA/QC: {qaqc.label}</span>
        </div>
      </div>

      {hole.attention ? (
        <p className="mg-note" style={{ color: "var(--warning-ink)" }}>
          Needs attention: {hole.attention}.
        </p>
      ) : null}

      <div className="stat-grid">
        <div className="stat-cell">
          <div className="stat-cell-label">Drilled</div>
          <div className="stat-cell-value">
            {hole.drilledM.toFixed(1)} of {hole.plannedDepthM.toFixed(1)} m planned
          </div>
          <div className="kpi-bar" style={{ marginTop: 8 }}>
            <i style={{ width: `${drilledPercent}%` }} />
          </div>
        </div>
        <div className="stat-cell">
          <div className="stat-cell-label">Logged</div>
          <div className="stat-cell-value">
            {hole.loggedM.toFixed(1)} of {hole.drilledM.toFixed(1)} m drilled
          </div>
          <div className="kpi-bar" style={{ marginTop: 8 }}>
            <i style={{ width: `${loggedPercent}%` }} />
          </div>
        </div>
        <div className="stat-cell">
          <div className="stat-cell-label">Core recovery</div>
          <div className="stat-cell-value">
            {hole.avgRecoveryPercent === null ? "No runs yet" : `${hole.avgRecoveryPercent}% average`}
          </div>
        </div>
        <div className="stat-cell">
          <div className="stat-cell-label">Samples</div>
          <div className="stat-cell-value">
            {hole.sampleCount === 0
              ? "None yet"
              : hole.waitingToBag === 0 && hole.waitingToDispatch === 0
                ? `${hole.sampleCount}, none waiting`
                : `${hole.sampleCount}: ${hole.waitingToBag} to bag, ${hole.waitingToDispatch} to dispatch`}
          </div>
        </div>
        <div className="stat-cell">
          <div className="stat-cell-label">Logged by</div>
          <div className="stat-cell-value">
            {hole.loggedByNames.length > 0 ? hole.loggedByNames.join(", ") : "No one yet"}
          </div>
        </div>
      </div>

      <div className="mg-actions">
        <Link href={`/team/holes/${hole.id}` as Route} className="mg-button is-primary">
          Open hole: log, custody, photos
        </Link>
        {hole.hasCollar ? (
          <Link href={`/team/projects/${hole.projectId}/3d?hole=${hole.id}` as Route} className="mg-button">
            See in 3D
          </Link>
        ) : null}
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

export function HoleBoard({
  holes,
  members,
  showProject,
  initialHoleId,
}: {
  holes: readonly HoleRow[];
  members: readonly MemberRow[];
  showProject: boolean;
  initialHoleId?: string | null;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(initialHoleId ?? holes[0]?.id ?? null);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, holes.filter(f.test).length])) as Record<FilterKey, number>,
    [holes],
  );
  const shown = useMemo(() => {
    const test = FILTERS.find((f) => f.key === filter)?.test ?? (() => true);
    return holes.filter(test);
  }, [holes, filter]);
  const selected = shown.find((h) => h.id === selectedId) ?? shown[0] ?? null;

  if (holes.length === 0) {
    return (
      <p className="mg-empty">
        No holes yet. Holes appear here once a phone on this team syncs.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="mg-chips" role="group" aria-label="Show holes">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={filter === f.key ? "is-active" : undefined}
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label} {counts[f.key]}
          </button>
        ))}
      </div>

      <div className="workspace-columns mg-board">
        <div className="workspace-queue">
          <div className="workspace-queue-head">
            <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Holes</span>
            <span className="admin-count">{shown.length}</span>
          </div>
          <div className="workspace-queue-body">
            {shown.length === 0 ? (
              <p className="admin-hint" style={{ padding: "0 4px" }}>
                No hole matches this filter.
              </p>
            ) : (
              shown.map((hole) => {
                const percent = progressPercent(hole.drilledM, hole.plannedDepthM);
                return (
                  <button
                    key={hole.id}
                    type="button"
                    className={`workspace-row${hole.id === selected?.id ? " is-selected" : ""}`}
                    onClick={() => setSelectedId(hole.id)}
                    aria-pressed={hole.id === selected?.id}
                  >
                    <div className="workspace-row-top">
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span className="workspace-row-id">{hole.holeId}</span>
                        {hole.priority === "urgent" ? (
                          <span className="status-pill is-danger" style={{ fontSize: "0.65rem" }}>
                            Urgent
                          </span>
                        ) : null}
                      </span>
                      <span className={STATUS_PILL_CLASS[hole.status] ?? "status-pill is-muted"}>
                        {STATUS_LABELS[hole.status] ?? hole.status}
                      </span>
                    </div>
                    {showProject ? <span className="workspace-row-sub">{hole.projectName}</span> : null}
                    {hole.attention ? (
                      <span className="workspace-row-sub" style={{ color: "var(--warning-ink)" }}>
                        {hole.attention}
                      </span>
                    ) : null}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="kpi-bar" style={{ flexGrow: 1, margin: 0 }}>
                        <i style={{ width: `${percent}%` }} />
                      </div>
                      <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.7rem", color: "var(--muted)", flexShrink: 0 }}>
                        {hole.drilledM.toFixed(0)} / {hole.plannedDepthM.toFixed(0)} m
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {selected ? (
          <HoleDetail key={selected.id} hole={selected} members={members} />
        ) : (
          <div className="workspace-detail">
            <p className="admin-hint" style={{ margin: 0 }}>
              Choose a hole.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
