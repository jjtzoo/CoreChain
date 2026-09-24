// E16: import a company's code scheme from a spreadsheet (web, project
// manager). A company's lithology, alteration, mineralisation, weathering
// and structure codes usually already live in a spreadsheet, often hundreds
// of rows, which nobody will type one at a time on the phone's Code library
// screen.
//
// Every row is checked with the same rule the phone uses when a geologist
// adds a code (`validateCodeInput` in logging.ts), so the web accepts
// exactly what the phone would: a code of 1 to 12 characters, unique per
// category ignoring case. Existing codes are never changed by an import: a
// code already in the library (hidden ones included) is skipped, so
// intervals already logged against it keep their meaning.

import {
  CODE_CATEGORIES,
  CODE_CATEGORY_LABELS,
  validateCodeInput,
  type CodeCategory,
  type LibraryCode,
  type LibraryCodeInput,
} from "./logging";

/**
 * The longest description the server accepts when a phone uploads a code
 * (`apps/web/lib/sync/tables.ts`, code_library.description). An imported
 * description longer than this would be refused the first time a geologist
 * edited it on the phone, so the import stops it here instead.
 */
export const CODE_DESCRIPTION_MAX_LENGTH = 400;

/** The most rows one import will take; a larger scheme is split into files. */
export const CODE_IMPORT_MAX_ROWS = 5000;

// --- Categories -------------------------------------------------------------

function normaliseLabel(text: string): string {
  return text
    .toLowerCase()
    .replace(/mineralization/g, "mineralisation")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Names a company spreadsheet commonly uses for each category, besides the
// category's own key and its label on the phone. Compared after
// `normaliseLabel`, so case, punctuation and "-ization" spelling don't matter.
const CATEGORY_ALIASES: Record<CodeCategory, readonly string[]> = {
  lithology: ["lith", "litho", "rock", "rock type", "rock code", "lithology code"],
  alteration_type: ["alteration", "alt", "alt type", "alteration code"],
  alteration_intensity: [
    "intensity",
    "alt intensity",
    "alt int",
    "alteration strength",
  ],
  mineral: [
    "mineralisation",
    "mineralisation mineral",
    "min",
    "minerals",
    "ore mineral",
    "sulphide",
    "sulfide",
  ],
  mineral_style: [
    "style",
    "min style",
    "mineralisation style",
    "mineral style",
    "mineralisation type",
  ],
  weathering: ["weath", "wth", "weathering grade", "oxidation"],
  structure_type: ["structure", "struct", "structures", "structure code"],
};

const CATEGORY_BY_NAME: ReadonlyMap<string, CodeCategory> = new Map(
  CODE_CATEGORIES.flatMap((category) =>
    [
      category,
      CODE_CATEGORY_LABELS[category],
      ...CATEGORY_ALIASES[category],
    ].map((name) => [normaliseLabel(name), category] as const),
  ),
);

/**
 * Reads a category as a spreadsheet names it ("Lithology", "LITH",
 * "Alteration intensity", "Mineralization style", "structure_type"), or
 * null when it isn't one of the phone's seven categories.
 */
export function parseCodeCategory(text: string): CodeCategory | null {
  return CATEGORY_BY_NAME.get(normaliseLabel(text)) ?? null;
}

// --- Reading the sheet ------------------------------------------------------

/** One cell as read from CSV or Excel. Numbers matter: intensity codes are often 0 to 4. */
export type SheetCell = string | number | boolean | Date | null | undefined;

export function cellText(cell: SheetCell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).trim();
}

function isBlankRow(row: readonly SheetCell[]): boolean {
  return row.every((cell) => cellText(cell) === "");
}

const CODE_HEADER = /^(code|codes|short code|abbreviation|abbrev|abbr|symbol|log code)$/;
const DESCRIPTION_HEADER = /^(description|desc|name|meaning|full name|definition)$/;
const CATEGORY_HEADER = /^(category|type|code type|group|field|table|code group|list)$/;

/**
 * Which row holds the column headings. Company sheets often have a title or
 * a note above the table, so the first row among the first ten that has a
 * "Code" heading wins; otherwise the first row with anything in it.
 */
export function guessHeaderRow(rows: readonly (readonly SheetCell[])[]): number {
  const limit = Math.min(rows.length, 10);
  for (let i = 0; i < limit; i += 1) {
    if (rows[i].some((cell) => CODE_HEADER.test(normaliseLabel(cellText(cell))))) {
      return i;
    }
  }
  const firstFilled = rows.findIndex((row) => !isBlankRow(row));
  return firstFilled >= 0 ? firstFilled : 0;
}

/**
 * Where each piece of a code comes from. The category is either a column of
 * the sheet, or one category for every row (a sheet per category is a
 * common layout).
 */
export type CodeImportMapping = {
  headerRowIndex: number;
  codeColumn: number;
  descriptionColumn: number | null;
  category: { column: number } | { fixed: CodeCategory };
};

/**
 * A first guess at the mapping from the headings, for the person to check.
 * `sheetName` helps when a workbook keeps one category per sheet ("Lithology",
 * "Alteration").
 */
export function guessCodeImportMapping(
  rows: readonly (readonly SheetCell[])[],
  sheetName?: string,
): CodeImportMapping {
  const headerRowIndex = guessHeaderRow(rows);
  const headers = (rows[headerRowIndex] ?? []).map((cell) =>
    normaliseLabel(cellText(cell)),
  );

  const find = (pattern: RegExp) => headers.findIndex((h) => pattern.test(h));
  const codeFound = find(CODE_HEADER);
  const descriptionFound = find(DESCRIPTION_HEADER);
  // Only a heading such as "Category" or "Type" marks the category column. A
  // heading that is itself a category name ("Lithology") usually sits above
  // the codes, so it sets the one category for the sheet instead (below).
  const categoryFound = find(CATEGORY_HEADER);

  const codeColumn = codeFound >= 0 ? codeFound : categoryFound === 0 ? 1 : 0;
  const descriptionColumn =
    descriptionFound >= 0
      ? descriptionFound
      : headers.findIndex(
          (h, i) => i !== codeColumn && i !== categoryFound && h !== "",
        );

  const fromSheet = sheetName ? parseCodeCategory(sheetName) : null;
  const fromCodeHeading = parseCodeCategory(headers[codeColumn] ?? "");
  const category: CodeImportMapping["category"] =
    categoryFound >= 0
      ? { column: categoryFound }
      : { fixed: fromSheet ?? fromCodeHeading ?? "lithology" };

  return {
    headerRowIndex,
    codeColumn,
    descriptionColumn: descriptionColumn >= 0 ? descriptionColumn : null,
    category,
  };
}

/** One data row of the sheet, read through the mapping but not yet checked. */
export type CodeImportCandidate = {
  /** The row number as the person sees it in Excel (1 is the first row). */
  rowNumber: number;
  /** The category exactly as written in the sheet, for the preview. */
  categoryText: string;
  category: CodeCategory | null;
  code: string;
  description: string;
};

/** Every row below the headings, blank rows left out. */
export function readCodeImportRows(
  rows: readonly (readonly SheetCell[])[],
  mapping: CodeImportMapping,
): CodeImportCandidate[] {
  const candidates: CodeImportCandidate[] = [];
  rows.forEach((row, index) => {
    if (index <= mapping.headerRowIndex || isBlankRow(row)) return;

    let categoryText: string;
    let category: CodeCategory | null;
    if ("fixed" in mapping.category) {
      category = mapping.category.fixed;
      categoryText = CODE_CATEGORY_LABELS[category];
    } else {
      categoryText = cellText(row[mapping.category.column]);
      category = parseCodeCategory(categoryText);
    }

    candidates.push({
      rowNumber: index + 1,
      categoryText,
      category,
      code: cellText(row[mapping.codeColumn]),
      description:
        mapping.descriptionColumn === null
          ? ""
          : cellText(row[mapping.descriptionColumn]),
    });
  });
  return candidates;
}

// --- Checking each row ------------------------------------------------------

export type CodeImportRow = CodeImportCandidate &
  (
    | { status: "new"; category: CodeCategory }
    | {
        status: "existing";
        category: CodeCategory;
        /** The code as it is already written in the library. */
        existingCode: string;
        existingDescription: string;
      }
    | { status: "repeated"; category: CodeCategory; firstRowNumber: number }
    | { status: "error"; reason: string }
  );

type ExistingCode = Pick<LibraryCode, "category" | "code" | "description">;

/**
 * Sorts every row into: a new code to add, a code already in the project's
 * library (skipped, never changed), a repeat of an earlier row in the same
 * file (skipped), or an error with its reason. `existing` is the project's
 * current library without deleted codes, hidden ones included — the same
 * list the phone checks against.
 */
export function classifyCodeImport(
  candidates: readonly CodeImportCandidate[],
  existing: readonly ExistingCode[],
): CodeImportRow[] {
  const accepted: (LibraryCodeInput & { rowNumber: number })[] = [];

  return candidates.map((candidate): CodeImportRow => {
    const { category } = candidate;
    if (category === null) {
      return {
        ...candidate,
        status: "error",
        reason: candidate.categoryText
          ? `"${candidate.categoryText}" is not a code category. Use one of: ${CODE_CATEGORIES.map((c) => CODE_CATEGORY_LABELS[c]).join(", ")}.`
          : "No category given.",
      };
    }

    const input: LibraryCodeInput = {
      category,
      code: candidate.code,
      description: candidate.description,
    };

    // The phone's own rule with nothing to clash with: empty or too long.
    const shape = validateCodeInput(input, []);
    if (!shape.valid) {
      return {
        ...candidate,
        category,
        status: "error",
        reason: shape.errors.map((e) => e.message).join(" "),
      };
    }
    if (candidate.description.length > CODE_DESCRIPTION_MAX_LENGTH) {
      return {
        ...candidate,
        category,
        status: "error",
        reason: `Keep the description to ${CODE_DESCRIPTION_MAX_LENGTH} characters or fewer.`,
      };
    }

    // The phone's rule against the library: unique per category, ignoring case.
    if (!validateCodeInput(input, existing).valid) {
      const match = existing.find(
        (e) =>
          e.category === category &&
          e.code.toLowerCase() === candidate.code.toLowerCase(),
      );
      return {
        ...candidate,
        category,
        status: "existing",
        existingCode: match?.code ?? candidate.code,
        existingDescription: match?.description ?? "",
      };
    }

    // And against the rows already accepted from this file.
    if (!validateCodeInput(input, accepted).valid) {
      const first = accepted.find(
        (a) =>
          a.category === category &&
          a.code.toLowerCase() === candidate.code.toLowerCase(),
      );
      return {
        ...candidate,
        category,
        status: "repeated",
        firstRowNumber: first?.rowNumber ?? candidate.rowNumber,
      };
    }

    accepted.push({ ...input, rowNumber: candidate.rowNumber });
    return { ...candidate, category, status: "new" };
  });
}

// --- Summary ----------------------------------------------------------------

export type CodeImportSummary = {
  /** New codes per category, every category listed (0 when none). */
  newByCategory: Record<CodeCategory, number>;
  newCount: number;
  existingCount: number;
  repeatedCount: number;
  errorCount: number;
};

export function summariseCodeImport(
  rows: readonly CodeImportRow[],
): CodeImportSummary {
  const newByCategory = Object.fromEntries(
    CODE_CATEGORIES.map((c) => [c, 0]),
  ) as Record<CodeCategory, number>;
  let existingCount = 0;
  let repeatedCount = 0;
  let errorCount = 0;
  for (const row of rows) {
    if (row.status === "new") newByCategory[row.category] += 1;
    else if (row.status === "existing") existingCount += 1;
    else if (row.status === "repeated") repeatedCount += 1;
    else errorCount += 1;
  }
  return {
    newByCategory,
    newCount: CODE_CATEGORIES.reduce((sum, c) => sum + newByCategory[c], 0),
    existingCount,
    repeatedCount,
    errorCount,
  };
}
