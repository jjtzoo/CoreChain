import "server-only";

import {
  coreLoggingExceptions,
  deviceStaleExceptions,
  laboratoryAssayExceptions,
  samplingCustodyExceptions,
  type QaqcException,
  type QaqcStage,
} from "@corechain/domain";
import { prisma } from "@/lib/prisma";

// The QA/QC exceptions for one stage, computed from the team's current data.
// Used by the QA/QC screen to show the queue, and by its actions to keep a
// copy of the evidence a reviewer's resolution or decision was made on.

// A device that has gone quiet this long is worth a reviewer's attention.
// Generous on purpose: weeks offline are normal for this app (CLAUDE.md).
export const DEVICE_STALE_AFTER_DAYS = 21;
// A sample sitting uncustodied this long is worth a reviewer's attention.
export const SAMPLE_STALE_AFTER_DAYS = 14;

export async function loadStageHoles(organizationId: string) {
  return prisma.drillhole.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      project: {
        select: {
          name: true,
          qcStandardEveryN: true,
          qcBlankEveryN: true,
          qcDuplicateEveryN: true,
        },
      },
      runs: {
        where: { deletedAt: null },
        select: { fromM: true, toM: true, recoveredM: true },
      },
      samples: {
        where: { deletedAt: null },
        select: {
          id: true,
          sampleNumber: true,
          sampleType: true,
          status: true,
          standardRef: true,
          parentSampleId: true,
          fromM: true,
          toM: true,
          createdAt: true,
        },
      },
    },
  });
}

export type StageHole = Awaited<ReturnType<typeof loadStageHoles>>[number];

/** Every exception for the stage, resolved or not, for the given holes. */
export async function computeStageExceptions(
  organizationId: string,
  stage: QaqcStage,
  holes: readonly StageHole[],
  now: Date,
): Promise<QaqcException[]> {
  if (stage === "core_logging") {
    return coreLoggingExceptions(
      holes.map((h) => ({
        drillholeId: h.id,
        holeId: h.holeId,
        runs: h.runs,
        actualFinalDepthM: h.actualFinalDepthM,
      })),
    );
  }
  if (stage === "sampling_custody") {
    return samplingCustodyExceptions(
      holes.map((h) => ({
        drillholeId: h.id,
        holeId: h.holeId,
        samples: h.samples.map((s) => ({
          id: s.id,
          sampleNumber: s.sampleNumber,
          type: s.sampleType,
          status: s.status,
          createdAt: s.createdAt.toISOString(),
          fromM: s.fromM,
          toM: s.toM,
        })),
        qcRates: {
          standardEveryN: h.project.qcStandardEveryN,
          blankEveryN: h.project.qcBlankEveryN,
          duplicateEveryN: h.project.qcDuplicateEveryN,
        },
      })),
      { now, staleAfterDays: SAMPLE_STALE_AFTER_DAYS },
    );
  }

  // E12-4: the laboratory stage also needs the results, the dispatches they
  // came back in, and the team's current standards-and-blanks lines.
  const [assayResults, dispatches, references] = await Promise.all([
    prisma.assayResult.findMany({ where: { organizationId } }),
    prisma.dispatch.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        dispatchNumber: true,
        resultsReturnedAt: true,
        samples: { where: { deletedAt: null }, select: { sampleId: true } },
      },
    }),
    prisma.qcReferenceValue.findMany({
      where: { organizationId, retiredAt: null },
    }),
  ]);
  return laboratoryAssayExceptions({
    samples: holes.flatMap((h) =>
      h.samples.map((s) => ({
        id: s.id,
        sampleNumber: s.sampleNumber,
        type: s.sampleType,
        standardRef: s.standardRef,
        parentSampleId: s.parentSampleId,
        drillholeId: h.id,
        holeId: h.holeId,
      })),
    ),
    results: assayResults.map((r) => ({
      sampleId: r.sampleId,
      dispatchId: r.dispatchId,
      analyte: r.analyte,
      value: r.value,
      unit: r.unit,
      belowDetection: r.belowDetection,
      enteredAt: r.createdAt.toISOString(),
    })),
    batches: dispatches.map((d) => ({
      dispatchId: d.id,
      dispatchNumber: d.dispatchNumber,
      resultsReturned: d.resultsReturnedAt !== null,
      sampleIds: d.samples.map((ds) => ds.sampleId),
    })),
    references,
  });
}

/** Devices that have gone quiet, for every stage. */
export async function computeDeviceExceptions(
  organizationId: string,
  now: Date,
): Promise<QaqcException[]> {
  const devices = await prisma.device.findMany({
    where: { organizationId, revokedAt: null },
    select: { id: true, name: true, lastSeenAt: true },
  });
  return deviceStaleExceptions(
    devices.map((d) => ({
      deviceId: d.id,
      name: d.name,
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    })),
    { now, staleAfterDays: DEVICE_STALE_AFTER_DAYS },
  );
}
