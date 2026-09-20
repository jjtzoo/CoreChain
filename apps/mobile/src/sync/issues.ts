import { getDatabase } from '@/data/database';
import { newId, nowIso } from '@/data/ids';

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
