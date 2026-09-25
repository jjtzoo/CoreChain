"use client";

import {
  STANDARD_FAILURE_SD,
  STANDARD_WARNING_SD,
  type QcReferenceKind,
} from "@corechain/domain";
import { Fragment, useState, useTransition, type FormEvent } from "react";
import {
  removeQcReferenceAction,
  saveQcReferenceAction,
  type QcReferenceInput,
} from "./actions";

/** One saved revision of a line (change register item 2). */
export type QcReferenceRevision = {
  id: string;
  revision: number;
  reference: string;
  analyte: string;
  unit: string | null;
  expectedValue: number | null;
  standardDeviation: number | null;
  maxValue: number | null;
  changeReason: string | null;
  createdByName: string;
  createdAt: string;
};

export type QcReferenceRow = QcReferenceRevision & {
  kind: QcReferenceKind;
  /** Earlier revisions, newest first. */
  earlier: QcReferenceRevision[];
  retiredAt: string | null;
  retiredByName: string | null;
  retireReason: string | null;
};

const EMPTY: QcReferenceInput = {
  kind: "standard",
  reference: "",
  analyte: "",
  unit: "ppm",
  expectedValue: "",
  standardDeviation: "",
  maxValue: "",
};

function format(value: number): string {
  return Number.isInteger(value) ? value.toString() : Number(value.toPrecision(4)).toString();
}

function withUnit(value: number | null, unit: string | null): string {
  if (value == null) return "—";
  return unit ? `${format(value)} ${unit}` : format(value);
}

function band(row: QcReferenceRevision, sds: number): string {
  if (row.expectedValue == null || row.standardDeviation == null) return "—";
  const low = Math.max(0, row.expectedValue - sds * row.standardDeviation);
  const high = row.expectedValue + sds * row.standardDeviation;
  return `${format(low)} to ${withUnit(high, row.unit)}`;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toInput(row: QcReferenceRow): QcReferenceInput {
  return {
    kind: row.kind,
    reference: row.reference,
    analyte: row.analyte,
    unit: row.unit ?? "",
    expectedValue: row.expectedValue?.toString() ?? "",
    standardDeviation: row.standardDeviation?.toString() ?? "",
    maxValue: row.maxValue?.toString() ?? "",
  };
}

/** What a revision said, in one line: the certified value and SD, or the limit. */
function describeValues(kind: QcReferenceKind, row: QcReferenceRevision): string {
  return kind === "standard"
    ? `${withUnit(row.expectedValue, row.unit)} ± ${row.standardDeviation == null ? "—" : format(row.standardDeviation)}`
    : `fails above ${withUnit(row.maxValue, row.unit)}`;
}

function RowActions({
  row,
  onEdit,
  historyOpen,
  onToggleHistory,
  canEdit,
}: {
  row: QcReferenceRow;
  onEdit: (row: QcReferenceRow) => void;
  historyOpen: boolean;
  onToggleHistory: () => void;
  canEdit: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const result = await removeQcReferenceAction(row.id, reason);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="qc-row-actions">
      {confirming ? (
        <>
          <label className="field qc-reason-field">
            <span className="field-label">Why is it no longer used?</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Standard used up, replaced by OREAS 45f"
              maxLength={500}
              autoFocus
            />
          </label>
          <button
            type="button"
            className="admin-button is-danger"
            disabled={pending || !reason.trim()}
            onClick={remove}
          >
            {pending ? "Saving…" : "Stop using"}
          </button>
          <button
            type="button"
            className="admin-link"
            disabled={pending}
            onClick={() => {
              setConfirming(false);
              setReason("");
              setError(null);
            }}
          >
            Keep
          </button>
        </>
      ) : (
        <>
          {row.earlier.length > 0 ? (
            <button type="button" className="admin-link" onClick={onToggleHistory} aria-expanded={historyOpen}>
              {historyOpen ? "Hide history" : `History (${row.earlier.length})`}
            </button>
          ) : null}
          {canEdit ? (
            <>
              <button type="button" className="admin-button" onClick={() => onEdit(row)}>
                Edit
              </button>
              <button type="button" className="admin-link" onClick={() => setConfirming(true)}>
                Stop using
              </button>
            </>
          ) : null}
        </>
      )}
      {error ? (
        <p role="alert" className="form-error admin-user-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The current revision's who-and-why, then every earlier revision, newest first. */
function HistoryRow({ row, columns }: { row: QcReferenceRow; columns: number }) {
  const revisions = [row as QcReferenceRevision, ...row.earlier];
  return (
    <tr className="qc-history-row">
      <td colSpan={columns}>
        <ol className="qc-history">
          {revisions.map((r, index) => (
            <li key={r.id}>
              <span className="qc-history-revision">
                Revision {r.revision}
                {index === 0 ? " · current" : ""}
              </span>
              <span className="qc-table-number">
                {r.reference !== row.reference || r.analyte !== row.analyte
                  ? `${r.reference} ${r.analyte}: `
                  : ""}
                {describeValues(row.kind, r)}
              </span>
              <span className="qc-history-meta">
                {r.revision === 1 ? "Added" : "Changed"} by {r.createdByName}, {formatDay(r.createdAt)}
                {r.changeReason ? `: ${r.changeReason}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </td>
    </tr>
  );
}

export function QcReferenceEditor({
  rows,
  removed,
  canEdit,
}: {
  rows: QcReferenceRow[];
  removed: QcReferenceRow[];
  canEdit: boolean;
}) {
  const [form, setForm] = useState<QcReferenceInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [openHistory, setOpenHistory] = useState<ReadonlySet<string>>(new Set());
  const [pending, startTransition] = useTransition();

  const standards = rows.filter((r) => r.kind === "standard");
  const blanks = rows.filter((r) => r.kind === "blank");
  const set = (field: keyof QcReferenceInput) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  const toggleHistory = (id: string) =>
    setOpenHistory((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const startEdit = (row: QcReferenceRow) => {
    setForm(toInput(row));
    setEditingId(row.id);
    setChangeReason("");
    setError(null);
    setSaved(null);
    document.getElementById("qc-reference-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancel = () => {
    setForm((current) => ({ ...EMPTY, kind: current.kind, unit: current.unit }));
    setEditingId(null);
    setChangeReason("");
    setError(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await saveQcReferenceAction(form, editingId, changeReason);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(
        `${editingId ? "Saved a new revision of" : "Added"} ${form.reference.trim()} ${form.analyte.trim()}.`,
      );
      setForm((current) => ({ ...EMPTY, kind: current.kind, reference: current.reference, unit: current.unit }));
      setEditingId(null);
      setChangeReason("");
    });
  };

  const isStandard = form.kind === "standard";
  const actionColumn = canEdit || rows.some((r) => r.earlier.length > 0);

  const rowCells = (row: QcReferenceRow) => (
    <td>
      <RowActions
        row={row}
        onEdit={startEdit}
        canEdit={canEdit}
        historyOpen={openHistory.has(row.id)}
        onToggleHistory={() => toggleHistory(row.id)}
      />
    </td>
  );

  return (
    <>
      {canEdit ? (
        <section className="admin-card" id="qc-reference-form" aria-labelledby="qc-form-title">
          <div className="admin-card-head">
            <h2 id="qc-form-title">{editingId ? "Change line" : "Add a line"}</h2>
          </div>
          <form className="qc-reference-form" onSubmit={submit} noValidate>
            <label className="field">
              <span className="field-label">Type</span>
              <select
                value={form.kind}
                onChange={(e) => set("kind")(e.target.value)}
                disabled={editingId !== null}
              >
                <option value="standard">Standard (certified reference material)</option>
                <option value="blank">Blank</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">{isStandard ? "Standard name" : "Blank material"}</span>
              <input
                value={form.reference}
                onChange={(e) => set("reference")(e.target.value)}
                placeholder={isStandard ? "OREAS 45e" : "Blank"}
                maxLength={60}
              />
            </label>
            <label className="field">
              <span className="field-label">Element</span>
              <input
                value={form.analyte}
                onChange={(e) => set("analyte")(e.target.value)}
                placeholder="Cu"
                maxLength={20}
              />
            </label>
            <label className="field">
              <span className="field-label">Unit</span>
              <input
                value={form.unit}
                onChange={(e) => set("unit")(e.target.value)}
                placeholder="ppm"
                maxLength={20}
              />
            </label>
            {isStandard ? (
              <>
                <label className="field">
                  <span className="field-label">Certified value</span>
                  <input
                    value={form.expectedValue}
                    onChange={(e) => set("expectedValue")(e.target.value)}
                    inputMode="decimal"
                    placeholder="742"
                  />
                </label>
                <label className="field">
                  <span className="field-label">1 standard deviation</span>
                  <input
                    value={form.standardDeviation}
                    onChange={(e) => set("standardDeviation")(e.target.value)}
                    inputMode="decimal"
                    placeholder="20"
                  />
                </label>
              </>
            ) : (
              <label className="field">
                <span className="field-label">Limit (fails above)</span>
                <input
                  value={form.maxValue}
                  onChange={(e) => set("maxValue")(e.target.value)}
                  inputMode="decimal"
                  placeholder="10"
                />
              </label>
            )}
            {editingId ? (
              <label className="field qc-reference-reason">
                <span className="field-label">Why is it changing?</span>
                <input
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="Corrected from the supplier's certificate"
                  maxLength={500}
                />
              </label>
            ) : null}
            <div className="qc-reference-form-actions">
              <button type="submit" className="auth-submit" disabled={pending}>
                {pending ? "Saving…" : editingId ? "Save as new revision" : "Add line"}
              </button>
              {editingId ? (
                <button type="button" className="admin-link" onClick={cancel}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
          {editingId ? (
            <p className="admin-hint" style={{ margin: 0 }}>
              The current values are kept as an earlier revision. Results are
              checked against the new values from now on; earlier QA/QC
              decisions keep the values they were made on.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="form-error">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p role="status" className="admin-hint" style={{ margin: 0 }}>
              {saved}
            </p>
          ) : null}
        </section>
      ) : (
        <p className="admin-hint" style={{ margin: 0 }}>
          The project manager and the laboratory QA/QC reviewer keep this list.
          You can read it here, with every line&apos;s history.
        </p>
      )}

      <section className="admin-card" aria-labelledby="qc-standards-title">
        <div className="admin-card-head">
          <h2 id="qc-standards-title">Standards</h2>
          <span className="admin-count">{standards.length}</span>
        </div>
        {standards.length === 0 ? (
          <p className="admin-hint" style={{ margin: 0 }}>
            No standards yet. Until a standard&apos;s certified values are
            here, its results show on the QA/QC screen as not checked.
          </p>
        ) : (
          <div className="qc-table-wrap">
            <table className="qc-table">
              <thead>
                <tr>
                  <th>Standard</th>
                  <th>Element</th>
                  <th>Certified</th>
                  <th>1 SD</th>
                  <th>Passes ({STANDARD_WARNING_SD} SD)</th>
                  <th>Fails beyond ({STANDARD_FAILURE_SD} SD)</th>
                  {actionColumn ? <th aria-label="Actions" /> : null}
                </tr>
              </thead>
              <tbody>
                {standards.map((row) => (
                  <Fragment key={row.id}>
                    <tr className={row.id === editingId ? "is-editing" : undefined}>
                      <td className="qc-table-name">
                        {row.reference}
                        {row.revision > 1 ? <span className="qc-revision-tag">rev {row.revision}</span> : null}
                      </td>
                      <td>{row.analyte}</td>
                      <td className="qc-table-number">{withUnit(row.expectedValue, row.unit)}</td>
                      <td className="qc-table-number">{withUnit(row.standardDeviation, row.unit)}</td>
                      <td className="qc-table-number">{band(row, STANDARD_WARNING_SD)}</td>
                      <td className="qc-table-number">{band(row, STANDARD_FAILURE_SD)}</td>
                      {actionColumn ? rowCells(row) : null}
                    </tr>
                    {openHistory.has(row.id) ? <HistoryRow row={row} columns={actionColumn ? 7 : 6} /> : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-card" aria-labelledby="qc-blanks-title">
        <div className="admin-card-head">
          <h2 id="qc-blanks-title">Blanks</h2>
          <span className="admin-count">{blanks.length}</span>
        </div>
        {blanks.length === 0 ? (
          <p className="admin-hint" style={{ margin: 0 }}>
            No blank limits yet. Until an element has a limit here, blank
            results for it show on the QA/QC screen as not checked.
          </p>
        ) : (
          <div className="qc-table-wrap">
            <table className="qc-table">
              <thead>
                <tr>
                  <th>Blank material</th>
                  <th>Element</th>
                  <th>Fails above</th>
                  {actionColumn ? <th aria-label="Actions" /> : null}
                </tr>
              </thead>
              <tbody>
                {blanks.map((row) => (
                  <Fragment key={row.id}>
                    <tr className={row.id === editingId ? "is-editing" : undefined}>
                      <td className="qc-table-name">
                        {row.reference}
                        {row.revision > 1 ? <span className="qc-revision-tag">rev {row.revision}</span> : null}
                      </td>
                      <td>{row.analyte}</td>
                      <td className="qc-table-number">{withUnit(row.maxValue, row.unit)}</td>
                      {actionColumn ? rowCells(row) : null}
                    </tr>
                    {openHistory.has(row.id) ? <HistoryRow row={row} columns={actionColumn ? 4 : 3} /> : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {removed.length > 0 ? (
        <section className="admin-card" aria-labelledby="qc-removed-title">
          <div className="admin-card-head">
            <h2 id="qc-removed-title">No longer used</h2>
            <span className="admin-count">{removed.length}</span>
          </div>
          <p className="admin-hint" style={{ margin: 0 }}>
            Kept so earlier QA/QC decisions can still show what they were
            checked against. Results are no longer checked against these.
          </p>
          <ul className="qc-removed-list">
            {removed.map((row) => (
              <li key={row.id}>
                <span className="qc-table-name">
                  {row.reference} {row.analyte}
                </span>
                <span className="qc-table-number">{describeValues(row.kind, row)}</span>
                <span className="qc-history-meta">
                  Stopped by {row.retiredByName}
                  {row.retiredAt ? `, ${formatDay(row.retiredAt)}` : ""}
                  {row.retireReason ? `: ${row.retireReason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
