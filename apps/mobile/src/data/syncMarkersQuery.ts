// E8-4: the query that works out which records a set of changes touches. Pure
// text, so it can be tested against a real SQLite without the phone.

/** The kinds of record the phone shows in lists. */
export type MarkerKind = 'project' | 'drillhole' | 'sample' | 'dispatch';

// A record of `table` with a change belongs to this kind of record itself...
const SELF: readonly [table: string, kind: MarkerKind][] = [
  ['projects', 'project'],
  ['drillholes', 'drillhole'],
  ['samples', 'sample'],
  ['dispatches', 'dispatch'],
];

// ...and to the record named by one of its columns.
const PARENTS: readonly [table: string, kind: MarkerKind, column: string][] = [
  ['drillholes', 'project', 'project_id'],
  ['code_library', 'project', 'project_id'],
  ['samples', 'project', 'project_id'],
  ['qc_dismissals', 'project', 'project_id'],
  ['dispatches', 'project', 'project_id'],
  ['dispatch_samples', 'project', 'project_id'],
  ['custody_events', 'project', 'project_id'],
  ['drillhole_status_history', 'drillhole', 'drillhole_id'],
  ['core_boxes', 'drillhole', 'drillhole_id'],
  ['core_runs', 'drillhole', 'drillhole_id'],
  ['log_intervals', 'drillhole', 'drillhole_id'],
  ['photos', 'drillhole', 'drillhole_id'],
  ['samples', 'drillhole', 'drillhole_id'],
  ['custody_events', 'sample', 'sample_id'],
  ['dispatch_samples', 'sample', 'sample_id'],
  ['dispatch_samples', 'dispatch', 'dispatch_id'],
  ['custody_events', 'dispatch', 'dispatch_id'],
];

// Tables filed under a hole (no project column of their own) reach the project
// through the hole.
const VIA_DRILLHOLE = [
  'drillhole_status_history',
  'core_boxes',
  'core_runs',
  'log_intervals',
  'photos',
] as const;

/** One query that lists (kind, id) for every record touched by the changes in `source`. */
export function markersQuery(source: string): string {
  const own = (table: string) =>
    `SELECT id FROM changed WHERE tbl = '${table}'`;
  const parts: string[] = [];
  for (const [table, kind] of SELF) {
    parts.push(
      `SELECT '${kind}' AS kind, id FROM changed WHERE tbl = '${table}'`,
    );
  }
  for (const [table, kind, column] of PARENTS) {
    parts.push(
      `SELECT '${kind}' AS kind, ${column} AS id FROM ${table}
       WHERE id IN (${own(table)}) AND ${column} IS NOT NULL`,
    );
  }
  for (const table of VIA_DRILLHOLE) {
    parts.push(
      `SELECT 'project' AS kind, d.project_id AS id
       FROM ${table} c JOIN drillholes d ON d.id = c.drillhole_id
       WHERE c.id IN (${own(table)})`,
    );
  }
  return `WITH changed(tbl, id) AS (${source}) ${parts.join(' UNION ')}`;
}
