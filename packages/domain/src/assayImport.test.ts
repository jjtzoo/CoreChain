import { describe, expect, it } from "vitest";
import { parseAssayCell, parseCsv, previewAssayImport } from "./assayImport";

describe("parseCsv", () => {
  it("splits a simple comma-separated file into headers and rows", () => {
    const csv = parseCsv("Sample,Au,Ag\nMR-01,1.2,3.4\nMR-02,0.9,2.1\n");
    expect(csv.headers).toEqual(["Sample", "Au", "Ag"]);
    expect(csv.rows).toEqual([
      ["MR-01", "1.2", "3.4"],
      ["MR-02", "0.9", "2.1"],
    ]);
  });

  it("handles quoted fields with embedded commas, newlines and doubled quotes", () => {
    const csv = parseCsv('Sample,Note\nMR-01,"contains, a comma"\nMR-02,"line one\nline two"\nMR-03,"she said ""hi"""\n');
    expect(csv.rows).toEqual([
      ["MR-01", "contains, a comma"],
      ["MR-02", "line one\nline two"],
      ["MR-03", 'she said "hi"'],
    ]);
  });

  it("accepts CRLF line endings", () => {
    const csv = parseCsv("Sample,Au\r\nMR-01,1.2\r\n");
    expect(csv.headers).toEqual(["Sample", "Au"]);
    expect(csv.rows).toEqual([["MR-01", "1.2"]]);
  });

  it("drops blank trailing lines and a file with only a header", () => {
    const csv = parseCsv("Sample,Au\n\n\n");
    expect(csv.headers).toEqual(["Sample", "Au"]);
    expect(csv.rows).toEqual([]);
  });

  it("returns no headers or rows for an empty file", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });
});

describe("parseAssayCell", () => {
  it("parses a plain number", () => {
    expect(parseAssayCell("1.24")).toEqual({ present: true, value: 1.24, belowDetection: false });
  });

  it("treats a leading < as below detection", () => {
    expect(parseAssayCell("<0.005")).toEqual({ present: true, value: 0.005, belowDetection: true });
  });

  it("treats an empty cell as absent, not zero", () => {
    expect(parseAssayCell("")).toEqual({ present: false });
    expect(parseAssayCell("   ")).toEqual({ present: false });
  });

  it("keeps a non-numeric cell present with a null value rather than dropping it silently", () => {
    expect(parseAssayCell("n/a")).toEqual({ present: true, value: null, belowDetection: false });
  });
});

describe("previewAssayImport", () => {
  const csv = parseCsv(
    "SampleNo,Au_ppm,Ag_ppm,Note\nMR-01,1.2,<0.5,ok\nMR-02,,3.1,\nMR-99,0.4,0.2,\n",
  );
  const mapping = {
    sampleColumnIndex: 0,
    analyteColumns: [
      { columnIndex: 1, analyte: "Au", unit: "ppm" },
      { columnIndex: 2, analyte: "Ag", unit: "ppm" },
    ],
  };

  it("builds one row per present sample/analyte cell, and flags an unknown sample", () => {
    const result = previewAssayImport(csv, mapping, new Set(["MR-01", "MR-02"]));

    expect(result.rows).toEqual([
      { rowIndex: 0, sampleNumber: "MR-01", analyte: "Au", value: 1.2, unit: "ppm", belowDetection: false },
      { rowIndex: 0, sampleNumber: "MR-01", analyte: "Ag", value: 0.5, unit: "ppm", belowDetection: true },
      { rowIndex: 1, sampleNumber: "MR-02", analyte: "Ag", value: 3.1, unit: "ppm", belowDetection: false },
    ]);
    expect(result.problems).toEqual([
      { rowIndex: 2, sampleNumber: "MR-99", reason: "unknown_sample" },
    ]);
  });

  it("flags a row with a known sample but no analyte values at all", () => {
    const blankCsv = parseCsv("SampleNo,Au_ppm\nMR-01,\n");
    const result = previewAssayImport(
      blankCsv,
      { sampleColumnIndex: 0, analyteColumns: [{ columnIndex: 1, analyte: "Au", unit: null }] },
      new Set(["MR-01"]),
    );
    expect(result.rows).toEqual([]);
    expect(result.problems).toEqual([
      { rowIndex: 0, sampleNumber: "MR-01", reason: "missing_analyte" },
    ]);
  });

  it("skips a row with no sample number entirely", () => {
    const blankCsv = parseCsv("SampleNo,Au_ppm\n,1.2\n");
    const result = previewAssayImport(
      blankCsv,
      { sampleColumnIndex: 0, analyteColumns: [{ columnIndex: 1, analyte: "Au", unit: null }] },
      new Set(["MR-01"]),
    );
    expect(result.rows).toEqual([]);
    expect(result.problems).toEqual([]);
  });
});
