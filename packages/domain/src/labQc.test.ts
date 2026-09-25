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

  it("orders a batch by sample number as the dispatch sheet does, numbers as numbers", () => {
    // S-2 comes before S-10: two high readings in a row fail the second one.
    const samples = [std("a", "S-10"), std("b", "S-2")];
    const out = laboratoryAssayExceptions({
      samples,
      batches: [],
      references: [oreas],
      results: [result("b", 790), result("a", 795)],
    });
    expect(out.map((e) => [e.kind, e.summary.split(": ")[1]])).toEqual([
      ["standard_warning", "S-2"],
      ["standard_failed", "S-10"],
    ]);
    // Readings from separate dispatches are never consecutive.
    expect(
      kinds({
        samples,
        batches: [],
        references: [oreas],
        results: [result("b", 790), result("a", 795, { dispatchId: "d2" })],
      }),
    ).toEqual(["standard_warning", "standard_warning"]);
  });

  it("keeps a corrected result in the same place in the batch", () => {
    const samples = [std("a", "S-1"), std("b", "S-2")];
    const out = kinds({
      samples,
      batches: [],
      references: [oreas],
      results: [
        result("a", 790),
        result("b", 700),
        result("b", 795, { enteredAt: "2026-09-25T00:00:00Z" }),
      ],
    });
    expect(out).toEqual(["standard_warning", "standard_failed"]);
  });

  it("checks results only against a certified value or limit in the same unit", () => {
    const base = { batches: [], references: [oreas, blankLimit] };
    // Same unit, any case or spacing: checked as usual.
    expect(kinds({ ...base, samples: [std("s", "5")], results: [result("s", 742, { unit: " PPM " })] })).toEqual([]);
    // 0.0742 % is 742 ppm, but nothing is converted: raised, not scored.
    const percent = laboratoryAssayExceptions({
      ...base,
      samples: [std("s", "5")],
      results: [result("s", 0.0742, { unit: "%" })],
    });
    expect(percent.map((e) => e.kind)).toEqual(["unit_mismatch"]);
    expect(percent[0]!.evidence).toContain("0.0742 (%)");
    expect(percent[0]!.evidence).toContain("742 (ppm)");
    // A missing unit never passes silently.
    expect(kinds({ ...base, samples: [std("s", "5")], results: [result("s", 742, { unit: null })] })).toEqual(["unit_mismatch"]);
    expect(kinds({ ...base, samples: [std("s", "5")], results: [result("s", 742, { unit: "  " })] })).toEqual(["unit_mismatch"]);
    // A line with no unit can't vouch for a result either.
    expect(
      kinds({ batches: [], references: [{ ...oreas, unit: null }], samples: [std("s", "5")], results: [result("s", 742)] }),
    ).toEqual(["unit_mismatch"]);
    // Blanks and duplicates follow the same rule.
    expect(kinds({ ...base, samples: [sample("b", "7", "blank")], results: [result("b", 0.002, { unit: "%" })] })).toEqual(["unit_mismatch"]);
    const pair = [sample("o", "8", "primary"), sample("d", "9", "duplicate", { parentSampleId: "o" })];
    expect(kinds({ ...base, samples: pair, results: [result("o", 1200), result("d", 0.12, { unit: "%" })] })).toEqual(["unit_mismatch"]);
    expect(kinds({ ...base, samples: pair, results: [result("o", 1200, { unit: "PPM" }), result("d", 1250)] })).toEqual([]);
  });

  it("uses only a named blank's own limit, and never guesses between blank materials", () => {
    const quartz: QcReferenceValue = { ...blankLimit, reference: "Quartz blank", maxValue: 50 };
    const named = sample("b", "7", "blank", { standardRef: "Quartz blank" });
    // A named material uses its own limit (50), not the other blank's (10).
    expect(kinds({ samples: [named], batches: [], references: [blankLimit, quartz], results: [result("b", 30)] })).toEqual([]);
    // A named material with no line of its own is raised, not checked against another.
    const unknown = laboratoryAssayExceptions({
      samples: [sample("b", "7", "blank", { standardRef: "Basalt blank" })],
      batches: [],
      references: [blankLimit],
      results: [result("b", 30)],
    });
    expect(unknown.map((e) => e.kind)).toEqual(["qc_reference_missing"]);
    expect(unknown[0]!.summary).toBe("No Basalt blank limit for Cu");
    // No material named: the only limit for the element applies...
    expect(kinds({ samples: [sample("b", "7", "blank")], batches: [], references: [blankLimit], results: [result("b", 30)] })).toEqual(["blank_failed"]);
    // ...but with several, the choice is ambiguous and raised.
    const ambiguous = laboratoryAssayExceptions({
      samples: [sample("b", "7", "blank")],
      batches: [],
      references: [blankLimit, quartz],
      results: [result("b", 30)],
    });
    expect(ambiguous.map((e) => e.kind)).toEqual(["qc_reference_missing"]);
    expect(ambiguous[0]!.evidence).toContain("Cu has limits for Blank and Quartz blank");
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
    expect(validateQcReferenceValue({ ...oreas, unit: " " })).toMatch(/unit/);
    expect(validateQcReferenceValue({ ...oreas, expectedValue: Number.NaN })).toMatch(/certified value/);
    expect(validateQcReferenceValue({ ...blankLimit, maxValue: Number.POSITIVE_INFINITY })).toMatch(/limit/);
  });
});
