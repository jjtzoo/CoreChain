import type { BackupCandidate, PhotoBackupState } from '@corechain/domain';

import { getDatabase } from './database';
import { nowIso } from './ids';

// E5-3: the phone's score for each photo's image file. The photo record itself
// syncs like any other; this table only says whether the file has gone up.

type UploadStatus = 'waiting' | 'sent' | 'failed' | 'no-file';

export type PhotoToBackup = BackupCandidate & { fileName: string };

/** Photos that still need their file sent, oldest first. */
export async function listPhotosToBackup(): Promise<PhotoToBackup[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT p.id, p.file_name, COALESCE(u.attempts, 0) AS attempts,
            u.last_attempt_at
     FROM photos p
     LEFT JOIN photo_uploads u ON u.photo_id = p.id
     WHERE p.deleted_at IS NULL AND (u.status IS NULL OR u.status = 'waiting')
     ORDER BY p.created_at`,
  );
  return (
    rows as unknown as {
      id: string;
      file_name: string;
      attempts: number;
      last_attempt_at: string | null;
    }[]
  ).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    attempts: Number(row.attempts),
    lastAttemptAt: row.last_attempt_at,
  }));
}

async function record(
  photoId: string,
  status: UploadStatus,
  error: string | null,
  countAttempt: boolean,
): Promise<void> {
  const db = await getDatabase();
  const timestamp = nowIso();
  await db.execute(
    `INSERT INTO photo_uploads
       (photo_id, status, attempts, last_attempt_at, last_error, sent_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (photo_id) DO UPDATE SET
       status = excluded.status,
       attempts = photo_uploads.attempts + ?,
       last_attempt_at = excluded.last_attempt_at,
       last_error = excluded.last_error,
       sent_at = excluded.sent_at`,
    [
      photoId,
      status,
      countAttempt ? 1 : 0,
      timestamp,
      error,
      status === 'sent' ? timestamp : null,
      countAttempt ? 1 : 0,
    ],
  );
}

export const markPhotoSent = (photoId: string) =>
  record(photoId, 'sent', null, false);

/** A try that did not get through, and will be repeated later. */
export const markPhotoWaiting = (photoId: string, error: string) =>
  record(photoId, 'waiting', error, true);

/** The server will never take this file. */
export const markPhotoFailed = (photoId: string, error: string) =>
  record(photoId, 'failed', error, true);

/** The image file is not on this phone, so there is nothing to send. */
export const markPhotoNoFile = (photoId: string) =>
  record(photoId, 'no-file', null, false);

/** Where each photo (not removed) stands, by photo id. */
export async function photoBackupStates(): Promise<
  Map<string, PhotoBackupState>
> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT p.id, u.status
     FROM photos p
     LEFT JOIN photo_uploads u ON u.photo_id = p.id
     WHERE p.deleted_at IS NULL`,
  );
  return new Map(
    (rows as unknown as { id: string; status: UploadStatus | null }[]).map(
      (row) => [row.id, row.status ?? 'waiting'],
    ),
  );
}

/** File names of photos whose image is not on the server (sent or unsendable). */
export async function listUnbackedFileNames(): Promise<string[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT p.file_name
     FROM photos p
     LEFT JOIN photo_uploads u ON u.photo_id = p.id
     WHERE p.deleted_at IS NULL
       AND (u.status IS NULL OR u.status IN ('waiting', 'failed'))`,
  );
  return (rows as unknown as { file_name: string }[]).map((r) => r.file_name);
}
