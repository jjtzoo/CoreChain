import { NextResponse } from "next/server";
import { apiUser, badRequest, signInRequired } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isUuid } from "@/lib/sync/coerce";
import { renderTerrain, terrainBounds } from "@/lib/terrain/render";

// E15-2 (terrain): the shaded-relief overlay for a project's collar map. The
// phone downloads it once and keeps it, so the map has terrain offline. Only
// someone in the project's workspace can fetch it. The image's edges, in
// degrees, come back in the X-Terrain-Bounds header.
export const maxDuration = 60;

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const user = await apiUser(request);
  if (!user) return signInRequired();
  const { projectId } = await context.params;
  if (!isUuid(projectId)) return badRequest("invalid");

  const self = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? user.id;
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId, deletedAt: null },
    select: { id: true },
  });
  if (!project) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const holes = await prisma.drillhole.findMany({
    where: {
      projectId,
      deletedAt: null,
      collarLatitude: { not: null },
      collarLongitude: { not: null },
    },
    select: {
      collarLatitude: true,
      collarLongitude: true,
      plannedAzimuthDeg: true,
      plannedInclinationDeg: true,
      plannedDepthM: true,
      actualFinalDepthM: true,
    },
  });
  const bounds = terrainBounds(
    holes.map((h) => ({
      latitude: h.collarLatitude!,
      longitude: h.collarLongitude!,
      azimuthDeg: h.plannedAzimuthDeg,
      inclinationDeg: h.plannedInclinationDeg,
      depthM: h.actualFinalDepthM ?? h.plannedDepthM,
    })),
  );
  if (!bounds) return NextResponse.json({ error: "no-collars" }, { status: 404 });

  const terrain = await renderTerrain(bounds);
  if (!terrain) return NextResponse.json({ error: "no-elevation-data" }, { status: 404 });

  return new NextResponse(new Uint8Array(terrain.png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=86400",
      "X-Terrain-Bounds": JSON.stringify(bounds),
      "X-Terrain-Source": "Copernicus DEM GLO-30",
    },
  });
}
