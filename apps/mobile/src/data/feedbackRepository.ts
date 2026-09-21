import { getDatabase } from './database';
import { newId, nowIso } from './ids';

// E10-2: feedback the tester has written but that may not have reached the
// server yet. It lives on the phone until the server confirms it (a message
// written in the field must not be lost because there is no signal). Local
// only: this table is never synced through PowerSync.

export type PendingFeedback = {
  id: string;
  category: string;
  message: string;
  screen: string | null;
  appVersion: string | null;
  device: string | null;
  /** A local file URI, offered to the server once (best-effort) when sent. */
  screenshotUri: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  category: string;
  message: string;
  screen: string | null;
  app_version: string | null;
  device: string | null;
  screenshot_uri: string | null;
  created_at: string;
};

export async function enqueueFeedback(input: {
  category: string;
  message: string;
  screen: string | null;
  appVersion: string | null;
  device: string | null;
  screenshotUri: string | null;
}): Promise<string> {
  const db = await getDatabase();
  const id = newId();
  await db.execute(
    `INSERT INTO feedback_outbox (id, category, message, screen, app_version, device, screenshot_uri, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.category,
      input.message.trim(),
      input.screen,
      input.appVersion,
      input.device,
      input.screenshotUri,
      nowIso(),
    ],
  );
  return id;
}

export async function listPendingFeedback(): Promise<PendingFeedback[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT * FROM feedback_outbox WHERE sent_at IS NULL ORDER BY created_at',
  );
  return (rows as unknown as Row[]).map((row) => ({
    id: row.id,
    category: row.category,
    message: row.message,
    screen: row.screen,
    appVersion: row.app_version,
    device: row.device,
    screenshotUri: row.screenshot_uri,
    createdAt: row.created_at,
  }));
}

export async function markFeedbackSent(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('UPDATE feedback_outbox SET sent_at = ? WHERE id = ?', [
    nowIso(),
    id,
  ]);
}
