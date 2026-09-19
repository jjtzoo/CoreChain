// Domain types and pure rules for core photos
// (docs/product/corechain-mobile-mvp-scrum-plan.md, Sprint 3: E5-1, E5-2).
//
// A photo carries its hole ID, box number, depth range and timestamp on its
// own record, so it can't get separated from its depth even if the box or
// interval it was taken against is later edited or deleted.

import type { SyncableRecord } from "./field";

export const PHOTO_SUBJECT_TYPES = ["box", "interval"] as const;
export type PhotoSubjectType = (typeof PHOTO_SUBJECT_TYPES)[number];

export type FieldPhoto = SyncableRecord & {
  drillholeId: string;
  subjectType: PhotoSubjectType;
  /** The core box or log interval this photo was taken against. */
  subjectId: string;
  holeId: string;
  /** Set for a box photo. */
  boxNumber: number | null;
  fromM: number;
  toM: number;
  /** File name inside the app's photo folder. */
  fileName: string;
  widthPx: number;
  heightPx: number;
  sizeBytes: number;
  capturedAt: string;
  note: string | null;
};

/** Default largest photo size, in megabytes (the plan's "~1-2 MB"). */
export const DEFAULT_PHOTO_MAX_MB = 1.5;
export const MIN_PHOTO_MAX_MB = 0.2;
export const MAX_PHOTO_MAX_MB = 10;

/** Whether a "largest photo size" setting is in the allowed range. */
export function isValidPhotoMaxMb(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= MIN_PHOTO_MAX_MB &&
    value <= MAX_PHOTO_MAX_MB
  );
}

export function photoMaxBytes(maxMb: number): number {
  return Math.round(maxMb * 1024 * 1024);
}

export type CompressionStep = { maxEdgePx: number; quality: number };

/**
 * The ladder the app walks down until a photo fits under the size limit: the
 * first step that produces a small enough file wins, and the last is used
 * regardless, so a photo is always saved. Each step is smaller than the one
 * before, so the ladder can only shrink a photo.
 */
export const COMPRESSION_STEPS: readonly CompressionStep[] = [
  { maxEdgePx: 2560, quality: 0.8 },
  { maxEdgePx: 2560, quality: 0.65 },
  { maxEdgePx: 2048, quality: 0.6 },
  { maxEdgePx: 1600, quality: 0.5 },
  { maxEdgePx: 1280, quality: 0.45 },
  { maxEdgePx: 1024, quality: 0.4 },
];

/**
 * Scales an image so its longer edge is at most `maxEdgePx`, never enlarging
 * it. Returns the size to resize to, or null when it already fits.
 */
export function fitWithin(
  widthPx: number,
  heightPx: number,
  maxEdgePx: number,
): { width: number; height: number } | null {
  const longest = Math.max(widthPx, heightPx);
  if (!(longest > maxEdgePx) || widthPx <= 0 || heightPx <= 0) {
    return null;
  }
  const scale = maxEdgePx / longest;
  return {
    width: Math.max(1, Math.round(widthPx * scale)),
    height: Math.max(1, Math.round(heightPx * scale)),
  };
}

/** The label a photo is filed under, e.g. "DDH-01 · Box 3 · 8.4–12 m". */
export function photoLabel(
  photo: Pick<FieldPhoto, "holeId" | "subjectType" | "boxNumber" | "fromM" | "toM">,
): string {
  const subject =
    photo.subjectType === "box" && photo.boxNumber != null
      ? `Box ${photo.boxNumber}`
      : "Interval";
  return `${photo.holeId} · ${subject} · ${photo.fromM}–${photo.toM} m`;
}

/**
 * A readable, filesystem-safe file name that carries the same context as the
 * record: hole, box (or interval), depth range and capture time.
 */
export function photoFileName(
  photo: Pick<
    FieldPhoto,
    "holeId" | "subjectType" | "boxNumber" | "fromM" | "toM" | "capturedAt"
  >,
): string {
  const clean = (text: string) =>
    text.replace(/[^A-Za-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "");
  const subject =
    photo.subjectType === "box" && photo.boxNumber != null
      ? `box${String(photo.boxNumber).padStart(2, "0")}`
      : "interval";
  const stamp = photo.capturedAt.replace(/[-:]/g, "").replace(/\.\d+/, "");
  return `${clean(photo.holeId) || "hole"}_${subject}_${clean(String(photo.fromM))}-${clean(String(photo.toM))}m_${clean(stamp)}.jpg`;
}
