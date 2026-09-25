"use client";

import {
  STANDARD_FAILURE_SD,
  STANDARD_WARNING_SD,
  type QcReferenceKind,
} from "@corechain/domain";
import { useState, useTransition, type FormEvent } from "react";
import {
  removeQcReferenceAction,
  saveQcReferenceAction,
  type QcReferenceInput,
} from "./actions";

export type QcReferenceRow = {
  id: string;
  kind: QcReferenceKind;
  reference: string;
  analyte: string;
  unit: string | null;
  expectedValue: number | null;
  standardDeviation: number | null;
  maxValue: number | null;
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

function band(row: QcReferenceRow, sds: number): string {
  if (row.expectedValue == null || row.standardDeviation == null) return "—";
  const low = Math.max(0, row.expectedValue - sds * row.standardDeviation);
  const high = row.expectedValue + sds * row.standardDeviation;
  return `${format(low)} to ${withUnit(high, row.unit)}`;
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

function RowActions({
  row,
  onEdit,
}: {
  row: QcReferenceRow;
  onEdit: (row: QcReferenceRow) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const result = await removeQcReferenceAction(row.id);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="qc-row-actions">
      {confirming ? (
        <>
          <button type="button" className="admin-button is-danger" disabled={pending} onClick={remove}>
            {pending ? "Removing…" : "Remove"}
          </button>
          <button type="button" className="admin-link" disabled={pending} onClick={() => setConfirming(false)}>
            Keep
          </button>
        </>
      ) : (
        <>
          <button type="button" className="admin-button" onClick={() => onEdit(row)}>
            Edit
          </button>
          <button type="button" className="admin-link" onClick={() => setConfirming(true)}>
            Remove
          </button>
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

export function QcReferenceEditor({
  rows,
  canEdit,
}: {
  rows: QcReferenceRow[];
  canEdit: boolean;
}) {
  const [form, setForm] = useState<QcReferenceInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const standards = rows.filter((r) => r.kind === "standard");
  const blanks = rows.filter((r) => r.kind === "blank");
  const set = (field: keyof QcReferenceInput) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const startEdit = (row: QcReferenceRow) => {
    setForm(toInput(row));
    setEditingId(row.id);
    setError(null);
    setSaved(null);
    document.getElementById("qc-reference-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const cancel = () => {
    setForm((current) => ({ ...EMPTY, kind: current.kind, unit: current.unit }));
    setEditingId(null);
    setError(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(null);
    startTransition(async () => {
      const result = await saveQcReferenceAction(form, editingId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(
        `${editingId ? "Saved" : "Added"} ${form.reference.trim()} ${form.analyte.trim()}.`,
      );
      setForm((current) => ({ ...EMPTY, kind: current.kind, reference: current.reference, unit: current.unit }));
      setEditingId(null);
    });
  };

  const isStandard = form.kind === "standard";

  return (
    <>
      {canEdit ? (
        <section className="admin-card" id="qc-reference-form" aria-labelledby="qc-form-title">
          <div className="admin-card-head">
            <h2 id="qc-form-title">{editingId ? "Edit line" : "Add a line"}</h2>
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
            <div className="qc-reference-form-actions">
              <button type="submit" className="auth-submit" disabled={pending}>
                {pending ? "Saving…" : editingId ? "Save changes" : "Add line"}
              </button>
              {editingId ? (
                <button type="button" className="admin-link" onClick={cancel}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
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
          You can read it here.
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
                  {canEdit ? <th aria-label="Actions" /> : null}
                </tr>
              </thead>
              <tbody>
                {standards.map((row) => (
                  <tr key={row.id} className={row.id === editingId ? "is-editing" : undefined}>
                    <td className="qc-table-name">{row.reference}</td>
                    <td>{row.analyte}</td>
                    <td className="qc-table-number">{withUnit(row.expectedValue, row.unit)}</td>
                    <td className="qc-table-number">{withUnit(row.standardDeviation, row.unit)}</td>
                    <td className="qc-table-number">{band(row, STANDARD_WARNING_SD)}</td>
                    <td className="qc-table-number">{band(row, STANDARD_FAILURE_SD)}</td>
                    {canEdit ? (
                      <td>
                        <RowActions row={row} onEdit={startEdit} />
                      </td>
                    ) : null}
                  </tr>
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
                  {canEdit ? <th aria-label="Actions" /> : null}
                </tr>
              </thead>
              <tbody>
                {blanks.map((row) => (
                  <tr key={row.id} className={row.id === editingId ? "is-editing" : undefined}>
                    <td className="qc-table-name">{row.reference}</td>
                    <td>{row.analyte}</td>
                    <td className="qc-table-number">{withUnit(row.maxValue, row.unit)}</td>
                    {canEdit ? (
                      <td>
                        <RowActions row={row} onEdit={startEdit} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
