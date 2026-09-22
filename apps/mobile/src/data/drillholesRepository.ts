import type {
  Collar,
  DrillholeStatus,
  FieldDrillhole,
  FieldDrillholeInput,
  FieldValidationResult,
} from '@corechain/domain';
import { validateDrillholeInput } from '@corechain/domain';
import type { Scalar } from '@op-engineering/op-sqlite';
import { getDatabase } from './database';
import { newId, nowIso } from './ids';

type DrillholeRow = {
  id: string;
  project_id: string;
  hole_id: string;
  collar_source: 'gps' | 'manual' | null;
  collar_latitude: number | null;
  collar_longitude: number | null;
  collar_accuracy_m: number | null;
  collar_captured_at: string | null;
  planned_azimuth_deg: number | null;
  planned_inclination_deg: number | null;
  planned_depth_m: number;
  actual_final_depth_m: number | null;
  started_at: string | null;
  completed_at: string | null;
  status: DrillholeStatus;
  contractor: string | null;
  drill_type: string | null;
  diameter: string | null;
  note: string | null;
  priority: 'normal' | 'urgent';
  priority_note: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};

function rowToDrillhole(row: DrillholeRow): FieldDrillhole {
  const collar: Collar | null =
    row.collar_source && row.collar_latitude != null && row.collar_longitude != null
      ? {
          source: row.collar_source,
          latitude: row.collar_latitude,
          longitude: row.collar_longitude,
          accuracyM: row.collar_accuracy_m,
          capturedAt: row.collar_captured_at ?? row.created_at,
        }
      : null;

  return {
    id: row.id,
    projectId: row.project_id,
    holeId: row.hole_id,
    collar,
    plannedAzimuthDeg: row.planned_azimuth_deg,
    plannedInclinationDeg: row.planned_inclination_deg,
    plannedDepthM: row.planned_depth_m,
    actualFinalDepthM: row.actual_final_depth_m,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    status: row.status,
    contractor: row.contractor,
    drillType: row.drill_type,
    diameter: row.diameter,
    note: row.note,
    priority: row.priority,
    priorityNote: row.priority_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    deletedAt: row.deleted_at,
  };
}

async function existingHoleIds(projectId: string): Promise<string[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT hole_id FROM drillholes WHERE project_id = ? AND deleted_at IS NULL',
    [projectId],
  );
  return (rows as unknown as { hole_id: string }[]).map((r) => r.hole_id);
}

export type CreateDrillholeResult =
  | { outcome: 'created'; drillhole: FieldDrillhole }
  | { outcome: 'invalid'; errors: FieldValidationResult };

/**
 * E2-1: creates a drillhole in "planned" status. Hole ID uniqueness is
 * checked within this project only — the same hole name is legal in a
 * different project.
 */
export async function createDrillhole(
  projectId: string,
  input: FieldDrillholeInput,
): Promise<CreateDrillholeResult> {
  const otherHoleIds = await existingHoleIds(projectId);
  const validation = validateDrillholeInput(input, otherHoleIds);
  if (!validation.valid) {
    return { outcome: 'invalid', errors: validation };
  }

  const db = await getDatabase();
  const id = newId();
  const timestamp = nowIso();
  const collar = input.collar ?? null;

  const params: Scalar[] = [
    id,
    projectId,
    input.holeId.trim(),
    collar?.source ?? null,
    collar?.latitude ?? null,
    collar?.longitude ?? null,
    collar?.accuracyM ?? null,
    collar?.capturedAt ?? null,
    input.plannedAzimuthDeg ?? null,
    input.plannedInclinationDeg ?? null,
    input.plannedDepthM,
    'planned' satisfies DrillholeStatus,
    input.contractor ?? null,
    input.drillType ?? null,
    input.diameter ?? null,
    input.note ?? null,
    timestamp,
    timestamp,
    1,
  ];

  await db.execute(
    `INSERT INTO drillholes (
      id, project_id, hole_id, collar_source, collar_latitude,
      collar_longitude, collar_accuracy_m, collar_captured_at,
      planned_azimuth_deg, planned_inclination_deg, planned_depth_m, status,
      contractor, drill_type, diameter, note, created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params,
  );

  await recordStatusChange(id, 'planned', timestamp);

  const drillhole = await getDrillhole(id);
  if (!drillhole) {
    throw new Error(`Failed to read back newly created drillhole ${id}.`);
  }
  return { outcome: 'created', drillhole };
}

export async function listDrillholes(
  projectId: string,
): Promise<FieldDrillhole[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT * FROM drillholes
     WHERE project_id = ? AND deleted_at IS NULL
     ORDER BY hole_id COLLATE NOCASE`,
    [projectId],
  );
  return (rows as unknown as DrillholeRow[]).map(rowToDrillhole);
}

export async function getDrillhole(id: string): Promise<FieldDrillhole | null> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT * FROM drillholes WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  const row = (rows as unknown as DrillholeRow[])[0];
  return row ? rowToDrillhole(row) : null;
}

/**
 * E2-2: records the actual start/end dates and final depth. Callers should
 * check `actualDepthWarning` from @corechain/domain first and confirm with
 * the geologist before calling this if it returns a warning — this function
 * itself does not block a shallower-than-recorded depth, per the story's AC.
 */
export async function updateDrillholeActuals(
  id: string,
  actuals: {
    startedAt?: string | null;
    completedAt?: string | null;
    actualFinalDepthM?: number | null;
  },
): Promise<FieldDrillhole | null> {
  const db = await getDatabase();
  const existing = await getDrillhole(id);
  if (!existing) {
    return null;
  }

  await db.execute(
    `UPDATE drillholes SET
      started_at = ?, completed_at = ?, actual_final_depth_m = ?,
      updated_at = ?, version = version + 1
    WHERE id = ?`,
    [
      actuals.startedAt ?? existing.startedAt,
      actuals.completedAt ?? existing.completedAt,
      actuals.actualFinalDepthM ?? existing.actualFinalDepthM,
      nowIso(),
      id,
    ],
  );

  return getDrillhole(id);
}

async function recordStatusChange(
  drillholeId: string,
  status: DrillholeStatus,
  changedAt: string,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    'INSERT INTO drillhole_status_history (id, drillhole_id, status, changed_at) VALUES (?, ?, ?, ?)',
    [newId(), drillholeId, status, changedAt],
  );
}

/**
 * E2-3: sets the hole's status and appends to its history — the history
 * table is append-only (decision D7's pattern applied here too), so a
 * status can be revisited later without losing the earlier record.
 */
export async function updateDrillholeStatus(
  id: string,
  status: DrillholeStatus,
): Promise<FieldDrillhole | null> {
  const db = await getDatabase();
  const existing = await getDrillhole(id);
  if (!existing) {
    return null;
  }

  const timestamp = nowIso();
  await db.execute(
    'UPDATE drillholes SET status = ?, updated_at = ?, version = version + 1 WHERE id = ?',
    [status, timestamp, id],
  );
  await recordStatusChange(id, status, timestamp);

  return getDrillhole(id);
}

/**
 * The hole worked on most recently: the latest change to the hole itself or to
 * any of its core boxes, runs, log intervals, samples or photos. Drives the
 * "Continue where you left off" card on the home screen.
 */
export async function getMostRecentDrillhole(): Promise<{
  drillhole: FieldDrillhole;
  projectName: string;
} | null> {
  const db = await getDatabase();
  const latest = (table: string) =>
    `COALESCE((SELECT MAX(updated_at) FROM ${table} WHERE drillhole_id = d.id AND deleted_at IS NULL), '')`;
  const { rows } = await db.execute(
    `SELECT d.*, p.name AS project_name,
       MAX(d.updated_at, ${latest('core_boxes')}, ${latest('core_runs')},
           ${latest('log_intervals')}, ${latest('samples')}, ${latest('photos')}) AS last_touched
     FROM drillholes d
     JOIN projects p ON p.id = d.project_id
     WHERE d.deleted_at IS NULL AND p.deleted_at IS NULL
     ORDER BY last_touched DESC
     LIMIT 1`,
  );
  const row = (rows as unknown as (DrillholeRow & { project_name: string })[])[0];
  return row
    ? { drillhole: rowToDrillhole(row), projectName: row.project_name }
    : null;
}
