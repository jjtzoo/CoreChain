import {
  deriveDrillholeStatus,
  loggedLengthM,
  loggingProgress,
  type FieldDrillhole,
} from '@corechain/domain';

import { listBoxes, listRuns } from './coreRepository';
import { getDrillhole, updateDrillholeStatus } from './drillholesRepository';
import { listIntervals } from './intervalsRepository';

/**
 * E2-3 (redesigned): recomputes a hole's status from what's actually been
 * recorded — any box, run or interval, or actual dates/depth — and persists
 * it if it moved. Called after each of those is saved, and whenever the hole
 * screen loads; the geologist never picks a status directly.
 */
export async function reconcileDrillholeStatus(
  drillholeId: string,
): Promise<FieldDrillhole | null> {
  const [drillhole, boxes, runs, intervals] = await Promise.all([
    getDrillhole(drillholeId),
    listBoxes(drillholeId),
    listRuns(drillholeId),
    listIntervals(drillholeId),
  ]);
  if (!drillhole) {
    return null;
  }

  const hasCoreRecorded =
    boxes.length > 0 || runs.length > 0 || intervals.length > 0;
  const progress = loggingProgress(loggedLengthM(intervals), drillhole);
  const derived = deriveDrillholeStatus(drillhole, hasCoreRecorded, progress);

  return derived === drillhole.status
    ? drillhole
    : updateDrillholeStatus(drillholeId, derived);
}
