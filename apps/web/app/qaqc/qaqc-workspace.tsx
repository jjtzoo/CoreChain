"use client";

import {
  QAQC_DECISION_LABELS,
  QAQC_DECISIONS,
  QAQC_STAGE_LABELS,
  type QaqcDecision,
  type QaqcStage,
} from "@corechain/domain";
import { useState, useTransition, type FormEvent } from "react";
import { recordQaqcDecisionAction, resolveExceptionAction } from "./actions";

export type ExceptionRow = {
  key: string;
  summary: string;
  evidence: string;
};

export type DecisionRow = {
  decision: QaqcDecision;
  note: string | null;
  decidedByName: string;
  decidedAt: string;
};

export type ResolvedExceptionRow = {
  key: string;
  summary: string;
  evidence: string | null;
  reason: string;
  resolvedByName: string;
  resolvedAt: string;
};

export type QaqcHoleRow = {
  id: string;
  holeId: string;
  projectName: string;
  exceptions: ExceptionRow[];
  resolvedExceptions: ResolvedExceptionRow[];
  decisions: DecisionRow[];
};

export type DeviceExceptionRow = ExceptionRow;

function formatDay(iso: string): string {
  return iso.slice(0, 10);
}

function decisionPillClass(decision: QaqcDecision): string {
  if (decision === "accept") return "status-pill is-success";
  if (decision === "hold") return "status-pill is-copper";
  return "status-pill is-danger";
}

function ExceptionItem({ exception }: { exception: ExceptionRow }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await resolveExceptionAction(exception.key, reason);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="exception-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>{exception.summary}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 3 }}>{exception.evidence}</div>
        </div>
        {!open ? (
          <button type="button" className="admin-button" style={{ flexShrink: 0 }} onClick={() => setOpen(true)}>
            Resolve
          </button>
        ) : null}
      </div>
      {open ? (
        <form className="field-with-action" onSubmit={submit} noValidate>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this is resolved"
            maxLength={500}
            aria-label={`Reason for resolving: ${exception.summary}`}
          />
          <button type="submit" className="admin-button" disabled={pending}>
            {pending ? "Working…" : "Resolve"}
          </button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="form-error admin-user-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function DecisionControl({ holeId }: { holeId: string }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (decision: QaqcDecision) => {
    setError(null);
    startTransition(async () => {
      const result = await recordQaqcDecisionAction(holeId, decision, note);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNote("");
    });
  };

  return (
    <div style={{ display: "grid", gap: 14, padding: "18px 20px", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "var(--radius-panel)" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--muted)" }}>
        Record decision
      </div>
      <label className="field" style={{ maxWidth: 360 }}>
        <span className="field-label">Note (optional)</span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Why you're deciding this"
          maxLength={500}
          aria-label={`Decision note for ${holeId}`}
        />
      </label>
      <div className="admin-user-actions">
        {QAQC_DECISIONS.map((decision) => (
          <button
            key={decision}
            type="button"
            className="admin-button"
            disabled={pending}
            onClick={() => decide(decision)}
          >
            {QAQC_DECISION_LABELS[decision]}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="form-error admin-user-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const STAGE_EMPTY_HINT: Record<QaqcStage, string> = {
  core_logging:
    "No open exceptions. Core boxes, runs and logging for this team are gap-free and within recovery.",
  sampling_custody:
    "No open exceptions. QC insertion rates are on target and no sample has stalled before dispatch.",
  laboratory_assays:
    "Laboratory results aren't tracked in the app yet, so there is nothing to review for this stage.",
};

const STAGE_HELP: Record<QaqcStage, string> = {
  core_logging: "core logging",
  sampling_custody: "sampling and custody",
  laboratory_assays: "laboratory and assays",
};

function HoleDetail({ hole }: { hole: QaqcHoleRow }) {
  const latest = hole.decisions[0] ?? null;

  return (
    <div className="workspace-detail">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div className="workspace-row-id" style={{ fontSize: "1.25rem" }}>{hole.holeId}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 2 }}>{hole.projectName}</div>
        </div>
        {latest ? (
          <span className={decisionPillClass(latest.decision)} style={{ fontSize: "0.8rem", padding: "5px 12px" }}>
            {QAQC_DECISION_LABELS[latest.decision]}
          </span>
        ) : null}
      </div>

      <div>
        <div className="kpi-strip-label" style={{ marginBottom: 10 }}>Open exceptions</div>
        {hole.exceptions.length > 0 ? (
          <div className="exception-list">
            {hole.exceptions.map((exception) => (
              <ExceptionItem key={exception.key} exception={exception} />
            ))}
          </div>
        ) : (
          <p className="admin-hint" style={{ margin: 0 }}>No open exceptions for this hole.</p>
        )}
      </div>

      <DecisionControl holeId={hole.id} />

      {hole.resolvedExceptions.length > 0 ? (
        <details>
          <summary className="admin-hint">
            Resolved exceptions ({hole.resolvedExceptions.length})
          </summary>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {hole.resolvedExceptions.map((resolved) => (
              <div key={resolved.key} style={{ padding: "12px 14px", background: "var(--canvas)", borderRadius: "var(--radius-control)" }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 500 }}>{resolved.summary}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }}>
                  Resolved by {resolved.resolvedByName}, {formatDay(resolved.resolvedAt)} — {resolved.reason}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {hole.decisions.length > 0 ? (
        <details>
          <summary className="admin-hint">Decision history ({hole.decisions.length})</summary>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", marginTop: 12 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <th style={{ fontWeight: 600, padding: "6px 10px 6px 0" }}>Date</th>
                <th style={{ fontWeight: 600, padding: "6px 10px" }}>Reviewer</th>
                <th style={{ fontWeight: 600, padding: "6px 10px" }}>Decision</th>
                <th style={{ fontWeight: 600, padding: "6px 10px" }}>Note</th>
              </tr>
            </thead>
            <tbody>
              {hole.decisions.map((d, i) => (
                <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                  <td style={{ padding: "9px 10px 9px 0", color: "var(--muted)", fontFamily: "var(--font-mono), monospace", fontSize: "0.75rem" }}>
                    {formatDay(d.decidedAt)}
                  </td>
                  <td style={{ padding: "9px 10px" }}>{d.decidedByName}</td>
                  <td style={{ padding: "9px 10px" }}>
                    <span className={decisionPillClass(d.decision)}>{QAQC_DECISION_LABELS[d.decision]}</span>
                  </td>
                  <td style={{ padding: "9px 10px", color: "var(--muted)" }}>{d.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}

      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 14 }}>
        Decisions and resolutions are appended, never edited — a mistake is corrected with a new entry, not a change to this one.
      </p>
    </div>
  );
}

export function QaqcWorkspace({
  holes,
  devices,
  stage,
  otherResolved,
  openCount,
  resolvedThisWeekCount,
}: {
  holes: QaqcHoleRow[];
  devices: DeviceExceptionRow[];
  stage: QaqcStage;
  otherResolved: ResolvedExceptionRow[];
  openCount: number;
  resolvedThisWeekCount: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(holes[0]?.id ?? null);
  const selected = holes.find((h) => h.id === selectedId) ?? holes[0] ?? null;

  return (
    <>
      <div className="lifecycle-legend" style={{ background: "var(--copper-soft)", borderColor: "#ddb992" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-copper)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span style={{ marginLeft: 12, fontSize: "0.8rem", color: "#6b4a2e" }}>
          Your account reviews the <strong>{QAQC_STAGE_LABELS[stage]}</strong> stage of the QA/QC chain —
          other stages are reviewed by other accounts. Ask an admin to change this on the Users page.
        </span>
      </div>

      <div className="kpi-strip">
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
              <span className="kpi-label">Holes to review</span>
            </span>
          </div>
          <div className="kpi-sub">with open evidence or a decision</div>
        </div>

        <div className="kpi-card is-danger">
          <div className="kpi-card-head">
            <span className="kpi-icon is-danger" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.3 3.9L2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              </svg>
            </span>
            <span>
              <span className="kpi-value" style={{ display: "block" }}>{openCount}</span>
              <span className="kpi-label">Open exceptions</span>
            </span>
          </div>
          <div className="kpi-sub">across {holes.length} holes</div>
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
              <span className="kpi-value" style={{ display: "block" }}>{devices.length}</span>
              <span className="kpi-label">Devices flagged</span>
            </span>
          </div>
          <div className="kpi-sub">quiet longer than expected</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <span className="kpi-icon is-success" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l5 5L20 6" />
              </svg>
            </span>
            <span>
              <span className="kpi-value" style={{ display: "block" }}>{resolvedThisWeekCount}</span>
              <span className="kpi-label">Resolved this week</span>
            </span>
          </div>
          <div className="kpi-sub">exceptions and decisions</div>
        </div>
      </div>

      <div className="workspace-columns">
        <div className="workspace-queue">
          <div className="workspace-queue-head">
            <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Holes to review</span>
            <span className="admin-count">{holes.length}</span>
          </div>
          <div className="workspace-queue-body">
            {holes.length === 0 ? (
              <p className="admin-hint" style={{ padding: "0 4px" }}>{STAGE_EMPTY_HINT[stage]}</p>
            ) : (
              holes.map((hole) => (
                <button
                  key={hole.id}
                  type="button"
                  className={`workspace-row${hole.id === selected?.id ? " is-selected" : ""}`}
                  onClick={() => setSelectedId(hole.id)}
                >
                  <div className="workspace-row-top">
                    <span className="workspace-row-id">{hole.holeId}</span>
                    {hole.exceptions.length > 0 ? (
                      <span className="status-pill is-danger" style={{ flexShrink: 0 }}>
                        {hole.exceptions.length} open
                      </span>
                    ) : null}
                  </div>
                  <span className="workspace-row-sub">{hole.projectName}</span>
                  {hole.decisions[0] ? (
                    <span className={decisionPillClass(hole.decisions[0].decision)} style={{ width: "fit-content" }}>
                      {QAQC_DECISION_LABELS[hole.decisions[0].decision]}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>

        {selected ? (
          <HoleDetail hole={selected} />
        ) : (
          <div className="workspace-detail">
            <p className="admin-hint" style={{ margin: 0 }}>{STAGE_EMPTY_HINT[stage]}</p>
          </div>
        )}

        <div className="workspace-sidebar">
          {devices.length > 0 ? (
            <section className="admin-card" aria-labelledby="devices-title">
              <h2 id="devices-title">Devices</h2>
              <p className="admin-hint">
                Worth knowing about, not necessarily a problem — this app is built to work offline for weeks.
              </p>
              <div style={{ display: "grid", gap: 10 }}>
                {devices.map((device) => (
                  <ExceptionItem key={device.key} exception={device} />
                ))}
              </div>
            </section>
          ) : null}

          {otherResolved.length > 0 ? (
            <section className="admin-card" aria-labelledby="other-resolved-title">
              <h2 id="other-resolved-title">Other resolved exceptions</h2>
              <p className="admin-hint">
                Resolved earlier; the data behind them has since changed, so
                the original hole and depth can no longer be shown. Kept
                visible rather than deleted, same as every other record in
                CoreChain.
              </p>
              <div style={{ display: "grid", gap: 10 }}>
                {otherResolved.map((resolved) => (
                  <div key={resolved.key} style={{ padding: "10px 12px", background: "var(--canvas)", borderRadius: "var(--radius-control)" }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 500 }}>{resolved.summary}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 4 }}>
                      Resolved: {resolved.resolvedByName}, {formatDay(resolved.resolvedAt)} — {resolved.reason}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="admin-card" aria-labelledby="how-title">
            <h2 id="how-title">How this screen works</h2>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.6 }}>
              <li>Exceptions are computed from evidence the field already logged for {STAGE_HELP[stage]} — nothing here is entered by hand.</li>
              <li>Resolve one with a reason, or leave it open for the next reviewer.</li>
              <li>Record Accept, Hold or Reject on the hole once you&apos;ve reviewed its evidence.</li>
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
