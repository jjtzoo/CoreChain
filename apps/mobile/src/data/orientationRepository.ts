import { getDatabase } from './database';
import { nowIso } from './ids';

// Sprint 6: the mandatory first-login orientation (name + a short tour).
// Local only, one row ever, present only once orientation has been finished.

export async function isOrientationComplete(): Promise<boolean> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT completed_at FROM orientation_progress LIMIT 1',
  );
  return rows.length > 0;
}

export async function completeOrientation(): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO orientation_progress (id, completed_at) VALUES (1, ?)
     ON CONFLICT (id) DO UPDATE SET completed_at = excluded.completed_at`,
    [nowIso()],
  );
}
