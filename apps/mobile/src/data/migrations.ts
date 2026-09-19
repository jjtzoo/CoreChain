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
];
