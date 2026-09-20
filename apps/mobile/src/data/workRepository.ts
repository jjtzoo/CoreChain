import type { SampleType, WorkInput } from '@corechain/domain';

import { listAllCustody } from './custodyRepository';
import { getDatabase } from './database';

type Row = Record<string, unknown>;

/**
 * Everything the "My work" screen counts (E14), read straight from the phone:
 * no signal needed, and the same rows whether or not they have synced yet.
 * Only records that are not deleted are counted.
 */
export async function loadWorkInput(): Promise<WorkInput> {
  const db = await getDatabase();
  const rows = async (sql: string): Promise<Row[]> =>
    (await db.execute(sql)).rows as unknown as Row[];

  const [intervals, boxes, runs, samples, photos, dispatches, custody] =
    await Promise.all([
      rows(
        `SELECT i.from_m, i.to_m, i.created_at, d.hole_id
         FROM log_intervals i JOIN drillholes d ON d.id = i.drillhole_id
         WHERE i.deleted_at IS NULL`,
      ),
      rows('SELECT created_at FROM core_boxes WHERE deleted_at IS NULL'),
      rows('SELECT created_at FROM core_runs WHERE deleted_at IS NULL'),
      rows(
        'SELECT sample_type, created_at FROM samples WHERE deleted_at IS NULL',
      ),
      rows('SELECT captured_at FROM photos WHERE deleted_at IS NULL'),
      rows(
        `SELECT d.dispatch_number, d.laboratory, d.handover_at,
           (SELECT COUNT(*) FROM dispatch_samples ds
            WHERE ds.dispatch_id = d.id AND ds.deleted_at IS NULL) AS sample_count
         FROM dispatches d
         WHERE d.deleted_at IS NULL AND d.status = 'dispatched'`,
      ),
      listAllCustody(),
    ]);

  return {
    intervals: intervals.map((r) => ({
      holeName: String(r.hole_id),
      fromM: Number(r.from_m),
      toM: Number(r.to_m),
      createdAt: String(r.created_at),
    })),
    boxes: boxes.map((r) => ({ createdAt: String(r.created_at) })),
    runs: runs.map((r) => ({ createdAt: String(r.created_at) })),
    samples: samples.map((r) => ({
      type: r.sample_type as SampleType,
      createdAt: String(r.created_at),
    })),
    custody,
    photos: photos.map((r) => ({ capturedAt: String(r.captured_at) })),
    dispatches: dispatches.map((r) => ({
      dispatchNumber: String(r.dispatch_number),
      laboratory: String(r.laboratory),
      handoverDay: r.handover_at ? String(r.handover_at) : null,
      sampleCount: Number(r.sample_count),
    })),
  };
}
