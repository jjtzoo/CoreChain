// The tables that travel between this phone and the server (E8), parents before
// children so an upload always creates a project before the holes in it. Kept
// in step with SYNC_TABLES in apps/web/lib/sync/tables.ts. Two tables are
// deliberately absent: log_drafts (scratch space for an interval still being
// typed) and feedback_outbox / sync_issues (this phone's own bookkeeping).
export const SYNCED_TABLES = [
  'projects',
  'drillholes',
  'drillhole_status_history',
  'core_boxes',
  'core_runs',
  'code_library',
  'log_intervals',
  'samples',
  'qc_dismissals',
  'photos',
  'dispatches',
  'dispatch_samples',
  'custody_events',
] as const;

/** Columns set once when a row is created. The server refuses a change to them. */
export const SET_ONCE_COLUMNS = [
  'id',
  'created_at',
  'project_id',
  'drillhole_id',
  'sample_number',
  'dispatch_id',
  'sample_id',
] as const;
