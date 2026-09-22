"use client";

import {
  QAQC_DECISION_LABELS,
  QAQC_DECISIONS,
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
    <li className="admin-user">
      <div className="admin-user-who">
        <span className="admin-user-name">{exception.summary}</span>
        <span className="admin-user-email">{exception.evidence}</span>
      </div>
      <div className="admin-user-actions">
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
        ) : (
          <button
            type="button"
            className="admin-button"
            onClick={() => setOpen(true)}
          >
            Resolve
          </button>
        )}
      </div>
      {error ? (
        <p role="alert" className="form-error admin-user-error">
          {error}
        </p>
      ) : null}
    </li>
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
    <div className="admin-user-meta">
      <label className="field" style={{ flex: 1, minWidth: "12rem" }}>
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

function ResolvedItem({ resolved }: { resolved: ResolvedExceptionRow }) {
  return (
    <li className="admin-user">
      <div className="admin-user-who">
        <span className="admin-user-name">{resolved.summary}</span>
        {resolved.evidence ? (
          <span className="admin-user-email">{resolved.evidence}</span>
        ) : null}
      </div>
      <div className="admin-status">
        <span className="admin-meta-label">Resolved</span>
        <span>
          {resolved.resolvedByName}, {formatDay(resolved.resolvedAt)} —{" "}
          {resolved.reason}
        </span>
      </div>
    </li>
  );
}

function HoleCard({ hole }: { hole: QaqcHoleRow }) {
  const latest = hole.decisions[0] ?? null;

  return (
    <li className="admin-user">
      <div className="admin-user-who">
        <span className="admin-user-name">
          {hole.holeId}
          {hole.exceptions.length > 0 ? (
            <span className="admin-pill admin-pill-off">
              {hole.exceptions.length} open
            </span>
          ) : null}
        </span>
        <span className="admin-user-email">{hole.projectName}</span>
      </div>

      {latest ? (
        <div className="admin-status">
          <span className="admin-meta-label">Latest decision</span>
          <span>
            {QAQC_DECISION_LABELS[latest.decision]} by {latest.decidedByName}
            , {formatDay(latest.decidedAt)}
            {latest.note ? ` — ${latest.note}` : ""}
          </span>
        </div>
      ) : null}

      {hole.exceptions.length > 0 ? (
        <ul className="admin-users">
          {hole.exceptions.map((exception) => (
            <ExceptionItem key={exception.key} exception={exception} />
          ))}
        </ul>
      ) : (
        <p className="admin-hint">No open exceptions for this hole.</p>
      )}

      <DecisionControl holeId={hole.id} />

      {hole.resolvedExceptions.length > 0 ? (
        <details>
          <summary className="admin-hint">
            Resolved exceptions ({hole.resolvedExceptions.length})
          </summary>
          <ul className="admin-users">
            {hole.resolvedExceptions.map((resolved) => (
              <ResolvedItem key={resolved.key} resolved={resolved} />
            ))}
          </ul>
        </details>
      ) : null}

      {hole.decisions.length > 1 ? (
        <details>
          <summary className="admin-hint">
            Earlier decisions ({hole.decisions.length - 1})
          </summary>
          <ul className="admin-users">
            {hole.decisions.slice(1).map((d, i) => (
              <li className="admin-user" key={i}>
                <div className="admin-user-who">
                  <span className="admin-user-name">
                    {QAQC_DECISION_LABELS[d.decision]}
                  </span>
                  <span className="admin-user-email">
                    {d.decidedByName}, {formatDay(d.decidedAt)}
                    {d.note ? ` — ${d.note}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
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

export function QaqcWorkspace({
  holes,
  devices,
  stage,
  otherResolved,
}: {
  holes: QaqcHoleRow[];
  devices: DeviceExceptionRow[];
  stage: QaqcStage;
  otherResolved: ResolvedExceptionRow[];
}) {
  return (
    <div className="admin-columns">
      <div className="admin-list-column">
        <section className="admin-card" aria-labelledby="holes-title">
          <div className="admin-card-head">
            <h2 id="holes-title">Holes to review</h2>
            <span className="admin-count">{holes.length}</span>
          </div>
          {holes.length === 0 ? (
            <p className="admin-hint">{STAGE_EMPTY_HINT[stage]}</p>
          ) : (
            <ul className="admin-users">
              {holes.map((hole) => (
                <HoleCard key={hole.id} hole={hole} />
              ))}
            </ul>
          )}
        </section>

        {otherResolved.length > 0 ? (
          <section
            className="admin-card"
            aria-labelledby="other-resolved-title"
          >
            <div className="admin-card-head">
              <h2 id="other-resolved-title">Other resolved exceptions</h2>
              <span className="admin-count">{otherResolved.length}</span>
            </div>
            <p className="admin-hint">
              Resolved earlier; the data behind them has since changed, so
              the original hole and depth can no longer be shown. Kept
              visible rather than deleted, same as every other record in
              CoreChain.
            </p>
            <ul className="admin-users">
              {otherResolved.map((resolved) => (
                <ResolvedItem key={resolved.key} resolved={resolved} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {devices.length > 0 ? (
        <section
          className="admin-card admin-add"
          aria-labelledby="devices-title"
        >
          <h2 id="devices-title">Devices</h2>
          <p className="admin-hint">
            Worth knowing about, not necessarily a problem: this app is built
            to work offline for weeks.
          </p>
          <ul className="admin-users">
            {devices.map((device) => (
              <ExceptionItem key={device.key} exception={device} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
