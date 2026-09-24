import {
  laboratoryAssayExceptions,
  validateQcReferenceValue,
  type LabQcSample,
  type QcReferenceValue,
} from "@corechain/domain";
import { describe, expect, it } from "vitest";
import { DEMO_QC_REFERENCES, DEMO_STANDARD_GRADE } from "./demoProjects";

// E12-4: the demo's standards-and-blanks lines, and the one failed standard
// the laboratory QA/QC reviewer is meant to find in DSP-001.

const references: QcReferenceValue[] = DEMO_QC_REFERENCES.map((line) => ({
  kind: line.kind,
  reference: line.reference,
  analyte: line.analyte,
  unit: "ppm",
  expectedValue: line.expected,
  standardDeviation: line.sd,
  maxValue: line.max,
}));

const sample = (id: string, type: LabQcSample["type"], extra: Partial<LabQcSample> = {}): LabQcSample => ({
  id,
  sampleNumber: id,
  type,
  standardRef: null,
  parentSampleId: null,
  drillholeId: "h1",
  holeId: "200110-133",
  ...extra,
});

const result = (sampleId: string, analyte: string, value: number | null) => ({
  sampleId,
  dispatchId: "dsp-001",
  analyte,
  value,
  unit: "ppm",
  belowDetection: value === null,
  enteredAt: "2026-09-24T00:00:00Z",
});

describe("demo standards and blanks", () => {
  it("are all valid lines", () => {
    for (const line of references) expect(validateQcReferenceValue(line)).toBeNull();
  });

  it("fail the demo standard for copper only; the blank and duplicate pass", () => {
    const exceptions = laboratoryAssayExceptions({
      samples: [
        sample("P1", "primary"),
        sample("B1", "blank"),
        sample("S1", "standard", { standardRef: "OREAS 45e" }),
        sample("D1", "duplicate", { parentSampleId: "P1" }),
      ],
      results: [
        result("P1", "Cu", 400),
        result("P1", "Zn", 90),
        result("B1", "Cu", null),
        result("B1", "Zn", null),
        result("S1", "Cu", DEMO_STANDARD_GRADE.cu),
        result("S1", "Zn", DEMO_STANDARD_GRADE.zn),
        result("D1", "Cu", 416),
        result("D1", "Zn", 87),
      ],
      batches: [
        { dispatchId: "dsp-001", dispatchNumber: "DSP-001", resultsReturned: true, sampleIds: ["P1", "B1", "S1", "D1"] },
      ],
      references,
    });
    expect(exceptions.map((e) => [e.kind, e.summary])).toEqual([
      ["standard_failed", "Standard OREAS 45e failed for Cu: S1"],
    ]);
  });
});
