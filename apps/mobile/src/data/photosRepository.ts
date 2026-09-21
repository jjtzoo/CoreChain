import {
  photoFileName,
  type FieldPhoto,
  type PhotoSubjectType,
} from '@corechain/domain';
import { getDatabase } from './database';
import { newId, nowIso } from './ids';

// E5: photo records. The image file itself lives in the photos folder (see
// photoFiles.ts); this table holds its context — hole, box, depth range and
// time — so a photo can't be separated from its depth.

type PhotoRow = {
  id: string;
  drillhole_id: string;
  subject_type: PhotoSubjectType;
  subject_id: string;
  hole_id: string;
  box_number: number | null;
  from_m: number;
  to_m: number;
  file_name: string;
  width_px: number;
  height_px: number;
  size_bytes: number;
  captured_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};

function rowToPhoto(row: PhotoRow): FieldPhoto {
  return {
    id: row.id,
    drillholeId: row.drillhole_id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    holeId: row.hole_id,
    boxNumber: row.box_number,
    fromM: row.from_m,
    toM: row.to_m,
    fileName: row.file_name,
    widthPx: row.width_px,
    heightPx: row.height_px,
    sizeBytes: row.size_bytes,
    capturedAt: row.captured_at,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    deletedAt: row.deleted_at,
  };
}

export async function listPhotos(
  subjectType: PhotoSubjectType,
  subjectId: string,
): Promise<FieldPhoto[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT * FROM photos
     WHERE subject_type = ? AND subject_id = ? AND deleted_at IS NULL
     ORDER BY captured_at`,
    [subjectType, subjectId],
  );
  return (rows as unknown as PhotoRow[]).map(rowToPhoto);
}

/** Photo counts per subject id for one hole and subject type. */
export async function countPhotosBySubject(
  drillholeId: string,
  subjectType: PhotoSubjectType,
): Promise<Map<string, number>> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT subject_id, COUNT(*) AS n FROM photos
     WHERE drillhole_id = ? AND subject_type = ? AND deleted_at IS NULL
     GROUP BY subject_id`,
    [drillholeId, subjectType],
  );
  return new Map(
    (rows as unknown as { subject_id: string; n: number }[]).map((r) => [
      r.subject_id,
      Number(r.n),
    ]),
  );
}

export type NewPhoto = {
  drillholeId: string;
  subjectType: PhotoSubjectType;
  subjectId: string;
  holeId: string;
  boxNumber: number | null;
  fromM: number;
  toM: number;
  widthPx: number;
  heightPx: number;
  sizeBytes: number;
  capturedAt: string;
};

/** The file name a photo will be stored under, from its context. */
export function fileNameFor(photo: NewPhoto): string {
  return photoFileName(photo);
}

export async function insertPhoto(
  photo: NewPhoto,
  fileName: string,
): Promise<FieldPhoto> {
  const db = await getDatabase();
  const id = newId();
  const timestamp = nowIso();
  await db.execute(
    `INSERT INTO photos (
      id, drillhole_id, subject_type, subject_id, hole_id, box_number,
      from_m, to_m, file_name, width_px, height_px, size_bytes, captured_at,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      photo.drillholeId,
      photo.subjectType,
      photo.subjectId,
      photo.holeId,
      photo.boxNumber,
      photo.fromM,
      photo.toM,
      fileName,
      photo.widthPx,
      photo.heightPx,
      photo.sizeBytes,
      photo.capturedAt,
      timestamp,
      timestamp,
    ],
  );
  const { rows } = await db.execute('SELECT * FROM photos WHERE id = ?', [id]);
  const row = (rows as unknown as PhotoRow[])[0];
  if (!row) {
    throw new Error(`Failed to read back newly saved photo ${id}.`);
  }
  return rowToPhoto(row);
}

export async function deletePhotoRecord(id: string): Promise<void> {
  const db = await getDatabase();
  const timestamp = nowIso();
  await db.execute(
    `UPDATE photos SET deleted_at = ?, updated_at = ?, version = version + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [timestamp, timestamp, id],
  );
}
