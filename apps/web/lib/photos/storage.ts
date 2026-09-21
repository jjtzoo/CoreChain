// E5-3, the server half of photo backup: the phone sends each photo's image file
// here after its record has synced, and the file is kept in a private Vercel
// Blob store. The rules for what is accepted and where it is kept live in this
// file, apart from the routes, so they can be tested without any storage.

/**
 * Vercel refuses a request body over 4.5 MB on a server route. Phone photos are
 * compressed to about 1.5 MB (a project setting), so this is a safety limit.
 */
export const MAX_PHOTO_BYTES = 4_000_000;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type UploadCheck =
  | { ok: true; contentType: string; extension: string }
  | { ok: false; error: "unsupported-type" | "empty" | "too-large" };

/** Is this something we will store? Looks only at the headers, before the body is read. */
export function checkPhotoUpload(input: {
  contentType: string | null;
  contentLength: number | null;
}): UploadCheck {
  const contentType = (input.contentType ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const extension = EXTENSIONS[contentType];
  if (!extension) return { ok: false, error: "unsupported-type" };
  if (input.contentLength !== null) {
    if (!(input.contentLength > 0)) return { ok: false, error: "empty" };
    if (input.contentLength > MAX_PHOTO_BYTES)
      return { ok: false, error: "too-large" };
  }
  return { ok: true, contentType, extension };
}

/**
 * Where a photo's file is kept. The same photo always maps to the same key, so
 * sending it again after a dropped connection replaces it instead of piling up
 * copies. The account comes first so one account's files are never mixed with
 * another's.
 */
export function photoStorageKey(input: {
  organizationId: string;
  projectId: string;
  photoId: string;
  extension: string;
}): string {
  return `photos/${input.organizationId}/${input.projectId}/${input.photoId}.${input.extension}`;
}

/** The storage is set up when Vercel has given this deployment access to the store. */
export function storageConfigured(
  env: Record<string, string | undefined>,
): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN || env.BLOB_STORE_ID);
}
