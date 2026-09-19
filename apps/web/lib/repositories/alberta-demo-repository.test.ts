import { describe, expect, it } from "vitest";
import { getAlbertaDemoDataset } from "@/lib/repositories/alberta-demo-repository";

describe("Alberta demonstration data adapter", () => {
  it("maps the curated public source into linked CoreChain records", async () => {
    const dataset = await getAlbertaDemoDataset();

    expect(dataset.integrity).toEqual({
      drillholeCount: 6,
      intervalCount: 27,
      assayCount: 313,
      orphanIntervalCount: 0,
      orphanAssayCount: 0,
    });
    expect(dataset.drillholes.map((drillhole) => drillhole.name)).toContain(
      "200110-128",
    );
    expect(
      dataset.intervals.every((interval) => interval.toM > interval.fromM),
    ).toBe(true);
  });

  it("turns documented missing-value markers into null while preserving raw provenance", async () => {
    const dataset = await getAlbertaDemoDataset();
    const drillhole = dataset.drillholes.find(
      (record) => record.name === "200110-128",
    );

    expect(drillhole?.location.groundElevationM).toBeNull();
    expect(drillhole?.reportedAzimuthDeg).toBeNull();
    expect(drillhole?.provenance.raw.Elvtn_grnd).toBe("-9999");
  });
});
