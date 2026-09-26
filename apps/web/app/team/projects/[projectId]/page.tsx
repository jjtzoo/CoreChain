import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectView, type ProjectViewSample } from "@/components/corechain/project-view/project-view";
import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/session";

// E18-1: one project, for the project manager, with its 3D evidence view
// (E18-2). Only projects in the manager's own team open; anything else is
// not found.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ hole?: string | string[] }>;
}) {
  const session = await requireProjectManager();
  const { projectId } = await params;
  const { hole } = await searchParams;
  if (!UUID.test(projectId)) notFound();

  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? null;
  if (!organizationId) notFound();

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true, name: true, commodity: true, location: true },
  });
  if (!project) notFound();

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
  const drilledM = holes.reduce((sum, h) => sum + (h.actualFinalDepthM ?? 0), 0);
  const selectedHole = typeof hole === "string" ? hole : null;

  return (
    <>
      <div className="admin-page-header">
        <div>
          <Link href="/team" className="admin-link">
            ← Team overview
          </Link>
          <h1>{project.name}</h1>
          <p>
            {[project.commodity, project.location].filter(Boolean).join(" · ")}
            {project.commodity || project.location ? " · " : ""}
            {holes.length} {holes.length === 1 ? "hole" : "holes"}
            {drilledM > 0 ? `, ${Math.round(drilledM).toLocaleString("en-US")} m drilled` : ""}
          </p>
        </div>
      </div>

      <div className="kpi-strip">
        <div className="kpi-card">
          <span className="kpi-label">Holes</span>
          <span className="kpi-value" style={{ display: "block" }}>
            {holes.length}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Sampled intervals</span>
          <span className="kpi-value" style={{ display: "block" }}>
            {primary.length}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">With laboratory results</span>
          <span className="kpi-value" style={{ display: "block" }}>
            {primaryWithResults}
            {primary.length > 0 ? (
              <em> {Math.round((100 * primaryWithResults) / primary.length)}%</em>
            ) : null}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">At the laboratory</span>
          <span className="kpi-value" style={{ display: "block" }}>
            {atLaboratory}
          </span>
        </div>
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
