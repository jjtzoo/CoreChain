import { getDatabase } from './database';
import { nowIso } from './ids';

// Sprint 6, E10-1: the first-run guide's progress. Only the field geologist
// tier has a guide today (the only tier with real screens built), so there is
// exactly one possible row, keyed by GUIDE_KEY. Local only, never synced.

export const GUIDE_KEY = 'field_geologist';

export type GuideProgress = {
  practiceProjectId: string | null;
  currentStep: string | null;
  startedAt: string;
  completedAt: string | null;
  dismissedAt: string | null;
};

type GuideRow = {
  practice_project_id: string | null;
  current_step: string | null;
  started_at: string;
  completed_at: string | null;
  dismissed_at: string | null;
};

function rowToProgress(row: GuideRow): GuideProgress {
  return {
    practiceProjectId: row.practice_project_id,
    currentStep: row.current_step,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    dismissedAt: row.dismissed_at,
  };
}

export async function getGuideProgress(): Promise<GuideProgress | null> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT * FROM guide_progress WHERE guide_key = ?',
    [GUIDE_KEY],
  );
  const row = (rows as unknown as GuideRow[])[0];
  return row ? rowToProgress(row) : null;
}

/** Starts (or replays) the guide from its first step, on a fresh practice project. */
export async function startGuide(
  practiceProjectId: string,
  firstStep: string,
): Promise<GuideProgress> {
  const db = await getDatabase();
  const timestamp = nowIso();
  await db.execute(
    `INSERT INTO guide_progress
       (guide_key, practice_project_id, current_step, started_at, completed_at, dismissed_at)
     VALUES (?, ?, ?, ?, NULL, NULL)
     ON CONFLICT (guide_key) DO UPDATE SET
       practice_project_id = excluded.practice_project_id,
       current_step = excluded.current_step,
       started_at = excluded.started_at,
       completed_at = NULL,
       dismissed_at = NULL`,
    [GUIDE_KEY, practiceProjectId, firstStep, timestamp],
  );
  const progress = await getGuideProgress();
  if (!progress) {
    throw new Error('Failed to read back guide progress after starting it.');
  }
  return progress;
}

export async function setGuideStep(step: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE guide_progress SET current_step = ? WHERE guide_key = ?',
    [step, GUIDE_KEY],
  );
}

export async function completeGuide(): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'UPDATE guide_progress SET current_step = NULL, completed_at = ? WHERE guide_key = ?',
    [nowIso(), GUIDE_KEY],
  );
}

/**
 * "Not now" or "Skip guide": stops the guide without marking it complete, so
 * the Home prompt stops showing but Account still offers to start it again.
 * Works whether or not the guide had been started yet.
 */
export async function dismissGuide(): Promise<void> {
  const db = await getDatabase();
  const timestamp = nowIso();
  await db.execute(
    `INSERT INTO guide_progress
       (guide_key, practice_project_id, current_step, started_at, completed_at, dismissed_at)
     VALUES (?, NULL, NULL, ?, NULL, ?)
     ON CONFLICT (guide_key) DO UPDATE SET
       current_step = NULL,
       dismissed_at = excluded.dismissed_at`,
    [GUIDE_KEY, timestamp, timestamp],
  );
}
