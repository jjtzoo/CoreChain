"use client";

import {
  previewAssayImport,
  parseCsv,
  type AssayColumnMapping,
  type AssayImportPreview,
  type ParsedCsv,
} from "@corechain/domain";
import { useMemo, useState, useTransition } from "react";
import { importAssayResultsAction } from "./actions";

export type ImportSample = {
  id: string;
  sampleNumber: string;
  receivedAt: string | null;
};

function guessSampleColumn(headers: string[]): number {
  const i = headers.findIndex((h) => /sample/i.test(h));
  return i >= 0 ? i : 0;
}

export function AssayCsvImport({
  dispatchId,
  samples,
}: {
  dispatchId: string;
  samples: ImportSample[];
}) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState("");
  const [sampleColumnIndex, setSampleColumnIndex] = useState(0);
  const [analyteColumns, setAnalyteColumns] = useState<Map<number, AssayColumnMapping>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const receivedSampleNumbers = useMemo(
    () => new Set(samples.filter((s) => s.receivedAt).map((s) => s.sampleNumber)),
    [samples],
  );
  const sampleIdByNumber = useMemo(
    () => new Map(samples.map((s) => [s.sampleNumber, s.id])),
    [samples],
  );

  const loadFile = (file: File) => {
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0) {
        setError("That file has no header row, or is empty.");
        setCsv(null);
        return;
      }
      setCsv(parsed);
      setFileName(file.name);
      setSampleColumnIndex(guessSampleColumn(parsed.headers));
      // Nothing is pre-checked: a real lab sheet often has non-result
      // columns (note, analyst, date) alongside the analyte columns, and
      // guessing wrong would silently import junk results. The chemist
      // picks every result column themselves.
      setAnalyteColumns(new Map());
    };
    reader.onerror = () => setError("Couldn't read that file.");
    reader.readAsText(file);
  };

  const toggleColumn = (index: number, header: string) => {
    setAnalyteColumns((prev) => {
      const next = new Map(prev);
      if (next.has(index)) next.delete(index);
      else next.set(index, { columnIndex: index, analyte: header.trim(), unit: null });
      return next;
    });
  };

  const renameAnalyte = (index: number, analyte: string) => {
    setAnalyteColumns((prev) => {
      const next = new Map(prev);
      const existing = next.get(index);
      if (existing) next.set(index, { ...existing, analyte });
      return next;
    });
  };

  const setUnit = (index: number, unit: string) => {
    setAnalyteColumns((prev) => {
      const next = new Map(prev);
      const existing = next.get(index);
      if (existing) next.set(index, { ...existing, unit: unit || null });
      return next;
    });
  };

  const preview: AssayImportPreview | null = useMemo(() => {
    if (!csv) return null;
    return previewAssayImport(
      csv,
      { sampleColumnIndex, analyteColumns: [...analyteColumns.values()] },
      receivedSampleNumbers,
    );
  }, [csv, sampleColumnIndex, analyteColumns, receivedSampleNumbers]);

  const reset = () => {
    setCsv(null);
    setFileName("");
    setAnalyteColumns(new Map());
    setError(null);
    setResult(null);
  };

  const runImport = () => {
    if (!preview || preview.rows.length === 0) return;
    setError(null);
    startTransition(async () => {
      const outcome = await importAssayResultsAction(
        dispatchId,
        preview.rows.map((row) => ({
          sampleId: sampleIdByNumber.get(row.sampleNumber)!,
          analyte: row.analyte,
          value: row.value,
          unit: row.unit,
          belowDetection: row.belowDetection,
        })),
      );
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }
      reset();
      setResult(`Imported ${outcome.imported} result${outcome.imported === 1 ? "" : "s"}.`);
    });
  };

  if (!open) {
    return (
      <button type="button" className="admin-button" onClick={() => setOpen(true)}>
        Upload results (CSV)
      </button>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14, padding: "16px 18px", background: "var(--canvas)", border: "1px solid var(--line)", borderRadius: "var(--radius-panel)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Upload results (CSV)</span>
        <button type="button" className="admin-link" onClick={() => { setOpen(false); reset(); }}>
          Close
        </button>
      </div>

      <p className="admin-hint" style={{ margin: 0 }}>
        There&apos;s no single official lab-certificate format, so map the columns yourself:
        pick which column is the sample number, then which columns are results. Only
        samples already confirmed received can take results.
      </p>

      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadFile(file);
        }}
      />

      {csv ? (
        <>
          <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
            {fileName} · {csv.headers.length} columns · {csv.rows.length} rows
          </div>

          <label className="field">
            <span className="field-label">Sample number column</span>
            <select
              value={sampleColumnIndex}
              onChange={(e) => setSampleColumnIndex(Number(e.target.value))}
            >
              {csv.headers.map((header, i) => (
                <option key={i} value={i}>
                  {header || `Column ${i + 1}`}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "grid", gap: 6 }}>
            <span className="field-label">Result columns</span>
            {csv.headers.map((header, i) => {
              if (i === sampleColumnIndex) return null;
              const mapping = analyteColumns.get(i);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 160 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(mapping)}
                      onChange={() => toggleColumn(i, header)}
                    />
                    <span style={{ fontSize: "0.8rem" }}>{header || `Column ${i + 1}`}</span>
                  </label>
                  {mapping ? (
                    <>
                      <input
                        value={mapping.analyte}
                        onChange={(e) => renameAnalyte(i, e.target.value)}
                        placeholder="Analyte, e.g. Au"
                        maxLength={40}
                        aria-label={`Analyte name for column ${header}`}
                        style={{ width: "7rem" }}
                      />
                      <input
                        value={mapping.unit ?? ""}
                        onChange={(e) => setUnit(i, e.target.value)}
                        placeholder="Unit, e.g. g/t"
                        maxLength={20}
                        aria-label={`Unit for column ${header}`}
                        style={{ width: "6rem" }}
                      />
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>

          {preview ? (
            <div style={{ fontSize: "0.8rem" }}>
              <strong>{preview.rows.length}</strong> result{preview.rows.length === 1 ? "" : "s"} across{" "}
              <strong>{new Set(preview.rows.map((r) => r.sampleNumber)).size}</strong> sample
              {new Set(preview.rows.map((r) => r.sampleNumber)).size === 1 ? "" : "s"} ready to import.
              {preview.problems.length > 0 ? (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18, color: "var(--warning-ink)" }}>
                  {preview.problems.slice(0, 10).map((p, i) => (
                    <li key={i}>
                      Row {p.rowIndex + 2}, sample &quot;{p.sampleNumber}&quot;:{" "}
                      {p.reason === "unknown_sample"
                        ? "not a received sample on this dispatch"
                        : "no result value in any selected column"}
                    </li>
                  ))}
                  {preview.problems.length > 10 ? <li>and {preview.problems.length - 10} more</li> : null}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div>
            <button
              type="button"
              className="admin-button"
              disabled={pending || !preview || preview.rows.length === 0}
              onClick={runImport}
            >
              {pending ? "Importing…" : `Import ${preview?.rows.length ?? 0} results`}
            </button>
          </div>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="form-error admin-user-error">
          {error}
        </p>
      ) : null}
      {result ? <p className="admin-hint">{result}</p> : null}
    </div>
  );
}
