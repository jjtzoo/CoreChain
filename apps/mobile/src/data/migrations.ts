import type { SQLBatchTuple } from '@op-engineering/op-sqlite';
import type { AbstractPowerSyncDatabase } from '@powersync/react-native';

// Local SQLite schema for the offline-first field workflow (E8-1). Every
// table carries the sync-ready columns decisions D6-D8 call for
// (id, created_at, updated_at, version, deleted_at); sync (Sprint 4) uses these
// tables as they are — see docs/product/corechain-mobile-mvp-scrum-plan.md.
//
// Migrations are a flat, ordered list of executeBatch command arrays applied
// once each, tracked by user_version (SQLite's built-in schema version
// pragma) so re-opening the same database is a no-op.

export type Migration = {
  version: number;
  commands: readonly SQLBatchTuple[];
};

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    commands: [
      [
        `CREATE TABLE projects (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          commodity TEXT,
          location TEXT,
          coordinate_system TEXT NOT NULL,
          sample_prefix TEXT NOT NULL,
          next_sample_number INTEGER NOT NULL,
          qc_standard_every_n INTEGER NOT NULL,
          qc_blank_every_n INTEGER NOT NULL,
          qc_duplicate_every_n INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL,
          deleted_at TEXT
        )`,
      ],
      [
        `CREATE TABLE drillholes (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL REFERENCES projects (id),
          hole_id TEXT NOT NULL,
          collar_source TEXT,
          collar_latitude REAL,
          collar_longitude REAL,
          collar_accuracy_m REAL,
          collar_captured_at TEXT,
          planned_azimuth_deg REAL,
          planned_inclination_deg REAL,
          planned_depth_m REAL NOT NULL,
          actual_final_depth_m REAL,
          started_at TEXT,
          completed_at TEXT,
          status TEXT NOT NULL,
          contractor TEXT,
          drill_type TEXT,
          diameter TEXT,
          note TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL,
          deleted_at TEXT
        )`,
      ],
      ['CREATE INDEX idx_drillholes_project_id ON drillholes (project_id)'],
      [
        `CREATE TABLE drillhole_status_history (
          id TEXT PRIMARY KEY NOT NULL,
          drillhole_id TEXT NOT NULL REFERENCES drillholes (id),
          status TEXT NOT NULL,
          changed_at TEXT NOT NULL
        )`,
      ],
      [
        'CREATE INDEX idx_status_history_drillhole_id ON drillhole_status_history (drillhole_id)',
      ],
    ],
  },
  {
    // Sprint 2, E3: core boxes and drilling runs.
    version: 2,
    commands: [
      [
        `CREATE TABLE core_boxes (
          id TEXT PRIMARY KEY NOT NULL,
          drillhole_id TEXT NOT NULL REFERENCES drillholes (id),
          box_number INTEGER NOT NULL,
          from_m REAL NOT NULL,
          to_m REAL NOT NULL,
          note TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL,
          deleted_at TEXT
        )`,
      ],
      ['CREATE INDEX idx_core_boxes_drillhole_id ON core_boxes (drillhole_id)'],
      [
        `CREATE TABLE core_runs (
          id TEXT PRIMARY KEY NOT NULL,
          drillhole_id TEXT NOT NULL REFERENCES drillholes (id),
          from_m REAL NOT NULL,
          to_m REAL NOT NULL,
          recovered_m REAL NOT NULL,
          rqd_pieces_m REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL,
          deleted_at TEXT
        )`,
      ],
      ['CREATE INDEX idx_core_runs_drillhole_id ON core_runs (drillhole_id)'],
    ],
  },
  {
    // Sprint 2, E4: the per-project code library, log intervals, and the
    // autosaved draft of an interval that is still being typed.
    version: 3,
    commands: [
      [
        `CREATE TABLE code_library (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL REFERENCES projects (id),
          category TEXT NOT NULL,
          code TEXT NOT NULL,
          description TEXT NOT NULL,
          hidden INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL,
          deleted_at TEXT
        )`,
      ],
      ['CREATE INDEX idx_code_library_project_id ON code_library (project_id)'],
      [
        `CREATE TABLE log_intervals (
          id TEXT PRIMARY KEY NOT NULL,
          drillhole_id TEXT NOT NULL REFERENCES drillholes (id),
          from_m REAL NOT NULL,
          to_m REAL NOT NULL,
          lithology TEXT,
          alteration_type TEXT,
          alteration_intensity TEXT,
          mineral TEXT,
          mineral_style TEXT,
          mineral_percent REAL,
          weathering TEXT,
          structure_type TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL,
          deleted_at TEXT
        )`,
      ],
      [
        'CREATE INDEX idx_log_intervals_drillhole_id ON log_intervals (drillhole_id)',
      ],
      [
        // Device-local scratch space (never synced): one in-progress interval
        // per hole, so killing the app mid-entry loses nothing (E4-3).
        `CREATE TABLE log_drafts (
          drillhole_id TEXT PRIMARY KEY NOT NULL REFERENCES drillholes (id),
          draft_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
      ],
    ],
  },
  {
    // Sprint 3, E6: samples (primary and QC) and QC-reminder dismissals.
    version: 4,
    commands: [
      [
        `CREATE TABLE samples (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL REFERENCES projects (id),
          drillhole_id TEXT NOT NULL REFERENCES drillholes (id),
          sample_number TEXT NOT NULL,
          sample_type TEXT NOT NULL,
          from_m REAL,
          to_m REAL,
          standard_ref TEXT,
          parent_sample_id TEXT REFERENCES samples (id),
          note TEXT,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL,
          deleted_at TEXT
        )`,
      ],
      [
        // Deliberately spans deleted rows too: a sample number is a physical
        // tag, so a number is never reused even after its sample is deleted.
        'CREATE UNIQUE INDEX idx_samples_project_number ON samples (project_id, sample_number COLLATE NOCASE)',
      ],
      ['CREATE INDEX idx_samples_drillhole_id ON samples (drillhole_id)'],
      [
        // A dismissed QC reminder restarts that control's count, and records why.
        `CREATE TABLE qc_dismissals (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL REFERENCES projects (id),
          control_type TEXT NOT NULL,
          reason TEXT NOT NULL,
          created_at TEXT NOT NULL
        )`,
      ],
      [
        'CREATE INDEX idx_qc_dismissals_project_id ON qc_dismissals (project_id)',
      ],
    ],
  },
  {
    // Sprint 3, E5: photos, and the project's largest-photo-size setting.
    version: 5,
    commands: [
      [
        'ALTER TABLE projects ADD COLUMN photo_max_mb REAL NOT NULL DEFAULT 1.5',
      ],
      [
        // The photo record carries its own hole ID, box number and depth range
        // (denormalised on purpose), so a photo can never be separated from its
        // depth even if the box or interval it was taken against changes.
        `CREATE TABLE photos (
          id TEXT PRIMARY KEY NOT NULL,
          drillhole_id TEXT NOT NULL REFERENCES drillholes (id),
          subject_type TEXT NOT NULL,
          subject_id TEXT NOT NULL,
          hole_id TEXT NOT NULL,
          box_number INTEGER,
          from_m REAL NOT NULL,
          to_m REAL NOT NULL,
          file_name TEXT NOT NULL,
          width_px INTEGER NOT NULL,
          height_px INTEGER NOT NULL,
          size_bytes INTEGER NOT NULL,
          captured_at TEXT NOT NULL,
          note TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL,
          deleted_at TEXT
        )`,
      ],
      ['CREATE INDEX idx_photos_subject ON photos (subject_type, subject_id)'],
      ['CREATE INDEX idx_photos_drillhole_id ON photos (drillhole_id)'],
    ],
  },
  {
    // Sprint 6, E10-2: tester feedback waiting to be sent. Local only, never synced.
    version: 6,
    commands: [
      [
        `CREATE TABLE feedback_outbox (
          id TEXT PRIMARY KEY NOT NULL,
          category TEXT NOT NULL,
          message TEXT NOT NULL,
          screen TEXT,
          app_version TEXT,
          device TEXT,
          created_at TEXT NOT NULL,
          sent_at TEXT
        )`,
      ],
    ],
  },
  {
    // Sprint 4, E8-3: changes the server could not accept, kept so the person
    // can be told. Local only, never synced.
    version: 7,
    commands: [
      [
        `CREATE TABLE sync_issues (
          id TEXT PRIMARY KEY NOT NULL,
          table_name TEXT NOT NULL,
          record_id TEXT,
          status TEXT NOT NULL,
          reason TEXT,
          detail TEXT,
          created_at TEXT NOT NULL,
          resolved_at TEXT
        )`,
      ],
    ],
  },
  {
    // Removals the phone queued after the server took records away were refused
    // by design and are not real problems: clear those alerts.
    version: 8,
    commands: [
      [
        `UPDATE sync_issues
         SET resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE reason = 'hard-delete-not-allowed' AND resolved_at IS NULL`,
      ],
    ],
  },
  {
    // Sprint 4, E6-4: the runs of sample numbers the server reserved for this
    // phone. Local only, never synced.
    version: 9,
    commands: [
      [
        `CREATE TABLE sample_blocks (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL,
          start_number INTEGER NOT NULL,
          size INTEGER NOT NULL,
          issued_at TEXT NOT NULL
        )`,
      ],
      [
        'CREATE INDEX idx_sample_blocks_project_id ON sample_blocks (project_id)',
      ],
    ],
  },
  {
    // Sprint 5, E7: chain of custody and lab dispatches. Synced. A custody
    // event is only ever added; a mistake is corrected by a new event.
    version: 10,
    commands: [
      [
        `CREATE TABLE dispatches (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL REFERENCES projects (id),
          dispatch_number TEXT NOT NULL,
          laboratory TEXT NOT NULL,
          preparation_request TEXT,
          handover_at TEXT,
          status TEXT NOT NULL,
          note TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL,
          deleted_at TEXT
        )`,
      ],
      ['CREATE INDEX idx_dispatches_project_id ON dispatches (project_id)'],
      [
        `CREATE TABLE dispatch_samples (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL REFERENCES projects (id),
          dispatch_id TEXT NOT NULL REFERENCES dispatches (id),
          sample_id TEXT NOT NULL REFERENCES samples (id),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version INTEGER NOT NULL,
          deleted_at TEXT
        )`,
      ],
      [
        'CREATE INDEX idx_dispatch_samples_dispatch_id ON dispatch_samples (dispatch_id)',
      ],
      [
        'CREATE INDEX idx_dispatch_samples_sample_id ON dispatch_samples (sample_id)',
      ],
      [
        `CREATE TABLE custody_events (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL REFERENCES projects (id),
          sample_id TEXT NOT NULL REFERENCES samples (id),
          event_type TEXT NOT NULL,
          occurred_at TEXT NOT NULL,
          handled_by TEXT NOT NULL,
          location TEXT,
          recipient TEXT,
          note TEXT,
          dispatch_id TEXT,
          corrects_event_id TEXT,
          created_at TEXT NOT NULL
        )`,
      ],
      [
        'CREATE INDEX idx_custody_events_sample_id ON custody_events (sample_id)',
      ],
      [
        'CREATE INDEX idx_custody_events_project_id ON custody_events (project_id)',
      ],
    ],
  },
  {
    // E8-5: a conflict keeps both versions so the person can choose between
    // them. Local only, like the rest of sync_issues.
    version: 11,
    commands: [
      ['ALTER TABLE sync_issues ADD COLUMN mine TEXT'],
      ['ALTER TABLE sync_issues ADD COLUMN theirs TEXT'],
    ],
  },
  {
    // E5-3: where each photo's image file stands. A photo with no row here has
    // not been tried yet. Local only: a photo's record syncs, its file goes up
    // separately and this phone keeps the score.
    version: 12,
    commands: [
      [
        `CREATE TABLE photo_uploads (
          photo_id TEXT PRIMARY KEY NOT NULL,
          status TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_attempt_at TEXT,
          last_error TEXT,
          sent_at TEXT
        )`,
      ],
    ],
  },
  {
    // Sprint 6, E10-1: the first-run guide's own progress, one row per tier
    // that has a guide (only the field geologist today). Local only, never
    // synced — replaying the guide never touches server data.
    version: 13,
    commands: [
      [
        `CREATE TABLE guide_progress (
          guide_key TEXT PRIMARY KEY NOT NULL,
          practice_project_id TEXT,
          current_step TEXT,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          dismissed_at TEXT
        )`,
      ],
    ],
  },
  {
    // Sprint 6, E10-2: a screenshot of the screen a message was sent from, kept
    // on the phone until it has been offered to the server once (best-effort —
    // unlike the message itself, a screenshot that fails to upload is not
    // retried, since it is an optional extra, never the report itself).
    version: 14,
    commands: [
      ['ALTER TABLE feedback_outbox ADD COLUMN screenshot_uri TEXT'],
    ],
  },
  {
    // Sprint 6, E11-2: a resident / project manager can flag a hole as
    // urgent from the web team overview. Set on the server only; the phone
    // just displays it, so a default of 'normal' and no note is always
    // correct for a hole this phone created itself.
    version: 15,
    commands: [
      ["ALTER TABLE drillholes ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'"],
      ['ALTER TABLE drillholes ADD COLUMN priority_note TEXT'],
    ],
  },
  {
    // Sprint 6: who logged each record (E7 custody traceability, and "Continue
    // where you left off" on the home screen). The server has always stamped
    // this on every write and shown it to a manager on the web; this just
    // brings it down to the phone. Set on the server only, from the signed-in
    // account, the moment a record is first created — the phone never writes
    // it and a record this phone just created has it blank until the next
    // sync round-trip fills it in.
    version: 16,
    commands: [
      ['ALTER TABLE drillholes ADD COLUMN created_by TEXT'],
      ['ALTER TABLE core_boxes ADD COLUMN created_by TEXT'],
      ['ALTER TABLE core_runs ADD COLUMN created_by TEXT'],
      ['ALTER TABLE log_intervals ADD COLUMN created_by TEXT'],
      ['ALTER TABLE samples ADD COLUMN created_by TEXT'],
      ['ALTER TABLE photos ADD COLUMN created_by TEXT'],
      ['ALTER TABLE custody_events ADD COLUMN created_by TEXT'],
    ],
  },
  {
    // Sprint 6: the mandatory first-login orientation (name + a short tour),
    // and a cached roster (account id -> name) so `created_by` on a synced
    // record can be shown as "logged by [name]" instead of a raw id. Both
    // local only: orientation is a one-off phone event, and the roster is a
    // refreshable cache from GET /api/roster, not something PowerSync syncs.
    version: 17,
    commands: [
      [
        `CREATE TABLE orientation_progress (
          id INTEGER PRIMARY KEY NOT NULL,
          completed_at TEXT NOT NULL
        )`,
      ],
      [
        `CREATE TABLE team_roster (
          user_id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          fetched_at TEXT NOT NULL
        )`,
      ],
    ],
  },
];

const ADD_COLUMN = /^ALTER TABLE (\w+) ADD COLUMN (\w+)/i;

function addedColumns(): { table: string; column: string; sql: string }[] {
  const result: { table: string; column: string; sql: string }[] = [];
  for (const migration of MIGRATIONS) {
    for (const [sql] of migration.commands) {
      const match = ADD_COLUMN.exec(sql);
      if (match) {
        result.push({ table: match[1], column: match[2], sql });
      }
    }
  }
  return result;
}

/**
 * PowerSync's `disconnectAndClear()` has been observed to silently revert a raw
 * table's physical columns back to whichever shape it first inferred for that
 * table, without touching SQLite's own `user_version` — so the migration system
 * above has no way to notice the loss on its own (`runMigrations` sees every
 * version already applied and does nothing). This re-checks every column a
 * migration has ever added via `PRAGMA table_info` and re-adds any that are
 * missing. Safe to call any time; a no-op when nothing is missing.
 */
export async function repairMissingColumns(
  db: AbstractPowerSyncDatabase,
): Promise<void> {
  const existing = new Map<string, Set<string>>();
  for (const { table, column, sql } of addedColumns()) {
    if (!existing.has(table)) {
      const info = await db.getAll<{ name: string }>(
        `PRAGMA table_info(${table})`,
      );
      existing.set(table, new Set(info.map((c) => c.name)));
    }
    const columns = existing.get(table)!;
    if (!columns.has(column)) {
      console.log(`[Migrate] repairing missing column ${table}.${column}`);
      await db.execute(sql);
      columns.add(column);
    }
  }
}
