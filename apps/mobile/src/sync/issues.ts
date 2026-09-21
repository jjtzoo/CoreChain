import {
  conflictFields,
  resolvedValues,
  type ConflictSide,
} from '@corechain/domain';

import { getDatabase } from '@/data/database';
import { newId, nowIso } from '@/data/ids';
import { SYNCED_TABLES } from './syncedTables';

// Changes the server could not accept (E8-3). The change stays on the phone and
// the work carries on; this list is how the person is told. A conflict keeps
// both versions so the person can choose between them (E8-5).

export type SyncIssue = {
  id: string;
  tableName: string;
  recordId: string | null;
  status: string;
  reason: string | null;
  detail: string | null;
  /** For a conflict: the phone's version of the changed fields, when it was kept. */
  mine: Record<string, unknown> | null;
  /** For a conflict: the server's version of the same fields. */
  theirs: Record<string, unknown> | null;
  createdAt: string;
};

export async function recordIssue(issue: {
  tableName: string | null;
  recordId: string | null;
  status: string;
  reason?: string;
  detail?: string;
  mine?: Record<string, unknown>;
  theirs?: Record<string, unknown>;
}): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO sync_issues (id, table_name, record_id, status, reason, detail, mine, theirs, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      issue.tableName ?? 'unknown',
      issue.recordId,
      issue.status,
      issue.reason ?? null,
      issue.detail ?? null,
      issue.mine ? JSON.stringify(issue.mine) : null,
      issue.theirs ? JSON.stringify(issue.theirs) : null,
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

function parseValues(text: string | null): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
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
    mine: parseValues(row.mine ?? null),
    theirs: parseValues(row.theirs ?? null),
    createdAt: row.created_at as string,
  }));
}

/** A conflict where both versions were kept, so they can be compared. */
export function reviewable(issue: SyncIssue): boolean {
  return (
    issue.status === 'conflict' &&
    issue.recordId !== null &&
    issue.mine !== null &&
    issue.theirs !== null &&
    (SYNCED_TABLES as readonly string[]).includes(issue.tableName)
  );
}

export async function listConflicts(): Promise<SyncIssue[]> {
  return (await listOpenIssues()).filter(reviewable);
}

const RECORD_NAMES: Record<string, string> = {
  samples: 'SELECT sample_number AS name FROM samples WHERE id = ?',
  drillholes: 'SELECT hole_id AS name FROM drillholes WHERE id = ?',
  projects: 'SELECT name AS name FROM projects WHERE id = ?',
  dispatches: 'SELECT dispatch_number AS name FROM dispatches WHERE id = ?',
  core_boxes:
    "SELECT 'box ' || box_number AS name FROM core_boxes WHERE id = ?",
  core_runs:
    "SELECT from_m || '–' || to_m || ' m' AS name FROM core_runs WHERE id = ?",
  log_intervals:
    "SELECT from_m || '–' || to_m || ' m' AS name FROM log_intervals WHERE id = ?",
  code_library: 'SELECT code AS name FROM code_library WHERE id = ?',
};

const RECORD_KINDS: Record<string, string> = {
  samples: 'sample',
  drillholes: 'drillhole',
  projects: 'project',
  dispatches: 'dispatch',
  core_boxes: 'core box',
  core_runs: 'core run',
  log_intervals: 'log interval',
  code_library: 'code',
  custody_events: 'custody step',
};

/** The record's own name (a hole ID, a sample number), so the screen says which one it is. */
export async function describeRecord(issue: SyncIssue): Promise<string> {
  const words =
    RECORD_KINDS[issue.tableName] ?? issue.tableName.replace(/_/g, ' ');
  const sql = RECORD_NAMES[issue.tableName];
  if (!sql || !issue.recordId) return words;
  const db = await getDatabase();
  const { rows } = await db.execute(sql, [issue.recordId]);
  const name = (rows[0] as { name?: string } | undefined)?.name;
  return name ? `${words} ${name}` : words;
}

const NOT_WRITTEN = new Set(['id', 'version', 'created_at', 'updated_at']);

function toSqlite(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Applies the person's choices to the record as a new edit, one version above
 * the server's, so it uploads and wins cleanly. Every open conflict on the same
 * record is settled by it.
 */
export async function resolveConflict(
  issue: SyncIssue,
  choices: Readonly<Record<string, ConflictSide>>,
): Promise<void> {
  if (!reviewable(issue) || !issue.mine || !issue.theirs) return;
  const values = resolvedValues(
    conflictFields(issue.mine, issue.theirs),
    choices,
  );
  // Column names came from the server's answer: only plain names are used, and
  // the table is one of the synced tables (checked by reviewable).
  const names = Object.keys(values).filter(
    (name) => /^[a-z][a-z0-9_]*$/.test(name) && !NOT_WRITTEN.has(name),
  );
  const db = await getDatabase();
  const timestamp = nowIso();
  await db.transaction(async (tx) => {
    if (names.length > 0) {
      const { rows } = await tx.execute(
        `SELECT version FROM ${issue.tableName} WHERE id = ?`,
        [issue.recordId],
      );
      if (rows.length > 0) {
        const local = Number((rows[0] as { version?: number }).version ?? 0);
        const version = Math.max(local, Number(issue.theirs?.version ?? 0)) + 1;
        const sets = names.map((name) => `${name} = ?`).join(', ');
        await tx.execute(
          `UPDATE ${issue.tableName} SET ${sets}, version = ?, updated_at = ? WHERE id = ?`,
          [
            ...names.map((name) => toSqlite(values[name])),
            version,
            timestamp,
            issue.recordId,
          ],
        );
      }
    }
    await tx.execute(
      `UPDATE sync_issues SET resolved_at = ?
       WHERE table_name = ? AND record_id = ? AND status = 'conflict' AND resolved_at IS NULL`,
      [timestamp, issue.tableName, issue.recordId],
    );
  });
}
