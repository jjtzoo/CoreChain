import { describe, expect, it } from "vitest";
import {
  laboratoryAssayExceptions,
  validateQcReferenceValue,
  type LabQcResult,
  type LabQcSample,
  type QcReferenceValue,
} from "./labQc";

const hole = { drillholeId: "h1", holeId: "AB-001" };
const sample = (
  id: string,
  sampleNumber: string,
  type: LabQcSample["type"],
  extra: Partial<LabQcSample> = {},
): LabQcSample => ({
  id,
  sampleNumber,
  type,
  standardRef: null,
  parentSampleId: null,
  ...hole,
  ...extra,
});
const result = (
  sampleId: string,
  value: number | null,
  extra: Partial<LabQcResult> = {},
): LabQcResult => ({
  sampleId,
  dispatchId: "d1",
  analyte: "Cu",
  value,
  unit: "ppm",
  belowDetection: false,
  enteredAt: "2026-09-24T00:00:00Z",
  ...extra,
});
const oreas: QcReferenceValue = {
  kind: "standard",
  reference: "OREAS 45e",
  analyte: "Cu",
  unit: "ppm",
  expectedValue: 742,
  standardDeviation: 20,
  maxValue: null,
};
const blankLimit: QcReferenceValue = {
  kind: "blank",
  reference: "Blank",
  analyte: "Cu",
  unit: "ppm",
  expectedValue: null,
  standardDeviation: null,
  maxValue: 10,
};
const std = (id: string, n: string) =>
  sample(id, n, "standard", { standardRef: "oreas 45E" });

const kinds = (input: Parameters<typeof laboratoryAssayExceptions>[0]) =>
  laboratoryAssayExceptions(input).map((e) => e.kind);

describe("laboratoryAssayExceptions", () => {
  it("passes a standard within 2 SD, warns between 2 and 3, fails beyond 3", () => {
    const base = { batches: [], references: [oreas] };
    expect(kinds({ ...base, samples: [std("s", "5")], results: [result("s", 780)] })).toEqual([]);
    expect(kinds({ ...base, samples: [std("s", "5")], results: [result("s", 790)] })).toEqual(["standard_warning"]);
    const failed = laboratoryAssayExceptions({ ...base, samples: [std("s", "5")], results: [result("s", 910)] });
    expect(failed.map((e) => e.kind)).toEqual(["standard_failed"]);
    expect(failed[0]!.evidence).toContain("+8.4 SD");
    expect(failed[0]!.holeId).toBe("AB-001");
  });

  it("fails the second of two readings beyond 2 SD on the same side in a batch", () => {
    const samples = [std("a", "10"), std("b", "30")];
    const high = kinds({ samples, batches: [], references: [oreas], results: [result("a", 790), result("b", 795)] });
    expect(high).toEqual(["standard_warning", "standard_failed"]);
    const opposite = kinds({ samples, batches: [], references: [oreas], results: [result("a", 790), result("b", 694)] });
    expect(opposite).toEqual(["standard_warning", "standard_warning"]);
    const otherBatch = kinds({
      samples,
      batches: [],
      references: [oreas],
      results: [result("a", 790), result("b", 795, { dispatchId: "d2" })],
    });
    expect(otherBatch).toEqual(["standard_warning", "standard_warning"]);
  });

  it("fails a standard reported below detection, and uses the latest entry", () => {
    const samples = [std("s", "5")];
    expect(kinds({ samples, batches: [], references: [oreas], results: [result("s", null, { belowDetection: true })] })).toEqual(["standard_failed"]);
    const corrected = kinds({
      samples,
      batches: [],
      references: [oreas],
      results: [result("s", 910), result("s", 745, { enteredAt: "2026-09-25T00:00:00Z" })],
    });
    expect(corrected).toEqual([]);
  });

  it("says when a standard or blank has no certified value or limit", () => {
    const out = laboratoryAssayExceptions({
      samples: [std("s", "5"), sample("n", "6", "standard"), sample("b", "7", "blank")],
      batches: [],
      references: [],
      results: [result("s", 742), result("n", 742), result("b", 1)],
    });
    expect(out.map((e) => e.kind)).toEqual([
      "qc_reference_missing",
      "qc_reference_missing",
      "qc_reference_missing",
    ]);
    expect(out[1]!.summary).toContain("has no name");
  });

  it("fails a blank above its limit, and passes one below detection", () => {
    const samples = [sample("b", "7", "blank")];
    const base = { samples, batches: [], references: [blankLimit] };
    expect(kinds({ ...base, results: [result("b", 48)] })).toEqual(["blank_failed"]);
    expect(kinds({ ...base, results: [result("b", 8)] })).toEqual([]);
    expect(kinds({ ...base, results: [result("b", null, { belowDetection: true })] })).toEqual([]);
  });

  it("fails a field duplicate more than 30% from its original, skipping values below detection", () => {
    const samples = [sample("o", "8", "primary"), sample("d", "9", "duplicate", { parentSampleId: "o" })];
    const base = { samples, batches: [], references: [] };
    expect(kinds({ ...base, results: [result("o", 1200), result("d", 1650)] })).toEqual(["duplicate_failed"]);
    expect(kinds({ ...base, results: [result("o", 1200), result("d", 1300)] })).toEqual([]);
    expect(kinds({ ...base, results: [result("o", 2), result("d", null, { belowDetection: true })] })).toEqual([]);
  });

  it("flags a sample with no result only once the batch is marked complete", () => {
    const samples = [sample("o", "8", "primary")];
    const batch = { dispatchId: "d1", dispatchNumber: "DSP-001", sampleIds: ["o"] };
    expect(kinds({ samples, results: [], references: [], batches: [{ ...batch, resultsReturned: false }] })).toEqual([]);
    const missing = laboratoryAssayExceptions({ samples, results: [], references: [], batches: [{ ...batch, resultsReturned: true }] });
    expect(missing.map((e) => e.summary)).toEqual(["No result for 8 in DSP-001"]);
  });
});

describe("validateQcReferenceValue", () => {
  it("needs a certified value and SD for a standard, and a limit for a blank", () => {
    expect(validateQcReferenceValue(oreas)).toBeNull();
    expect(validateQcReferenceValue(blankLimit)).toBeNull();
    expect(validateQcReferenceValue({ ...oreas, standardDeviation: 0 })).toMatch(/standard deviation/);
    expect(validateQcReferenceValue({ ...oreas, reference: " " })).toMatch(/name/);
    expect(validateQcReferenceValue({ ...blankLimit, maxValue: null })).toMatch(/limit/);
    expect(validateQcReferenceValue({ ...oreas, analyte: "" })).toMatch(/element/);
  });
});
