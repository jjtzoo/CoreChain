import { get, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { apiUser, badRequest, signInRequired } from "@/lib/api";
import { isUuid } from "@/lib/sync/coerce";
import {
  checkPhotoUpload,
  photoStorageKey,
  storageConfigured,
} from "@/lib/photos/storage";
import { prisma } from "@/lib/prisma";

// E5-3: a photo's image file. The phone sends it here after the photo's record
// has synced (PUT), and any signed-in device or the web app can fetch it back
// (GET). Only the account that owns the photo can do either. The file is kept in
// a private Vercel Blob store; nothing is reachable by link.
export const maxDuration = 60;

type Row = { project_id: string; storage_key: string | null };

// A team's shared workspace if the admin put this account on one (E11-1);
// otherwise a personal workspace, same as before teams existed (decision D9,
// matches how the phone's own device row resolves this in lib/devices.ts).
// A photo's own organization_id is stamped from the uploading device's
// resolved organizationId (lib/sync/upload.ts), never the account id itself,
// so looking a photo up by the raw account id silently found nothing for
// any account actually on a team.
async function effectiveOrganizationId(userId: string): Promise<string> {
  const self = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });
  return self?.organizationId ?? userId;
}

async function ownedPhoto(
  photoId: string,
  organizationId: string,
): Promise<Row | null> {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `SELECT project_id::text AS project_id, storage_key
     FROM photos
     WHERE id = $1::uuid AND organization_id = $2 AND deleted_at IS NULL`,
    photoId,
    organizationId,
  );
  return rows[0] ?? null;
}

const notConfigured = () =>
  NextResponse.json({ error: "storage-not-configured" }, { status: 503 });

export async function PUT(
  request: Request,
  context: { params: Promise<{ photoId: string }> },
) {
  const user = await apiUser(request);
  if (!user) return signInRequired();
  const { photoId } = await context.params;
  if (!isUuid(photoId)) return badRequest("invalid");
  if (!storageConfigured(process.env)) return notConfigured();
  const organizationId = await effectiveOrganizationId(user.id);

  const lengthHeader = request.headers.get("content-length");
  const check = checkPhotoUpload({
    contentType: request.headers.get("content-type"),
    contentLength: lengthHeader === null ? null : Number(lengthHeader),
  });
  if (!check.ok)
    return NextResponse.json(
      { error: check.error },
      { status: check.error === "too-large" ? 413 : 400 },
    );

  // The record must have synced first: a file with no record is refused, and the
  // phone simply tries again after its next sync.
  const photo = await ownedPhoto(photoId, organizationId);
  if (!photo)
    return NextResponse.json({ error: "photo-not-found" }, { status: 404 });

  const bytes = await request.arrayBuffer();
  // A cut-off upload must not be stored as if it were the photo.
  if (lengthHeader !== null && bytes.byteLength !== Number(lengthHeader))
    return badRequest("incomplete");
  const size = checkPhotoUpload({
    contentType: check.contentType,
    contentLength: bytes.byteLength,
  });
  if (!size.ok)
    return NextResponse.json(
      { error: size.error },
      { status: size.error === "too-large" ? 413 : 400 },
    );

  const key = photoStorageKey({
    organizationId,
    projectId: photo.project_id,
    photoId,
    extension: check.extension,
  });
  try {
    await put(key, Buffer.from(bytes), {
      access: "private",
      contentType: check.contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch {
    return NextResponse.json({ error: "storage-failed" }, { status: 502 });
  }

  await prisma.$executeRawUnsafe(
    `UPDATE photos SET storage_key = $3 WHERE id = $1::uuid AND organization_id = $2`,
    photoId,
    organizationId,
    key,
  );
  return NextResponse.json({ ok: true, storageKey: key });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ photoId: string }> },
) {
  const user = await apiUser(request);
  if (!user) return signInRequired();
  const { photoId } = await context.params;
  if (!isUuid(photoId)) return badRequest("invalid");
  if (!storageConfigured(process.env)) return notConfigured();

  const organizationId = await effectiveOrganizationId(user.id);
  const photo = await ownedPhoto(photoId, organizationId);
  if (!photo?.storage_key)
    return NextResponse.json({ error: "photo-not-found" }, { status: 404 });

  const result = await get(photo.storage_key, { access: "private" });
  if (result?.statusCode !== 200)
    return NextResponse.json({ error: "photo-not-found" }, { status: 404 });

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
