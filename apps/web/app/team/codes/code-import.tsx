"use client";

import {
  CODE_CATEGORIES,
  CODE_CATEGORY_LABELS,
  CODE_IMPORT_MAX_ROWS,
  cellText,
  classifyCodeImport,
  guessCodeImportMapping,
  parseCsvRows,
  readCodeImportRows,
  summariseCodeImport,
  type CodeCategory,
  type CodeImportMapping,
  type CodeImportRow,
  type SheetCell,
} from "@corechain/domain";
import { useMemo, useState, useTransition } from "react";
import { importCodesAction, type CodeImportOutcome } from "./actions";

type Sheet = { name: string; rows: SheetCell[][] };
type ExistingCode = { category: CodeCategory; code: string; description: string };
type Filter = "all" | CodeImportRow["status"];

const TEMPLATE_CSV = [
  "Category,Code,Description",
  "Lithology,AND,Andesite",
  "Alteration type,PROP,Propylitic",
  "Alteration intensity,2,Moderate",
  "Mineralisation: mineral,CPY,Chalcopyrite",
  "Mineralisation: style,DISS,Disseminated",
  "Weathering,MW,Moderately weathered",
  "Structure type,FLT,Fault",
  "",
].join("\r\n");

const STATUS_LABELS: Record<CodeImportRow["status"], string> = {
  new: "New",
  existing: "In library",
  repeated: "Repeated",
  error: "Error",
};

const STATUS_PILL: Record<CodeImportRow["status"], string> = {
  new: "status-pill is-success",
  existing: "status-pill is-muted",
  repeated: "status-pill is-muted",
  error: "status-pill is-danger",
};

const MAX_ROWS_SHOWN = 1000;

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString("en")} ${n === 1 ? one : many}`;
}

function rowResult(row: CodeImportRow): string {
  switch (row.status) {
    case "new":
      return "Will be added.";
    case "existing":
      return `Already in the library as ${row.existingCode}${
        row.existingDescription ? ` (${row.existingDescription})` : ""
      }. Not changed.`;
    case "repeated":
      return `Same code as row ${row.firstRowNumber} in this file.`;
    case "error":
      return row.reason;
  }
}

async function readFile(file: File): Promise<Sheet[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    return [{ name: file.name, rows: parseCsvRows(await file.text()) }];
  }
  if (name.endsWith(".xlsx")) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const sheets = await readXlsxFile(file);
    return sheets.map((sheet) => ({
      name: sheet.sheet,
      rows: sheet.data.map((row) => row.map((cell) => cell as SheetCell)),
    }));
  }
  throw new Error(
    "This file type can't be read. Save it as Excel Workbook (.xlsx) or CSV and upload it again.",
  );
}

function columnLabel(rows: SheetCell[][], headerRowIndex: number, column: number): string {
  const heading = cellText(rows[headerRowIndex]?.[column]);
  return heading ? `${heading} (column ${column + 1})` : `Column ${column + 1}`;
}

function encodeCategory(category: CodeImportMapping["category"]): string {
  return "column" in category ? `column:${category.column}` : `fixed:${category.fixed}`;
}

function decodeCategory(value: string): CodeImportMapping["category"] {
  const [kind, rest] = value.split(":");
  return kind === "column" ? { column: Number(rest) } : { fixed: rest as CodeCategory };
}

export function CodeImport({
  projectId,
  projectName,
  existing,
}: {
  projectId: string;
  projectName: string;
  existing: ExistingCode[];
}) {
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<CodeImportMapping | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<CodeImportOutcome | null>(null);
  const [reading, setReading] = useState(false);
  const [pending, startTransition] = useTransition();

  const sheet = sheets?.[sheetIndex] ?? null;

  const columnCount = useMemo(() => {
    if (!sheet) return 0;
    return sheet.rows.reduce((max, row) => Math.max(max, row.length), 0);
  }, [sheet]);

  const rows: CodeImportRow[] = useMemo(() => {
    if (!sheet || !mapping) return [];
    return classifyCodeImport(readCodeImportRows(sheet.rows, mapping), existing);
  }, [sheet, mapping, existing]);

  const summary = useMemo(() => summariseCodeImport(rows), [rows]);
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);

  const chooseSheet = (index: number, all: Sheet[]) => {
    const next = all[index];
    setSheetIndex(index);
    setMapping(next ? guessCodeImportMapping(next.rows, all.length > 1 ? next.name : undefined) : null);
    setFilter("all");
  };

  const loadFile = async (file: File) => {
    setError(null);
    setOutcome(null);
    setSheets(null);
    setMapping(null);
    setReading(true);
    try {
      const read = (await readFile(file)).filter((s) =>
        s.rows.some((row) => row.some((cell) => cellText(cell) !== "")),
      );
      if (read.length === 0) {
        setError("That file is empty.");
        return;
      }
      setSheets(read);
      setFileName(file.name);
      chooseSheet(0, read);
    } catch (e) {
      setError(
        e instanceof Error && e.message.startsWith("This file type")
          ? e.message
          : "The file could not be read. Check that it opens in Excel, then save it as .xlsx or CSV and try again.",
      );
    } finally {
      setReading(false);
    }
  };

  const reset = () => {
    setSheets(null);
    setMapping(null);
    setFileName("");
    setFilter("all");
    setError(null);
  };

  const runImport = () => {
    if (summary.newCount === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await importCodesAction(
        projectId,
        rows.map((row) => ({
          rowNumber: row.rowNumber,
          categoryText: row.categoryText,
          category: row.category,
          code: row.code,
          description: row.description,
        })),
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      reset();
      setOutcome({ summary: result.summary, skipped: result.skipped });
    });
  };

  if (outcome) {
    return <ImportResult outcome={outcome} projectName={projectName} onAgain={() => setOutcome(null)} />;
  }

  return (
    <section className="admin-card">
      <div className="admin-card-head">
        <h2>Import codes from a spreadsheet</h2>
        <a
          className="admin-link"
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE_CSV)}`}
          download="corechain-code-scheme-template.csv"
        >
          Download a template (CSV)
        </a>
      </div>

      <div className="admin-hint" style={{ display: "grid", gap: 6 }}>
        <p style={{ margin: 0 }}>
          One code per row, with a column for the code and, if you have one, a column
          for the description. The category comes either from a column (for example
          &quot;Category&quot;) or is the same for every row on the sheet.
        </p>
        <p style={{ margin: 0 }}>
          Categories: {CODE_CATEGORIES.map((c) => CODE_CATEGORY_LABELS[c]).join(", ")}.
          Short forms such as LITH, Alteration, Mineralization and Structure are also
          read. Codes are 1 to 12 characters and unique within a category, ignoring
          capitals, the same rule as on the phone. Codes already in the library are
          never changed.
        </p>
      </div>

      <label className="field" style={{ maxWidth: 420 }}>
        <span className="field-label">Spreadsheet (.xlsx or .csv)</span>
        <input
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={reading || pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void loadFile(file);
            e.target.value = "";
          }}
        />
      </label>
      {reading ? <p className="admin-hint">Reading the file…</p> : null}

      {sheets && sheet && mapping ? (
        <>
          <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
            {fileName}
            {sheets.length > 1 ? ` · ${plural(sheets.length, "sheet")}` : ""} ·{" "}
            {plural(rows.length, "code row")}
          </div>

          <div className="code-mapping-grid">
            {sheets.length > 1 ? (
              <label className="field">
                <span className="field-label">Sheet</span>
                <select value={sheetIndex} onChange={(e) => chooseSheet(Number(e.target.value), sheets)}>
                  {sheets.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="field">
              <span className="field-label">Headings are in</span>
              <select
                value={mapping.headerRowIndex}
                onChange={(e) => setMapping({ ...mapping, headerRowIndex: Number(e.target.value) })}
              >
                {sheet.rows.slice(0, 10).map((row, i) => {
                  const preview = row.map(cellText).filter(Boolean).slice(0, 3).join(", ");
                  return (
                    <option key={i} value={i}>
                      Row {i + 1}
                      {preview ? `: ${preview}` : " (blank)"}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Code column</span>
              <select
                value={mapping.codeColumn}
                onChange={(e) => setMapping({ ...mapping, codeColumn: Number(e.target.value) })}
              >
                {Array.from({ length: columnCount }, (_, i) => (
                  <option key={i} value={i}>
                    {columnLabel(sheet.rows, mapping.headerRowIndex, i)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Description column</span>
              <select
                value={mapping.descriptionColumn ?? ""}
                onChange={(e) =>
                  setMapping({
                    ...mapping,
                    descriptionColumn: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              >
                <option value="">None (codes only)</option>
                {Array.from({ length: columnCount }, (_, i) => (
                  <option key={i} value={i}>
                    {columnLabel(sheet.rows, mapping.headerRowIndex, i)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Category</span>
              <select
                value={encodeCategory(mapping.category)}
                onChange={(e) => setMapping({ ...mapping, category: decodeCategory(e.target.value) })}
              >
                <optgroup label="Read from a column">
                  {Array.from({ length: columnCount }, (_, i) => (
                    <option key={i} value={`column:${i}`}>
                      {columnLabel(sheet.rows, mapping.headerRowIndex, i)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Every row on this sheet is">
                  {CODE_CATEGORIES.map((c) => (
                    <option key={c} value={`fixed:${c}`}>
                      {CODE_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
          </div>

          <div>
            <div className="kpi-strip-label">Preview</div>
            <div className="code-count-grid">
              <div className="stat-cell">
                <div className="stat-cell-label">New codes</div>
                <div className="stat-cell-value">{summary.newCount.toLocaleString("en")}</div>
              </div>
              <div className="stat-cell">
                <div className="stat-cell-label">Already in library</div>
                <div className="stat-cell-value">{summary.existingCount.toLocaleString("en")}</div>
              </div>
              <div className="stat-cell">
                <div className="stat-cell-label">Repeated in file</div>
                <div className="stat-cell-value">{summary.repeatedCount.toLocaleString("en")}</div>
              </div>
              <div className="stat-cell">
                <div className="stat-cell-label">Rows with errors</div>
                <div className="stat-cell-value">{summary.errorCount.toLocaleString("en")}</div>
              </div>
            </div>
            {summary.newCount > 0 ? (
              <p className="admin-hint" style={{ margin: "10px 0 0" }}>
                New by category:{" "}
                {CODE_CATEGORIES.filter((c) => summary.newByCategory[c] > 0)
                  .map((c) => `${CODE_CATEGORY_LABELS[c]} ${summary.newByCategory[c]}`)
                  .join(" · ")}
              </p>
            ) : null}
          </div>

          <div className="code-filter" role="group" aria-label="Show rows">
            {(["all", "new", "existing", "repeated", "error"] as const).map((f) => {
              const count =
                f === "all"
                  ? rows.length
                  : f === "new"
                    ? summary.newCount
                    : f === "existing"
                      ? summary.existingCount
                      : f === "repeated"
                        ? summary.repeatedCount
                        : summary.errorCount;
              return (
                <button
                  key={f}
                  type="button"
                  className="admin-button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "All rows" : STATUS_LABELS[f]} ({count.toLocaleString("en")})
                </button>
              );
            })}
          </div>

          <CodeRowsTable rows={shown} />

          {rows.length > CODE_IMPORT_MAX_ROWS ? (
            <p role="alert" className="form-error admin-user-error">
              One import takes up to {CODE_IMPORT_MAX_ROWS.toLocaleString("en")} rows. Split
              the file and import each part.
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="auth-submit"
              disabled={pending || summary.newCount === 0 || rows.length > CODE_IMPORT_MAX_ROWS}
              onClick={runImport}
            >
              {pending
                ? "Adding codes…"
                : `Add ${plural(summary.newCount, "code")} to ${projectName}`}
            </button>
            <button type="button" className="admin-button" disabled={pending} onClick={reset}>
              Cancel
            </button>
            {summary.newCount > 0 ? (
              <span className="admin-hint">
                Rows that are not new are skipped. Nothing is added until you confirm.
              </span>
            ) : null}
          </div>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="form-error admin-user-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function CodeRowsTable({ rows }: { rows: CodeImportRow[] }) {
  if (rows.length === 0) {
    return <p className="admin-hint">No rows to show.</p>;
  }
  return (
    <>
      <div className="code-table-wrap">
        <table className="code-import-table">
          <thead>
            <tr>
              <th scope="col">Row</th>
              <th scope="col">Category</th>
              <th scope="col">Code</th>
              <th scope="col">Description</th>
              <th scope="col">Status</th>
              <th scope="col">Result</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, MAX_ROWS_SHOWN).map((row) => (
              <tr key={row.rowNumber}>
                <td className="code-import-num">{row.rowNumber}</td>
                <td>{row.category ? CODE_CATEGORY_LABELS[row.category] : row.categoryText || "—"}</td>
                <td className="code-import-code">{row.code || "—"}</td>
                <td>{row.description}</td>
                <td>
                  <span className={STATUS_PILL[row.status]}>{STATUS_LABELS[row.status]}</span>
                </td>
                <td>{rowResult(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_ROWS_SHOWN ? (
        <p className="admin-hint">
          Showing the first {MAX_ROWS_SHOWN.toLocaleString("en")} of{" "}
          {rows.length.toLocaleString("en")} rows.
        </p>
      ) : null}
    </>
  );
}

function ImportResult({
  outcome,
  projectName,
  onAgain,
}: {
  outcome: CodeImportOutcome;
  projectName: string;
  onAgain: () => void;
}) {
  const { summary, skipped } = outcome;
  const skippedCount = summary.existingCount + summary.repeatedCount + summary.errorCount;
  const reasons = [
    summary.existingCount > 0 ? `${summary.existingCount.toLocaleString("en")} already in the library` : null,
    summary.repeatedCount > 0 ? `${summary.repeatedCount.toLocaleString("en")} repeated in the file` : null,
    summary.errorCount > 0 ? `${plural(summary.errorCount, "row")} with errors` : null,
  ].filter(Boolean);

  return (
    <section className="admin-card" aria-live="polite">
      <div className="admin-card-head">
        <h2>
          Added {plural(summary.newCount, "code")} to {projectName}
        </h2>
        <button type="button" className="admin-button" onClick={onAgain}>
          Import another file
        </button>
      </div>

      <div className="code-table-wrap">
        <table className="code-import-table">
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Codes added</th>
            </tr>
          </thead>
          <tbody>
            {CODE_CATEGORIES.map((c) => (
              <tr key={c}>
                <td>{CODE_CATEGORY_LABELS[c]}</td>
                <td className="code-import-num">{summary.newByCategory[c].toLocaleString("en")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ margin: 0 }}>
        {skippedCount === 0
          ? "No rows were skipped."
          : `Skipped ${plural(skippedCount, "row")}: ${reasons.join(", ")}.`}
      </p>

      {skipped.length > 0 ? <CodeRowsTable rows={skipped} /> : null}

      <p className="admin-hint" style={{ margin: 0 }}>
        Geologists get the new codes on the phone&apos;s Code library and in the log
        pickers after their next sync. To remove or hide a code, use the Code library
        screen on the phone.
      </p>
    </section>
  );
}
