export type CsvRow = Record<string, string>;

/**
 * Parses the small, curated CSV imports used in the Phase 1 demonstration.
 * It intentionally supports quoted commas and line breaks so provenance text
 * can be preserved without introducing another dependency.
 */
export function parseCsv(input: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const nextCharacter = input[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && nextCharacter === "\n") {
        index += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  if (quoted) {
    throw new Error("CSV import has an unclosed quoted field.");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [headerRow, ...dataRows] = rows;
  if (!headerRow || headerRow.length === 0) {
    throw new Error("CSV import has no header row.");
  }

  const headers = headerRow.map((header, index) =>
    index === 0 ? header.replace(/^\uFEFF/, "") : header,
  );

  if (new Set(headers).size !== headers.length) {
    throw new Error("CSV import has duplicate headers.");
  }

  return dataRows
    .filter((dataRow) => dataRow.some((value) => value.length > 0))
    .map((dataRow, rowIndex) => {
      if (dataRow.length !== headers.length) {
        throw new Error(
          `CSV import row ${rowIndex + 2} has ${dataRow.length} cells; expected ${headers.length}.`,
        );
      }

      return Object.fromEntries(
        headers.map((header, columnIndex) => [header, dataRow[columnIndex]]),
      );
    });
}
