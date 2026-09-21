// E10-2, the server half of the optional feedback screenshot: the phone offers
// it here once, after the feedback message itself has synced, and it is kept
// in the same private Vercel Blob store as photo files. Rules for what is
// accepted and where it is kept live here, apart from the route, so they can
// be tested without any storage.

export { storageConfigured } from "@/lib/photos/storage";

/** A phone screenshot is a PNG; well under Vercel's 4.5 MB request-body limit. */
export const MAX_SCREENSHOT_BYTES = 2_000_000;

export type UploadCheck =
  | { ok: true; contentType: string }
  | { ok: false; error: "unsupported-type" | "empty" | "too-large" };

/** Is this something we will store? Looks only at the headers, before the body is read. */
export function checkScreenshotUpload(input: {
  contentType: string | null;
  contentLength: number | null;
}): UploadCheck {
  const contentType = (input.contentType ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== "image/png") return { ok: false, error: "unsupported-type" };
  if (input.contentLength !== null) {
    if (!(input.contentLength > 0)) return { ok: false, error: "empty" };
    if (input.contentLength > MAX_SCREENSHOT_BYTES)
      return { ok: false, error: "too-large" };
  }
  return { ok: true, contentType };
}

/**
 * Where a feedback screenshot is kept. The same message always maps to the
 * same key, so an upload retried after a dropped connection replaces it
 * instead of piling up copies.
 */
export function feedbackScreenshotKey(input: {
  userId: string;
  feedbackId: string;
}): string {
  return `feedback/${input.userId}/${input.feedbackId}.png`;
}
