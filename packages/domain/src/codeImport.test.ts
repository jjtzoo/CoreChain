import { describe, expect, it } from "vitest";
import { parseCsvRows } from "./assayImport";
import {
  classifyCodeImport,
  guessCodeImportMapping,
  guessHeaderRow,
  parseCodeCategory,
  readCodeImportRows,
  summariseCodeImport,
  type CodeImportCandidate,
} from "./codeImport";

function candidate(
  rowNumber: number,
  category: CodeImportCandidate["category"],
  code: string,
  description = "",
  categoryText: string = category ?? "",
): CodeImportCandidate {
  return { rowNumber, category, categoryText, code, description };
}

describe("parseCodeCategory", () => {
  it("reads each category by its key, its phone label and common spreadsheet names", () => {
    expect(parseCodeCategory("lithology")).toBe("lithology");
    expect(parseCodeCategory("LITH")).toBe("lithology");
    expect(parseCodeCategory("Rock type")).toBe("lithology");
    expect(parseCodeCategory("Alteration")).toBe("alteration_type");
    expect(parseCodeCategory("alteration_type")).toBe("alteration_type");
    expect(parseCodeCategory("Alteration intensity")).toBe("alteration_intensity");
    expect(parseCodeCategory("Mineralisation: mineral")).toBe("mineral");
    expect(parseCodeCategory("Mineralization")).toBe("mineral");
    expect(parseCodeCategory("Mineralization style")).toBe("mineral_style");
    expect(parseCodeCategory("  weathering ")).toBe("weathering");
    expect(parseCodeCategory("Structure")).toBe("structure_type");
  });

  it("returns null for anything else", () => {
    expect(parseCodeCategory("Colour")).toBeNull();
    expect(parseCodeCategory("")).toBeNull();
  });
});

describe("reading a sheet", () => {
  it("finds the heading row below a title and maps Category, Code and Description", () => {
    const rows = parseCsvRows(
      "Acme Mining code scheme 2026,,\n,,\nCategory,Code,Description\nLithology,AND,Andesite\n",
    );
    expect(guessHeaderRow(rows)).toBe(2);
    expect(guessCodeImportMapping(rows)).toEqual({
      headerRowIndex: 2,
      codeColumn: 1,
      descriptionColumn: 2,
      category: { column: 0 },
    });
  });

  it("uses the sheet name as the category when there is no category column", () => {
    const rows = [["Code", "Description"], ["PY", "Pyrite"]];
    expect(guessCodeImportMapping(rows, "Mineralisation").category).toEqual({
      fixed: "mineral",
    });
  });

  it("uses a category-name heading over the codes as the category", () => {
    const rows = [["Alteration", "Meaning"], ["PROP", "Propylitic"]];
    expect(guessCodeImportMapping(rows)).toEqual({
      headerRowIndex: 0,
      codeColumn: 0,
      descriptionColumn: 1,
      category: { fixed: "alteration_type" },
    });
  });

  it("keeps Excel row numbers, skips blank rows and turns numbers into text", () => {
    const rows = [
      ["Category", "Code", "Description"],
      ["Alteration intensity", 0, "None"],
      [null, "", undefined],
      ["Alteration intensity", 1, "Weak"],
      ["Colour", "RD", "Red"],
    ];
    const mapping = guessCodeImportMapping(rows);
    expect(readCodeImportRows(rows, mapping)).toEqual([
      candidate(2, "alteration_intensity", "0", "None", "Alteration intensity"),
      candidate(4, "alteration_intensity", "1", "Weak", "Alteration intensity"),
      candidate(5, null, "RD", "Red", "Colour"),
    ]);
  });

  it("trims spaces around codes and descriptions", () => {
    const rows = [["Code", "Description"], ["  RHY ", " Rhyolite  "]];
    const [row] = readCodeImportRows(rows, {
      headerRowIndex: 0,
      codeColumn: 0,
      descriptionColumn: 1,
      category: { fixed: "lithology" },
    });
    expect(row.code).toBe("RHY");
    expect(row.description).toBe("Rhyolite");
  });
});

describe("classifyCodeImport", () => {
  const existing = [
    { category: "lithology" as const, code: "AND", description: "Andesite" },
    { category: "mineral" as const, code: "PY", description: "Pyrite" },
  ];

  it("adds a code that is not in the library yet", () => {
    const [row] = classifyCodeImport([candidate(2, "lithology", "RHY", "Rhyolite")], existing);
    expect(row.status).toBe("new");
  });

  it("skips a code already in the library, ignoring case, and never changes it", () => {
    const [row] = classifyCodeImport(
      [candidate(2, "lithology", "and", "Andesite porphyry")],
      existing,
    );
    expect(row).toMatchObject({
      status: "existing",
      existingCode: "AND",
      existingDescription: "Andesite",
    });
  });

  it("allows the same code in a different category, as the phone does", () => {
    const [row] = classifyCodeImport([candidate(2, "mineral_style", "AND")], existing);
    expect(row.status).toBe("new");
  });

  it("adds the first of two rows with the same code and reports the second as a repeat", () => {
    const rows = classifyCodeImport(
      [
        candidate(2, "weathering", "FR", "Fresh"),
        candidate(3, "weathering", "fr", "Fresh rock"),
      ],
      [],
    );
    expect(rows[0].status).toBe("new");
    expect(rows[1]).toMatchObject({ status: "repeated", firstRowNumber: 2 });
  });

  it("does not let a row with an error block a later row with the same code", () => {
    const rows = classifyCodeImport(
      [candidate(2, null, "FLT", "", "Faults"), candidate(3, "structure_type", "FLT")],
      [],
    );
    expect(rows[0].status).toBe("error");
    expect(rows[1].status).toBe("new");
  });

  it("gives each error its reason, in the phone's own words for code rules", () => {
    const rows = classifyCodeImport(
      [
        candidate(2, "lithology", "", "Andesite"),
        candidate(3, "lithology", "ANDESITEPORPH"),
        candidate(4, null, "RD", "", "Colour"),
        candidate(5, null, "RD", "", ""),
        candidate(6, "lithology", "LONG", "x".repeat(401)),
      ],
      [],
    );
    expect(rows.map((r) => (r.status === "error" ? r.reason : r.status))).toEqual([
      "Enter a short code.",
      "Keep the code to 12 characters or fewer.",
      expect.stringContaining('"Colour" is not a code category.'),
      "No category given.",
      "Keep the description to 400 characters or fewer.",
    ]);
  });

  it("accepts a 12-character code and a 400-character description", () => {
    const [row] = classifyCodeImport(
      [candidate(2, "lithology", "ABCDEFGHIJKL", "x".repeat(400))],
      [],
    );
    expect(row.status).toBe("new");
  });
});

describe("summariseCodeImport", () => {
  it("counts new codes per category and each kind of skipped row", () => {
    const rows = classifyCodeImport(
      [
        candidate(2, "lithology", "RHY"),
        candidate(3, "lithology", "DAC"),
        candidate(4, "weathering", "FR"),
        candidate(5, "lithology", "AND"),
        candidate(6, "lithology", "RHY"),
        candidate(7, "lithology", ""),
      ],
      [{ category: "lithology", code: "AND", description: "Andesite" }],
    );
    const summary = summariseCodeImport(rows);
    expect(summary.newByCategory.lithology).toBe(2);
    expect(summary.newByCategory.weathering).toBe(1);
    expect(summary.newByCategory.mineral).toBe(0);
    expect(summary).toMatchObject({
      newCount: 3,
      existingCount: 1,
      repeatedCount: 1,
      errorCount: 1,
    });
  });
});

describe("parseCsvRows", () => {
  it("keeps blank rows so row numbers match the spreadsheet, and drops a byte-order mark", () => {
    expect(parseCsvRows("﻿Code,Description\n\nPY,Pyrite\n")).toEqual([
      ["Code", "Description"],
      [""],
      ["PY", "Pyrite"],
    ]);
  });
});
