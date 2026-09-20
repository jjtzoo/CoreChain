import type { PhoneHoldings } from '@corechain/domain';

import { getSyncDatabase, wipeSyncedData } from '@/data/database';
import { listPendingFeedback } from '@/data/feedbackRepository';
import { deleteAllPhotoFiles, photoFile } from '@/data/photoFiles';
import { listPhotoFileNames } from '@/data/photosRepository';
import { countOpenIssues } from './issues';
import { clearDataOwner } from './owner';

// E1-5: taking a person's data off the phone, and telling them first what would
// be lost. Photo image files are not backed up yet (E5-3), so every photo on the
// phone counts as work that exists only here.

/** What this phone holds that the server does not. */
export async function phoneHoldings(): Promise<PhoneHoldings> {
  const sync = await getSyncDatabase();
  const [queue, refused, feedback, photoNames] = await Promise.all([
    sync.getUploadQueueStats(),
    countOpenIssues(),
    listPendingFeedback(),
    listPhotoFileNames(),
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
  await clearDataOwner();
}
