import { getDatabase } from '@/data/database';
import { newId, nowIso } from '@/data/ids';
import { SYNCED_TABLES } from './syncedTables';

// Changes the server could not accept (E8-3). The change stays on the phone and
// the work carries on; this list is how the person is told.

export type SyncIssue = {
  id: string;
  tableName: string;
  recordId: string | null;
  status: string;
  reason: string | null;
  detail: string | null;
  createdAt: string;
};

export async function recordIssue(issue: {
  tableName: string | null;
  recordId: string | null;
  status: string;
  reason?: string;
  detail?: string;
}): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO sync_issues (id, table_name, record_id, status, reason, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      issue.tableName ?? 'unknown',
      issue.recordId,
      issue.status,
      issue.reason ?? null,
      issue.detail ?? null,
      nowIso(),
    ],
  );
}

/**
 * A change the server refused can be sent again from the row as it is now: the
 * row's version goes up, which puts the whole row back in the queue. Custody
 * events are only ever added, never edited, so they cannot be re-sent this way.
 */
export function canResend(issue: SyncIssue): boolean {
  return (
    issue.status === 'rejected' &&
    issue.recordId !== null &&
    issue.tableName !== 'custody_events' &&
    (SYNCED_TABLES as readonly string[]).includes(issue.tableName)
  );
}

/** Puts the refused changes back in the queue. Returns how many records were queued. */
export async function resendIssues(issues: SyncIssue[]): Promise<number> {
  const db = await getDatabase();
  // One record can have several refusals; it is queued once, and they all clear.
  const queuedByRecord = new Map<string, boolean>();
  await db.transaction(async (tx) => {
    for (const issue of issues) {
      if (!canResend(issue)) continue;
      const key = `${issue.tableName}|${issue.recordId}`;
      const timestamp = nowIso();
      let queued = queuedByRecord.get(key);
      if (queued === undefined) {
        // Table names come from SYNCED_TABLES (checked in canResend), never from input.
        const { rowsAffected } = await tx.execute(
          `UPDATE ${issue.tableName} SET version = version + 1, updated_at = ? WHERE id = ?`,
          [timestamp, issue.recordId],
        );
        queued = rowsAffected > 0;
        queuedByRecord.set(key, queued);
      }
      if (queued) {
        await tx.execute(
          'UPDATE sync_issues SET resolved_at = ? WHERE id = ?',
          [timestamp, issue.id],
        );
      }
    }
  });
  return [...queuedByRecord.values()].filter(Boolean).length;
}

export async function countOpenIssues(): Promise<number> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT COUNT(*) AS n FROM sync_issues WHERE resolved_at IS NULL',
  );
  return Number((rows[0] as { n?: number } | undefined)?.n ?? 0);
}

export async function listOpenIssues(): Promise<SyncIssue[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT * FROM sync_issues WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 50',
  );
  return (rows as Record<string, string | null>[]).map((row) => ({
    id: row.id as string,
    tableName: row.table_name as string,
    recordId: row.record_id,
    status: row.status as string,
    reason: row.reason,
    detail: row.detail,
    createdAt: row.created_at as string,
  }));
}
