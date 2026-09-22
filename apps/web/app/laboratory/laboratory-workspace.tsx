"use client";

import {
  RECEIPT_STATUS_LABELS,
  RESULTS_STATUS_LABELS,
  type ReceiptStatus,
  type ResultsStatus,
} from "@corechain/domain";
import { useState, useTransition, type FormEvent } from "react";
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

function SampleItem({
  dispatchId,
  sample,
  arrived,
  canEnterResults,
  results,
}: {
  dispatchId: string;
  sample: SampleRow;
  arrived: boolean;
  canEnterResults: boolean;
  results: AssayResultRow[];
}) {
  return (
    <li className="admin-user">
      <div className="admin-user-who">
        <span className="admin-user-name">
          {sample.sampleNumber}
          {arrived ? (
            <span className="admin-pill">Arrived</span>
          ) : (
            <span className="admin-pill admin-pill-off">Missing</span>
          )}
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
        <ResultEntryForm dispatchId={dispatchId} sample={sample} />
      ) : null}
    </li>
  );
}

function DispatchCard({ dispatch }: { dispatch: DispatchRow }) {
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(dispatch.samples.filter((s) => s.receivedAt).map((s) => s.id)),
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (sampleId: string) => {
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

  const anyArrived = dispatch.samples.some((s) => s.receivedAt);
  const allArrived = dispatch.receiptStatus === "received";

  return (
    <li className="admin-user">
      <div className="admin-user-who">
        <span className="admin-user-name">{dispatch.dispatchNumber}</span>
        <span className="admin-user-email">
          {dispatch.projectName} · {dispatch.laboratory} ·{" "}
          {dispatch.samples.length} samples
          {dispatch.handoverAt ? ` · handed over ${dispatch.handoverAt}` : ""}
        </span>
      </div>

      <div className="admin-user-meta">
        <div className="admin-status">
          <span className="admin-meta-label">Receipt</span>
          <span className="admin-pill">{RECEIPT_STATUS_LABELS[dispatch.receiptStatus]}</span>
        </div>
        <div className="admin-status">
          <span className="admin-meta-label">Results</span>
          <span className="admin-pill">{RESULTS_STATUS_LABELS[dispatch.resultsStatus]}</span>
        </div>
      </div>

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
                    onChange={() => toggle(sample.id)}
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
        <details open={allArrived}>
          <summary className="admin-hint">Samples and results</summary>
          <ul className="admin-users">
            {dispatch.samples.map((sample) => (
              <SampleItem
                key={sample.id}
                dispatchId={dispatch.id}
                sample={sample}
                arrived={Boolean(sample.receivedAt)}
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
        </details>
      ) : null}

      {error ? (
        <p role="alert" className="form-error admin-user-error">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export function LaboratoryWorkspace({ dispatches }: { dispatches: DispatchRow[] }) {
  return (
    <div className="admin-columns">
      <div className="admin-list-column">
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

        <section className="admin-card" aria-labelledby="dispatches-title">
          <div className="admin-card-head">
            <h2 id="dispatches-title">Dispatch inbox</h2>
            <span className="admin-count">{dispatches.length}</span>
          </div>
          {dispatches.length === 0 ? (
            <p className="admin-hint">
              Nothing dispatched to your team yet. A batch appears here once
              a geologist hands it over to the lab.
            </p>
          ) : (
            <ul className="admin-users">
              {dispatches.map((dispatch) => (
                <DispatchCard key={dispatch.id} dispatch={dispatch} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
