import { describe, expect, it } from "vitest";

import {
  checkPhotoUpload,
  MAX_PHOTO_BYTES,
  photoStorageKey,
  storageConfigured,
} from "./storage";

describe("checkPhotoUpload", () => {
  it("accepts a jpeg, png or webp and names the extension", () => {
    expect(
      checkPhotoUpload({ contentType: "image/jpeg", contentLength: 1_500_000 }),
    ).toEqual({ ok: true, contentType: "image/jpeg", extension: "jpg" });
    expect(
      checkPhotoUpload({ contentType: "image/png", contentLength: 10 }),
    ).toMatchObject({ ok: true, extension: "png" });
    expect(
      checkPhotoUpload({ contentType: "image/webp", contentLength: 10 }),
    ).toMatchObject({ ok: true, extension: "webp" });
  });

  it("ignores case and parameters in the content type", () => {
    expect(
      checkPhotoUpload({
        contentType: "Image/JPEG; charset=binary",
        contentLength: 5,
      }),
    ).toMatchObject({ ok: true, extension: "jpg" });
  });

  it("refuses anything that is not an image", () => {
    for (const contentType of [
      "text/html",
      "application/pdf",
      "image/svg+xml",
      "",
      null,
    ]) {
      expect(checkPhotoUpload({ contentType, contentLength: 100 })).toEqual({
        ok: false,
        error: "unsupported-type",
      });
    }
  });

  it("refuses an empty or oversized file", () => {
    expect(
      checkPhotoUpload({ contentType: "image/jpeg", contentLength: 0 }),
    ).toEqual({ ok: false, error: "empty" });
    expect(
      checkPhotoUpload({
        contentType: "image/jpeg",
        contentLength: MAX_PHOTO_BYTES + 1,
      }),
    ).toEqual({ ok: false, error: "too-large" });
    expect(
      checkPhotoUpload({
        contentType: "image/jpeg",
        contentLength: MAX_PHOTO_BYTES,
      }),
    ).toMatchObject({ ok: true });
  });

  it("checks the type alone when the size is not known yet", () => {
    expect(
      checkPhotoUpload({ contentType: "image/jpeg", contentLength: null }),
    ).toMatchObject({ ok: true });
  });
});

describe("photoStorageKey", () => {
  const input = {
    organizationId: "org-1",
    projectId: "proj-1",
    photoId: "photo-1",
    extension: "jpg",
  };

  it("puts the account first and is the same every time for one photo", () => {
    expect(photoStorageKey(input)).toBe("photos/org-1/proj-1/photo-1.jpg");
    expect(photoStorageKey(input)).toBe(photoStorageKey({ ...input }));
  });

  it("gives different photos and different accounts different keys", () => {
    expect(photoStorageKey({ ...input, photoId: "photo-2" })).not.toBe(
      photoStorageKey(input),
    );
    expect(photoStorageKey({ ...input, organizationId: "org-2" })).not.toBe(
      photoStorageKey(input),
    );
  });
});

describe("storageConfigured", () => {
  it("is on only when Vercel has connected the store", () => {
    expect(storageConfigured({})).toBe(false);
    expect(storageConfigured({ BLOB_READ_WRITE_TOKEN: "" })).toBe(false);
    expect(storageConfigured({ BLOB_READ_WRITE_TOKEN: "x" })).toBe(true);
    expect(storageConfigured({ BLOB_STORE_ID: "store_1" })).toBe(true);
  });
});
