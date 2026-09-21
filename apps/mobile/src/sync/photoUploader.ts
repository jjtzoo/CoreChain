import { classifyUploadResponse, photosDue } from '@corechain/domain';
import { fetch } from 'expo/fetch';

import { SERVER_URL } from '@/config';
import { photoFile } from '@/data/photoFiles';
import {
  listPhotosToBackup,
  markPhotoFailed,
  markPhotoNoFile,
  markPhotoSent,
  markPhotoWaiting,
} from '@/data/photoUploadsRepository';
import { isOnWifi, loadWifiOnly } from './photoBackupSettings';

// E5-3: sends each photo's image file to the server, separately from the
// records, so a slow photo never holds up a log. A photo goes up only after its
// record has reached the server; until then the server answers "not found" and
// the phone tries again later. Nothing here can lose a photo: the file stays on
// the phone whatever happens.

// A few at a time keeps one run short on a weak connection.
const PER_RUN = 5;

// One upload that gets no answer is given up on and tried again later. Without
// this, a request left hanging when the phone moves between mobile data and
// Wi-Fi would hold every later pass behind it. Long enough for a photo over a
// weak connection.
const UPLOAD_TIMEOUT_MS = 90_000;

export type BackupRun = {
  /** How many photos changed state (sent, failed, or found to have no file). */
  changed: number;
};

let running: Promise<BackupRun> | null = null;

/**
 * Sends the photos that are due. Runs never overlap: asking while one is going
 * returns that one. `ignoreDelay` sends every waiting photo now, for when a
 * sync has just finished or the person asked.
 */
export function backUpPhotos(
  cookie: string,
  options: { ignoreDelay?: boolean } = {},
): Promise<BackupRun> {
  if (!running) {
    running = run(cookie, options).finally(() => {
      running = null;
    });
  }
  return running;
}

async function run(
  cookie: string,
  options: { ignoreDelay?: boolean },
): Promise<BackupRun> {
  const due = photosDue(await listPhotosToBackup(), new Date(), {
    limit: PER_RUN,
    ignoreDelay: options.ignoreDelay,
  });
  if (due.length === 0) return { changed: 0 };

  if ((await loadWifiOnly()) && (await isOnWifi()) === false) {
    return { changed: 0 };
  }

  let changed = 0;
  for (const photo of due) {
    const file = photoFile(photo.fileName);
    if (!file.exists) {
      await markPhotoNoFile(photo.id);
      changed += 1;
      continue;
    }

    let status: number | null = null;
    let code: string | null = null;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const response = await fetch(
        `${SERVER_URL}/api/photos/${photo.id}/file`,
        {
          method: 'PUT',
          headers: { Cookie: cookie, 'Content-Type': 'image/jpeg' },
          body: bytes,
          signal: abort.signal,
        },
      );
      status = response.status;
      if (!response.ok) {
        code =
          (
            (await response.json().catch(() => null)) as {
              error?: string;
            } | null
          )?.error ?? null;
      }
    } catch {
      // No answer: no signal, a dropped connection or a timeout. Not the
      // photo's fault.
    } finally {
      clearTimeout(timer);
    }

    const outcome = classifyUploadResponse(status, code);
    if (outcome.kind === 'signed-out') break;
    if (outcome.kind === 'sent') {
      await markPhotoSent(photo.id);
      changed += 1;
    } else if (outcome.kind === 'failed') {
      await markPhotoFailed(photo.id, outcome.error);
      changed += 1;
    } else {
      await markPhotoWaiting(photo.id, outcome.error);
      // Without a connection the rest would fail too; leave them for later.
      if (status === null) break;
    }
  }
  return { changed };
}
