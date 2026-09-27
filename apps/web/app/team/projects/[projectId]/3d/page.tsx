import { notFound } from "next/navigation";
import { Kpi } from "@/components/manager/parts";
import { ProjectView, type ProjectViewSample } from "@/components/corechain/project-view/project-view";
import { managedProject } from "@/lib/manager/data";
import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/session";

// E18-2: the project's 3D evidence view, one tab of the project page. The 3D
// library loads only here (ProjectView imports it dynamically).

export default async function Project3dPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ hole?: string | string[] }>;
}) {
  const session = await requireProjectManager();
  const { projectId } = await params;
  const { hole } = await searchParams;
  const project = await managedProject(session.user.id, projectId);
  if (!project) notFound();
  const { organizationId } = project;

  const [holes, samples, results] = await Promise.all([
    prisma.drillhole.findMany({
      where: { projectId, organizationId, deletedAt: null },
      select: {
        id: true,
        holeId: true,
        status: true,
        collarLatitude: true,
        collarLongitude: true,
        plannedAzimuthDeg: true,
        plannedInclinationDeg: true,
        plannedDepthM: true,
        actualFinalDepthM: true,
      },
    }),
    prisma.sample.findMany({
      where: { projectId, organizationId, deletedAt: null, drillhole: { deletedAt: null } },
      select: {
        id: true,
        drillholeId: true,
        sampleNumber: true,
        sampleType: true,
        fromM: true,
        toM: true,
        status: true,
      },
    }),
    prisma.assayResult.findMany({
      where: { organizationId, sample: { projectId, deletedAt: null } },
      select: {
        sampleId: true,
        analyte: true,
        value: true,
        unit: true,
        belowDetection: true,
        createdAt: true,
      },
    }),
  ]);

  const viewSamples: ProjectViewSample[] = samples.map((s) => ({ ...s }));
  const withResults = new Set(results.map((r) => r.sampleId));
  const primary = samples.filter((s) => s.sampleType === "primary");
  const primaryWithResults = primary.filter((s) => withResults.has(s.id)).length;
  const atLaboratory = primary.filter((s) => !withResults.has(s.id) && s.status === "dispatched").length;
  const selectedHole = typeof hole === "string" ? hole : null;

  return (
    <>
      <div className="mg-kpis">
        <Kpi label="Holes" value={holes.length} />
        <Kpi label="Sampled intervals" value={primary.length} />
        <Kpi
          label="With laboratory results"
          value={primaryWithResults}
          unit={primary.length > 0 ? `${Math.round((100 * primaryWithResults) / primary.length)}%` : undefined}
        />
        <Kpi label="At the laboratory" value={atLaboratory} />
      </div>

      <ProjectView
        holes={holes.map((h) => ({
          id: h.id,
          holeId: h.holeId,
          collar:
            h.collarLatitude != null && h.collarLongitude != null
              ? { latitude: h.collarLatitude, longitude: h.collarLongitude }
              : null,
          azimuthDeg: h.plannedAzimuthDeg,
          inclinationDeg: h.plannedInclinationDeg,
          plannedDepthM: h.plannedDepthM,
          finalDepthM: h.actualFinalDepthM,
          data: { status: h.status },
        }))}
        samples={viewSamples}
        results={results.map((r) => ({
          sampleId: r.sampleId,
          analyte: r.analyte,
          value: r.value,
          unit: r.unit,
          belowDetection: r.belowDetection,
          enteredAt: r.createdAt.toISOString(),
        }))}
        initialHoleId={selectedHole}
      />
    </>
  );
}
