import { describe, expect, it } from "vitest";
import { buildAssayQaqcDemo } from "@/lib/demo/assay-qaqc-fixture";
import { buildTraceabilityDemo } from "@/lib/demo/traceability-fixture";
import { getAlbertaDemoDataset } from "@/lib/repositories/alberta-demo-repository";

describe("assay matching and QA/QC demonstration", () => {
  it("matches every public source assay record for the traced sample", async () => {
    const dataset = await getAlbertaDemoDataset();
    const demo = buildAssayQaqcDemo(dataset, buildTraceabilityDemo(dataset));

    expect(demo.assayMatches).toHaveLength(9);
    expect(
      demo.assayMatches.every((match) => match.origin === "Public source data"),
    ).toBe(true);
    expect(
      demo.assayMatches.every(
        (match) => match.corechainSampleId === "CC-DEMO-5739",
      ),
    ).toBe(true);
    expect(demo.assayMatches.flatMap((match) => match.reportedValues)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          analyte: "Cu",
          reportedValue: "19",
          unit: "ppm",
        }),
        expect.objectContaining({
          analyte: "Fe",
          reportedValue: "9.27",
          unit: "pct",
        }),
      ]),
    );
  });

  it("keeps QA/QC examples separate and clearly synthetic", async () => {
    const dataset = await getAlbertaDemoDataset();
    const demo = buildAssayQaqcDemo(dataset, buildTraceabilityDemo(dataset));

    expect(demo.controls).toHaveLength(3);
    expect(
      demo.controls.every(
        (control) => control.origin === "Synthetic demonstration data",
      ),
    ).toBe(true);
    expect(demo.review.origin).toBe("Synthetic demonstration data");
    expect(demo.review.status).toBe("Review required");
  });
});
