import type { PhoneHoldings } from '@corechain/domain';

import { getSyncDatabase, wipeSyncedData } from '@/data/database';
import { listPendingFeedback } from '@/data/feedbackRepository';
import { deleteAllPhotoFiles, photoFile } from '@/data/photoFiles';
import { deleteAllTerrainFiles } from '@/data/terrainFiles';
import { listUnbackedFileNames } from '@/data/photoUploadsRepository';
import { resetDeviceId } from './device';
import { countOpenIssues } from './issues';
import { clearDataOwner } from './owner';

// E1-5: taking a person's data off the phone, and telling them first what would
// be lost. A photo's image file counts as work that exists only here until it has
// been backed up (E5-3).

/** What this phone holds that the server does not. */
export async function phoneHoldings(): Promise<PhoneHoldings> {
  const sync = await getSyncDatabase();
  const [queue, refused, feedback, photoNames] = await Promise.all([
    sync.getUploadQueueStats(),
    countOpenIssues(),
    listPendingFeedback(),
    listUnbackedFileNames(),
  ]);
  return {
    unsent: queue.count,
    refused,
    photos: photoNames.filter((name) => photoFile(name).exists).length,
    feedback: feedback.length,
  };
}

/**
 * Removes every record, photo, queued change and unsent message from this phone.
 * The caller decides whether that is safe (see `phoneHoldings`).
 */
export async function wipeDevice(): Promise<void> {
  await wipeSyncedData();
  deleteAllPhotoFiles();
  deleteAllTerrainFiles();
  await clearDataOwner();
  // The phone is handing itself to a different account: the old device id
  // belongs to whoever used it last and the server will never let this
  // account claim it, so a fresh one is needed.
  await resetDeviceId();
}
