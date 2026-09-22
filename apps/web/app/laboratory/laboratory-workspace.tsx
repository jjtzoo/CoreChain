"use client";

import {
  RECEIPT_STATUS_LABELS,
  RESULTS_STATUS_LABELS,
  type ReceiptStatus,
  type ResultsStatus,
} from "@corechain/domain";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { DismissibleHint } from "@/components/dismissible-hint";
import {
  confirmReceiptAction,
  enterAssayResultAction,
  setResultsCompleteAction,
} from "./actions";

export type SampleRow = {
  id: string;
  sampleNumber: string;
  sampleType: string;
  receivedAt: string | null;
};

export type AssayResultRow = {
  id: string;
  analyte: string;
  value: number | null;
  unit: string | null;
  belowDetection: boolean;
  enteredByName: string;
  createdAt: string;
};

export type DispatchRow = {
  id: string;
  dispatchNumber: string;
  projectName: string;
  laboratory: string;
  handoverAt: string | null;
  note: string | null;
  samples: SampleRow[];
  receiptStatus: ReceiptStatus;
  missingSampleIds: string[];
  resultsBySample: Record<string, AssayResultRow[]>;
  resultsStatus: ResultsStatus;
  resultsReturnedAt: string | null;
};

// The lab's real lifecycle only has these four states — a dispatch is
// created digitally before it physically arrives, then moves through
// receipt to results. No "in transit" or "prep queue" step exists in the
// data, so none is shown here.
const LIFECYCLE_STAGES = [
  "Dispatched to lab",
  "Received by laboratory",
  "Results in progress",
  "Results complete",
];

function receiptPillClass(status: ReceiptStatus): string {
  if (status === "received") return "status-pill is-success";
  if (status === "partially_received") return "status-pill is-copper";
  return "status-pill is-muted";
}

function resultsPillClass(status: ResultsStatus): string {
  if (status === "complete") return "status-pill is-success";
  if (status === "in_progress") return "status-pill is-copper";
  return "status-pill is-muted";
}

// A dispatch nobody has physically checked in yet isn't "missing" samples —
// it just hasn't been reviewed. Only once some (not all) samples are
// confirmed received do the rest count as a real shortfall worth flagging.
function exceptionSampleIds(dispatch: DispatchRow): string[] {
  return dispatch.receiptStatus === "partially_received"
    ? dispatch.missingSampleIds
    : [];
}

function formatValue(result: AssayResultRow): string {
  if (result.belowDetection) return `< detection${result.unit ? ` ${result.unit}` : ""}`;
  if (result.value === null) return "—";
  return `${result.value}${result.unit ? ` ${result.unit}` : ""}`;
}

function ResultEntryForm({
  dispatchId,
  sample,
}: {
  dispatchId: string;
  sample: SampleRow;
}) {
  const [analyte, setAnalyte] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [belowDetection, setBelowDetection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await enterAssayResultAction(dispatchId, sample.id, {
        analyte,
        value,
        unit,
        belowDetection,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAnalyte("");
      setValue("");
      setUnit("");
      setBelowDetection(false);
    });
  };

  return (
    <form className="admin-user-meta" onSubmit={submit} noValidate>
      <label className="field" style={{ width: "6rem" }}>
        <span className="field-label">Analyte</span>
        <input
          value={analyte}
          onChange={(e) => setAnalyte(e.target.value)}
          placeholder="Au"
          maxLength={40}
          aria-label={`Analyte for ${sample.sampleNumber}`}
        />
      </label>
      <label className="field" style={{ width: "7rem" }}>
        <span className="field-label">Value</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="1.24"
          inputMode="decimal"
          disabled={belowDetection}
          aria-label={`Value for ${sample.sampleNumber}`}
        />
      </label>
      <label className="field" style={{ width: "6rem" }}>
        <span className="field-label">Unit</span>
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="g/t"
          maxLength={20}
          aria-label={`Unit for ${sample.sampleNumber}`}
        />
      </label>
      <label className="admin-tier" style={{ alignSelf: "flex-end" }}>
        <input
          type="checkbox"
          checked={belowDetection}
          onChange={(e) => setBelowDetection(e.target.checked)}
        />{" "}
        Below detection
      </label>
      <button type="submit" className="admin-button" disabled={pending || !analyte.trim()}>
        {pending ? "Saving…" : "Add result"}
      </button>
      {error ? (
        <p role="alert" className="form-error admin-user-error">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function samplePillClass(dispatch: DispatchRow, sample: SampleRow): string {
  if (sample.receivedAt) return "status-pill is-success";
  if (dispatch.receiptStatus === "not_received") return "status-pill is-muted";
  return "status-pill is-danger";
}

function samplePillLabel(dispatch: DispatchRow, sample: SampleRow): string {
  if (sample.receivedAt) return "Received";
  if (dispatch.receiptStatus === "not_received") return "Awaiting arrival";
  return "Missing";
}

function SampleItem({
  dispatch,
  sample,
  canEnterResults,
  results,
}: {
  dispatch: DispatchRow;
  sample: SampleRow;
  canEnterResults: boolean;
  results: AssayResultRow[];
}) {
  const arrived = Boolean(sample.receivedAt);
  return (
    <li className="admin-user">
      <div className="admin-user-who">
        <span className="admin-user-name">
          {sample.sampleNumber}
          <span className={samplePillClass(dispatch, sample)}>
            {samplePillLabel(dispatch, sample)}
          </span>
        </span>
        <span className="admin-user-email">{sample.sampleType}</span>
      </div>
      {results.length > 0 ? (
        <ul className="admin-users">
          {results.map((result) => (
            <li key={result.id} className="admin-status">
              <span className="admin-meta-label">{result.analyte}</span>
              <span>
                {formatValue(result)} — {result.enteredByName}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {canEnterResults && arrived ? (
        <ResultEntryForm dispatchId={dispatch.id} sample={sample} />
      ) : null}
    </li>
  );
}

function DispatchItem({
  dispatch,
  isOpen,
  onToggle,
}: {
  dispatch: DispatchRow;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(dispatch.samples.filter((s) => s.receivedAt).map((s) => s.id)),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggleSample = (sampleId: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(sampleId)) next.delete(sampleId);
      else next.add(sampleId);
      return next;
    });
  };

  const confirmReceipt = () => {
    setError(null);
    startTransition(async () => {
      const result = await confirmReceiptAction(dispatch.id, [...checked], note);
      if (!result.ok) setError(result.error);
      else setNote("");
    });
  };

  const toggleComplete = (complete: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await setResultsCompleteAction(dispatch.id, complete);
      if (!result.ok) setError(result.error);
    });
  };

  const missing = exceptionSampleIds(dispatch);
  const allArrived = dispatch.receiptStatus === "received";
  const anyArrived = dispatch.samples.some((s) => s.receivedAt);

  return (
    <div className="dispatch-item">
      <button
        type="button"
        className="dispatch-item-head"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className={`dispatch-chevron${isOpen ? " is-open" : ""}`} aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>

        <span style={{ minWidth: 0 }}>
          <span className="workspace-row-id" style={{ display: "block" }}>
            {dispatch.dispatchNumber}
          </span>
          <span className="workspace-row-sub" style={{ display: "block" }}>
            {dispatch.projectName}
          </span>
        </span>

        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
          Handed over
          <br />
          <span style={{ color: "var(--text)" }}>{dispatch.handoverAt ?? "—"}</span>
        </span>

        <span>
          <span className={receiptPillClass(dispatch.receiptStatus)}>
            {RECEIPT_STATUS_LABELS[dispatch.receiptStatus]}
          </span>
          <span style={{ display: "block", marginTop: 6, fontFamily: "var(--font-mono), monospace", fontSize: "0.75rem", color: "var(--muted)" }}>
            {dispatch.samples.length - dispatch.missingSampleIds.length} of {dispatch.samples.length} samples
          </span>
        </span>

        <span>
          <span className={resultsPillClass(dispatch.resultsStatus)}>
            {RESULTS_STATUS_LABELS[dispatch.resultsStatus]}
          </span>
        </span>

        <span style={{ justifySelf: "end" }}>
          {missing.length > 0 ? (
            <span className="status-pill is-danger">{missing.length} missing</span>
          ) : null}
        </span>
      </button>

      {isOpen ? (
        <div className="dispatch-item-detail">
          {!allArrived ? (
            <>
              <p className="admin-hint">
                Check off each sample that actually arrived, then confirm. A
                sample left unchecked is flagged as missing, not silently
                accepted.
              </p>
              <ul className="admin-users">
                {dispatch.samples.map((sample) => (
                  <li key={sample.id} className="admin-user">
                    <label className="admin-tier">
                      <input
                        type="checkbox"
                        checked={checked.has(sample.id)}
                        disabled={Boolean(sample.receivedAt)}
                        onChange={() => toggleSample(sample.id)}
                      />{" "}
                      {sample.sampleNumber} ({sample.sampleType})
                      {sample.receivedAt ? " — already confirmed" : ""}
                    </label>
                  </li>
                ))}
              </ul>
              <div className="field-with-action">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note, e.g. box damaged in transit (optional)"
                  maxLength={500}
                  aria-label={`Receipt note for ${dispatch.dispatchNumber}`}
                />
                <button type="button" className="admin-button" onClick={confirmReceipt} disabled={pending}>
                  {pending ? "Working…" : "Confirm receipt"}
                </button>
              </div>
            </>
          ) : null}

          {anyArrived ? (
            <>
              <ul className="admin-users" style={{ marginTop: allArrived ? 0 : 16 }}>
                {dispatch.samples.map((sample) => (
                  <SampleItem
                    key={sample.id}
                    dispatch={dispatch}
                    sample={sample}
                    canEnterResults={dispatch.resultsStatus !== "complete"}
                    results={dispatch.resultsBySample[sample.id] ?? []}
                  />
                ))}
              </ul>
              <button
                type="button"
                className="admin-button"
                disabled={pending}
                onClick={() => toggleComplete(dispatch.resultsStatus !== "complete")}
              >
                {dispatch.resultsStatus === "complete"
                  ? "Reopen to add more results"
                  : "Mark results complete"}
              </button>
            </>
          ) : null}

          {error ? (
            <p role="alert" className="form-error admin-user-error">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function LaboratoryWorkspace({ dispatches }: { dispatches: DispatchRow[] }) {
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(dispatches.filter((d) => d.receiptStatus === "received").map((d) => d.id)),
  );

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const stats = useMemo(() => {
    const projectCount = new Set(dispatches.map((d) => d.projectName)).size;
    const awaitingReceipt = dispatches.filter((d) => d.receiptStatus !== "received").length;
    const withMissing = dispatches
      .map((d) => ({ dispatch: d, missing: exceptionSampleIds(d) }))
      .filter((row) => row.missing.length > 0);
    const missingTotal = withMissing.reduce((sum, row) => sum + row.missing.length, 0);
    const resultsInProgress = dispatches.filter((d) => d.resultsStatus === "in_progress").length;
    const recentlyCompleted = dispatches
      .filter((d) => d.resultsStatus === "complete")
      .sort((a, b) => (b.resultsReturnedAt ?? "").localeCompare(a.resultsReturnedAt ?? ""))
      .slice(0, 5);
    return { projectCount, awaitingReceipt, withMissing, missingTotal, resultsInProgress, recentlyCompleted };
  }, [dispatches]);

  return (
    <>
      <div className="lifecycle-legend">
        {LIFECYCLE_STAGES.map((label, i) => (
          <span className="lifecycle-step" key={label}>
            <span className={`lifecycle-dot${i === LIFECYCLE_STAGES.length - 1 ? " is-final" : ""}`}>
              <i />
            </span>
            <span className="lifecycle-label">{label}</span>
            {i < LIFECYCLE_STAGES.length - 1 ? <span className="lifecycle-line" /> : null}
          </span>
        ))}
      </div>

      <div className="kpi-strip">
        <div className="kpi-card">
          <div className="kpi-card-head">
            <span className="kpi-icon is-copper" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2v6.5L3.5 19a1.5 1.5 0 0 0 1.3 2.2h14.4a1.5 1.5 0 0 0 1.3-2.2L15 8.5V2" />
                <path d="M9 2h6" />
              </svg>
            </span>
            <span>
              <span className="kpi-value" style={{ display: "block" }}>{dispatches.length}</span>
              <span className="kpi-label">Dispatched to lab</span>
            </span>
          </div>
          <div className="kpi-sub">across {stats.projectCount} project{stats.projectCount === 1 ? "" : "s"}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <span className="kpi-icon is-copper" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <span>
              <span className="kpi-value" style={{ display: "block" }}>{stats.awaitingReceipt}</span>
              <span className="kpi-label">Awaiting receipt</span>
            </span>
          </div>
          <div className="kpi-sub">not yet fully confirmed</div>
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
              <span className="kpi-value" style={{ display: "block" }}>{stats.missingTotal}</span>
              <span className="kpi-label">Samples missing</span>
            </span>
          </div>
          <div className="kpi-sub">
            on {stats.withMissing.length} dispatch{stats.withMissing.length === 1 ? "" : "es"}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-head">
            <span className="kpi-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l5 5L20 6" />
              </svg>
            </span>
            <span>
              <span className="kpi-value" style={{ display: "block" }}>{stats.resultsInProgress}</span>
              <span className="kpi-label">Results in progress</span>
            </span>
          </div>
          <div className="kpi-sub">of {dispatches.length} dispatches</div>
        </div>
      </div>

      <div className="workspace-columns">
        <div className="admin-list-column" style={{ flexGrow: 1, minWidth: 0 }}>
          <DismissibleHint
            storageKey="corechain-laboratory-hint-dismissed"
            title="How this screen works"
          >
            <p className="admin-hint">
              1. A batch appears here once a geologist dispatches it from the
              field. 2. Check off what actually arrived and confirm receipt —
              anything left unchecked is flagged as missing. 3. Enter results
              per sample, then mark the batch complete once you&apos;re done.
            </p>
          </DismissibleHint>

          <section className="admin-card" aria-labelledby="dispatches-title" style={{ padding: 0, overflow: "hidden" }}>
            <div className="admin-card-head" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
              <h2 id="dispatches-title">Dispatch inbox</h2>
              <span className="admin-count">{dispatches.length}</span>
            </div>
            {dispatches.length === 0 ? (
              <p className="admin-hint" style={{ padding: "0 20px 20px" }}>
                Nothing dispatched to your team yet. A batch appears here once
                a geologist hands it over to the lab.
              </p>
            ) : (
              dispatches.map((dispatch) => (
                <DispatchItem
                  key={dispatch.id}
                  dispatch={dispatch}
                  isOpen={openIds.has(dispatch.id)}
                  onToggle={() => toggle(dispatch.id)}
                />
              ))
            )}
          </section>
        </div>

        <div className="admin-sidebar-column">
          <section className="admin-card is-danger" aria-labelledby="exceptions-title" style={{ background: "var(--danger-soft)", borderColor: "color-mix(in srgb, var(--danger) 35%, var(--line))" }}>
            <h2 id="exceptions-title" style={{ color: "var(--danger)" }}>Exceptions</h2>
            <p className="admin-hint" style={{ color: "#8a463d" }}>
              Samples the dispatch sheet lists but that have not been checked
              in as physically received.
            </p>
            {stats.withMissing.length === 0 ? (
              <p className="admin-hint" style={{ color: "#8a463d" }}>Nothing missing right now.</p>
            ) : (
              <div className="exception-list">
                {stats.withMissing.flatMap(({ dispatch, missing }) =>
                  missing.map((sampleId) => {
                    const sample = dispatch.samples.find((s) => s.id === sampleId);
                    return (
                      <div className="exception-row" key={sampleId}>
                        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.8rem", fontWeight: 500 }}>
                          {sample?.sampleNumber ?? sampleId}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{dispatch.dispatchNumber}</span>
                      </div>
                    );
                  }),
                )}
              </div>
            )}
          </section>

          <section className="admin-card" aria-labelledby="completed-title">
            <h2 id="completed-title">Recently completed</h2>
            {stats.recentlyCompleted.length === 0 ? (
              <p className="admin-hint">No completed batches yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {stats.recentlyCompleted.map((dispatch) => (
                  <div key={dispatch.id}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.8rem", fontWeight: 500 }}>
                        {dispatch.dispatchNumber}
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--success)" }}>Results complete</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>
                      {dispatch.projectName} · {dispatch.samples.length} samples
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
