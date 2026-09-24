// Bulk assay-results import (Laboratory screen, "Upload results").
//
// There is no single official machine-readable format a lab assay
// certificate follows — ALS, SGS, Bureau Veritas and every other lab lay
// their own certificates out differently, and even professional geology
// database software (Oasis montaj, Datamine, Acquire) doesn't assume a
// fixed schema: it asks the person to map columns on import. This module
// follows the same pattern rather than guessing at a format nobody can
// confirm: parse whatever CSV the chemist uploads, let them say which
// column is the sample number and which columns are analytes, then turn
// that mapping into the same `AssayResult` rows manual entry already
// produces — one row per sample-analyte pair, through the same action.

/** A parsed CSV: the header row, and every data row below it, as raw strings. */
export type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

/**
 * A minimal RFC 4180 CSV parser: quoted fields (with embedded commas,
 * newlines and doubled "" quotes) and both LF and CRLF line endings.
 * Blank trailing lines are dropped. The first row is always the header.
 */
export function parseCsv(text: string): ParsedCsv {
  const nonEmpty = parseCsvRows(text).filter((r) => r.some((cell) => cell.trim() !== ""));
  const [headers = [], ...dataRows] = nonEmpty;
  return { headers, rows: dataRows };
}

/**
 * Every row of a CSV file, blank ones included, so that row `i` is line
 * `i + 1` of the spreadsheet the person opened (quoted newlines aside). A
 * leading byte-order mark, which Excel adds to "CSV UTF-8" files, is dropped.
 */
export function parseCsvRows(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      endField();
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1;
      continue;
    }
    if (char === "\n") {
      endRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) endRow();
  return rows;
}

/**
 * One CSV cell's value: a leading "<" is the standard below-detection
 * convention ("<0.005"), an empty cell means no result for that
 * sample/analyte (skipped, not zero), and anything else is parsed as a
 * plain number.
 */
export function parseAssayCell(
  raw: string,
): { present: false } | { present: true; value: number | null; belowDetection: boolean } {
  const trimmed = raw.trim();
  if (trimmed === "") return { present: false };
  if (trimmed.startsWith("<")) {
    const value = Number(trimmed.slice(1).trim());
    return { present: true, value: Number.isFinite(value) ? value : null, belowDetection: true };
  }
  const value = Number(trimmed);
  return { present: true, value: Number.isFinite(value) ? value : null, belowDetection: false };
}

export type AssayColumnMapping = {
  columnIndex: number;
  /** The analyte name to record — defaults to the column header, editable. */
  analyte: string;
  unit: string | null;
};

export type AssayImportMapping = {
  sampleColumnIndex: number;
  analyteColumns: AssayColumnMapping[];
};

export type AssayImportRow = {
  rowIndex: number;
  sampleNumber: string;
  analyte: string;
  value: number | null;
  unit: string | null;
  belowDetection: boolean;
};

export type AssayImportProblem = {
  rowIndex: number;
  sampleNumber: string;
  reason: "unknown_sample" | "missing_analyte";
};

export type AssayImportPreview = {
  rows: AssayImportRow[];
  problems: AssayImportProblem[];
};

/**
 * Turns a parsed CSV plus the person's column mapping into the rows
 * `enterAssayResultAction` already knows how to write — one per
 * sample/analyte pair with a value present. `knownSampleNumbers` is this
 * dispatch's own samples: a CSV row naming a sample outside that set is
 * reported as a problem rather than silently written (it isn't this
 * dispatch's data, or the sample number was mistyped).
 */
export function previewAssayImport(
  csv: ParsedCsv,
  mapping: AssayImportMapping,
  knownSampleNumbers: ReadonlySet<string>,
): AssayImportPreview {
  const rows: AssayImportRow[] = [];
  const problems: AssayImportProblem[] = [];

  csv.rows.forEach((cells, i) => {
    const sampleNumber = (cells[mapping.sampleColumnIndex] ?? "").trim();
    if (!sampleNumber) return;

    if (!knownSampleNumbers.has(sampleNumber)) {
      problems.push({ rowIndex: i, sampleNumber, reason: "unknown_sample" });
      return;
    }

    let anyAnalyte = false;
    for (const column of mapping.analyteColumns) {
      const cell = parseAssayCell(cells[column.columnIndex] ?? "");
      if (!cell.present) continue;
      anyAnalyte = true;
      rows.push({
        rowIndex: i,
        sampleNumber,
        analyte: column.analyte,
        value: cell.value,
        unit: column.unit,
        belowDetection: cell.belowDetection,
      });
    }
    if (!anyAnalyte) {
      problems.push({ rowIndex: i, sampleNumber, reason: "missing_analyte" });
    }
  });

  return { rows, problems };
}
