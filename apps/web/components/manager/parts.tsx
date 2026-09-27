import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { HOLE_STATUSES, CONTROL_LABELS, STATUS_LABELS, plural, qaqcDisplay } from "@/lib/manager/labels";
import { daysLabel, formatMetres, percentOf, type QcInsertionRow } from "@/lib/manager/stats";
import type {
  ActivityRow,
  AttentionRow,
  DecisionRow,
  DispatchRow,
  HoleRow,
  ProjectCardData,
} from "@/lib/manager/types";

// Building blocks for the project manager's pages. Server components: they
// only display what the page loaded.

export function PageHead({
  title,
  intro,
  crumb,
  aside,
}: {
  title: string;
  intro?: ReactNode;
  crumb?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mg-page-head">
      <div>
        {crumb ? <span className="mg-crumb">{crumb}</span> : null}
        <h1>{title}</h1>
        {intro ? <p>{intro}</p> : null}
      </div>
      {aside}
    </div>
  );
}

export function NoTeam({ title }: { title: string }) {
  return <PageHead title={title} intro="You aren't on a team yet. Ask an admin to add you to one." />;
}

/** The arrow on anything that opens another page: a card, a row or a figure. */
export function OpensIcon() {
  return (
    <svg className="mg-opens" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}

export function Kpi({
  label,
  value,
  unit,
  sub,
  tone,
  barPercent,
  href,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  tone?: "warn" | "danger";
  barPercent?: number;
  /** Where the figure's detail is; the whole card then opens it. */
  href?: string;
}) {
  const className = `kpi-card mg-kpi-card${tone ? ` is-${tone}` : ""}${href ? " mg-kpi-link" : ""}`;
  const body = (
    <>
      <span className="mg-kpi-label">
        {label}
        {href ? <OpensIcon /> : null}
      </span>
      <span className="mg-kpi-value">
        {value}
        {unit ? <em> {unit}</em> : null}
      </span>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
      {barPercent !== undefined ? (
        <div className="kpi-bar">
          <i style={{ width: `${barPercent}%` }} />
        </div>
      ) : null}
    </>
  );
  return href ? (
    <Link href={href as Route} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function Panel({
  id,
  title,
  note,
  action,
  tone,
  children,
}: {
  /** For links that jump to this panel ("#dispatches"). */
  id?: string;
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  tone?: "warn";
  children: ReactNode;
}) {
  return (
    <section id={id} className={`mg-panel${tone ? ` is-${tone}` : ""}`}>
      <div className="mg-panel-head">
        <div>
          <h2>{title}</h2>
          {note ? <p>{note}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusBar({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const present = HOLE_STATUSES.filter((s) => (counts[s] ?? 0) > 0);
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="mg-statusbar" role="img" aria-label={present.map((s) => `${counts[s]} ${STATUS_LABELS[s].toLowerCase()}`).join(", ") || "No holes"}>
        {present.map((s) => (
          <i key={s} className={`mg-status-${s}`} style={{ width: `${(100 * counts[s]) / Math.max(1, total)}%` }} />
        ))}
      </div>
      <ul className="mg-legend">
        {HOLE_STATUSES.map((s) => (
          <li key={s}>
            <i className={`mg-status-${s}`} />
            {STATUS_LABELS[s]} {counts[s] ?? 0}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M8 1.5 14 5v6L8 14.5 2 11V5z" />
      <path d="M2 5l6 3.5L14 5M8 8.5v6" />
    </svg>
  );
}

export function ThreeDButton({ projectId, holeId }: { projectId: string; holeId?: string }) {
  const href = `/team/projects/${projectId}/3d${holeId ? `?hole=${holeId}` : ""}`;
  return (
    <Link href={href as Route} className="mg-button">
      <CubeIcon />
      3D view
    </Link>
  );
}

export function ProjectCard({ project }: { project: ProjectCardData }) {
  const percent = percentOf(project.drilledM, project.plannedM);
  const meta = [project.commodity, project.location, plural(project.holeCount, "hole")]
    .filter(Boolean)
    .join(" · ");
  return (
    <article className="mg-project-card">
      <div>
        <h3>
          <Link href={`/team/projects/${project.id}` as Route}>{project.name}</Link>
        </h3>
        <p className="mg-meta">{meta}</p>
      </div>
      <div>
        <p className="mg-meta">
          Drilled {formatMetres(project.drilledM)} of {formatMetres(project.plannedM)} planned
        </p>
        <div className="mg-bar" style={{ marginTop: 6 }}>
          <i style={{ width: `${percent}%` }} />
        </div>
      </div>
      <StatusBar counts={project.statusCounts} />
      <div className="mg-figs">
        <div>
          <b>{percent}%</b>of planned metres
        </div>
        <div>
          <b>{project.resultsBack}</b>samples with results
        </div>
        <div>
          <b>{project.waitingForResults}</b>at the laboratory
        </div>
      </div>
      <div className="mg-actions">
        <Link href={`/team/projects/${project.id}` as Route} className="mg-button is-primary">
          Open project
        </Link>
        {project.hasCollars ? <ThreeDButton projectId={project.id} /> : null}
      </div>
    </article>
  );
}

export function AttentionList({ rows, limit }: { rows: readonly AttentionRow[]; limit?: number }) {
  const shown = limit ? rows.slice(0, limit) : rows;
  if (shown.length === 0) return <p className="mg-empty">Nothing needs attention right now.</p>;
  return (
    <ul className="mg-attn">
      {shown.map((row) => (
        <li key={row.id}>
          {row.href ? (
            <Link href={row.href as Route} className="mg-attn-row">
              <AttentionBody row={row} />
              <OpensIcon />
            </Link>
          ) : (
            <div className="mg-attn-row">
              <AttentionBody row={row} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function AttentionBody({ row }: { row: AttentionRow }) {
  return (
    <>
      <i className={`mg-dot${row.severity === "danger" ? " is-danger" : ""}`} />
      <div>
        <b>{row.title}</b>
        <span>{row.detail}</span>
      </div>
    </>
  );
}

export function ActivityList({ rows }: { rows: readonly ActivityRow[] }) {
  if (rows.length === 0) return <p className="mg-empty">Nothing recorded yet.</p>;
  return (
    <ul className="mg-feed">
      {rows.map((row) => (
        <li key={row.id}>
          <time>{row.when}</time>
          <span>
            <strong>{row.byName}</strong> {row.summary}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DispatchStatePill({ row }: { row: DispatchRow }) {
  const s = row.state;
  if (s.kind === "open") return <span className="status-pill is-muted">Being put together</span>;
  if (s.kind === "returned") {
    return <span className="status-pill is-success">Back in {daysLabel(s.days)}</span>;
  }
  return (
    <span className={s.overdue ? "status-pill is-warn" : "status-pill is-muted"}>
      {daysLabel(s.days)}, waiting
    </span>
  );
}

export function DispatchTable({
  rows,
  showProject,
}: {
  rows: readonly DispatchRow[];
  showProject: boolean;
}) {
  if (rows.length === 0) return <p className="mg-empty">No dispatches yet.</p>;
  return (
    <div className="mg-table-wrap">
      <table className="mg-table">
        <thead>
          <tr>
            <th>Dispatch</th>
            {showProject ? <th>Project</th> : null}
            <th>Laboratory</th>
            <th className="is-num">Samples</th>
            <th>Handed over</th>
            <th>Results</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="is-id">{row.dispatchNumber}</td>
              {showProject ? (
                <td>
                  <Link href={`/team/projects/${row.projectId}/lab` as Route}>{row.projectName}</Link>
                </td>
              ) : null}
              <td>{row.laboratory}</td>
              <td className="is-num">{row.sampleCount}</td>
              <td className="is-muted">{row.handoverDay ?? "Not yet"}</td>
              <td>
                <DispatchStatePill row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DecisionTable({
  rows,
  showProject,
  emptyText,
}: {
  rows: readonly DecisionRow[];
  showProject: boolean;
  emptyText: string;
}) {
  if (rows.length === 0) return <p className="mg-empty">{emptyText}</p>;
  return (
    <div className="mg-table-wrap">
      <table className="mg-table">
        <thead>
          <tr>
            <th>Hole</th>
            {showProject ? <th>Project</th> : null}
            <th>Stage</th>
            <th>Decision</th>
            <th>Reviewer&apos;s note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pill = qaqcDisplay(row.decision);
            return (
              <tr key={row.id}>
                <td className="is-id">
                  <Link href={`/team/holes/${row.drillholeId}` as Route}>{row.holeId}</Link>
                </td>
                {showProject ? <td>{row.projectName}</td> : null}
                <td>{row.stageLabel}</td>
                <td>
                  <span className={pill.className}>{pill.label}</span>
                  <div className="mg-note" style={{ marginTop: 4 }}>
                    {row.decidedBy}, {row.decidedDay}
                  </div>
                </td>
                <td>{row.note?.trim() || <span className="is-muted">No note</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Drilled against planned depth per hole, all on the deepest hole's scale. */
export function DepthBars({ holes }: { holes: readonly HoleRow[] }) {
  if (holes.length === 0) return <p className="mg-empty">No holes in this project yet.</p>;
  const scale = Math.max(1, ...holes.map((h) => Math.max(h.plannedDepthM, h.drilledM)));
  const sorted = [...holes].sort((a, b) => a.holeId.localeCompare(b.holeId, undefined, { numeric: true }));
  return (
    <ul className="mg-depths">
      {sorted.map((hole) => {
        const done = hole.status === "complete" || hole.status === "logged";
        return (
          <li key={hole.id}>
            <Link href={`/team/holes/${hole.id}` as Route}>{hole.holeId}</Link>
            <div className="mg-track" aria-hidden="true">
              {hole.drilledM > 0 ? (
                <i className={done ? "is-done" : undefined} style={{ width: `${(100 * hole.drilledM) / scale}%` }} />
              ) : null}
              <b style={{ left: `calc(${(100 * hole.plannedDepthM) / scale}% - 1px)` }} />
            </div>
            <span className="mg-depth-value">
              {hole.drilledM.toFixed(1)} / {formatMetres(hole.plannedDepthM)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function QcInsertionTable({ rows, primaryCount }: { rows: readonly QcInsertionRow[]; primaryCount: number }) {
  if (primaryCount === 0) return <p className="mg-empty">No primary samples yet.</p>;
  return (
    <div className="mg-table-wrap">
      <table className="mg-table">
        <thead>
          <tr>
            <th>Control</th>
            <th>Rate</th>
            <th className="is-num">Expected</th>
            <th className="is-num">Inserted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.controlType}>
              <td>{CONTROL_LABELS[row.controlType]}</td>
              <td>{row.everyN > 0 ? `1 in ${row.everyN}` : "Off"}</td>
              <td className="is-num">{row.expected ?? "·"}</td>
              <td className={`is-num${row.short ? " is-short" : ""}`}>{row.inserted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
