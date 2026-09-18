import { describe, expect, it } from "vitest";
import { buildTraceabilityDemo } from "@/lib/demo/traceability-fixture";
import { getAlbertaDemoDataset } from "@/lib/repositories/alberta-demo-repository";

describe("synthetic traceability demonstration", () => {
  it("links synthetic workflow records to a real source interval and assay sample", async () => {
    const demo = buildTraceabilityDemo(await getAlbertaDemoDataset());

    expect(demo.sample.origin).toBe("Synthetic demonstration data");
    expect(demo.coreBox.origin).toBe("Synthetic demonstration data");
    expect(demo.dispatch.origin).toBe("Synthetic demonstration data");
    expect(demo.sourceInterval.provenance.sourceId).toBe("6183");
    expect(demo.sourceAssayRecordCount).toBe(9);
    expect(demo.coreBox.fromM).toBeLessThanOrEqual(demo.sample.fromM);
    expect(demo.coreBox.toM).toBeGreaterThanOrEqual(demo.sample.toM);
  });

  it("keeps custody events chronological and append-only in the fixture", async () => {
    const demo = buildTraceabilityDemo(await getAlbertaDemoDataset());
    const eventTimes = demo.custodyEvents.map((event) => event.occurredAt);

    expect(eventTimes).toEqual([...eventTimes].sort());
    expect(new Set(demo.custodyEvents.map((event) => event.id)).size).toBe(
      demo.custodyEvents.length,
    );
  });
});
