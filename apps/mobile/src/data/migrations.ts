import type { SQLBatchTuple } from '@op-engineering/op-sqlite';

// Local SQLite schema for the offline-first field workflow (E8-1). Every
// table carries the sync-ready columns decisions D6-D8 call for
// (id, created_at, updated_at, version, deleted_at) even though sync itself
// isn't wired up until Sprint 4/5 — see docs/product/corechain-mobile-mvp-scrum-plan.md.
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
      [
        'CREATE INDEX idx_drillholes_project_id ON drillholes (project_id)',
      ],
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
      ['CREATE INDEX idx_qc_dismissals_project_id ON qc_dismissals (project_id)'],
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
];
