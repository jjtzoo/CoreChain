import type { AlbertaDemoDataset, Drillhole } from "@/lib/domain/corechain";

export type DrillholeRegisterRow = Drillhole & {
  intervalCount: number;
  assayCount: number;
  knownFieldCount: number;
  trackedFieldCount: number;
  completenessLabel: "Source fields complete" | "Source fields incomplete";
};

const trackedDrillholeFields = (drillhole: Drillhole) => [
  drillhole.drillType,
  drillhole.drillDate,
  drillhole.finalDepthM,
  drillhole.reportedAzimuthDeg,
  drillhole.reportedInclinationDeg,
  drillhole.location.longitude,
  drillhole.location.latitude,
  drillhole.location.easting,
  drillhole.location.northing,
  drillhole.location.groundElevationM,
  drillhole.contractor,
  drillhole.diameter,
];

export function buildDrillholeRegister(
  dataset: AlbertaDemoDataset,
): DrillholeRegisterRow[] {
  return dataset.drillholes
    .map((drillhole) => {
      const fields = trackedDrillholeFields(drillhole);
      const knownFieldCount = fields.filter((value) => value !== null).length;
      const completenessLabel: DrillholeRegisterRow["completenessLabel"] =
        knownFieldCount === fields.length
          ? "Source fields complete"
          : "Source fields incomplete";

      return {
        ...drillhole,
        intervalCount: dataset.intervals.filter(
          (interval) => interval.drillholeName === drillhole.name,
        ).length,
        assayCount: dataset.assays.filter(
          (assay) => assay.drillholeName === drillhole.name,
        ).length,
        knownFieldCount,
        trackedFieldCount: fields.length,
        completenessLabel,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}
