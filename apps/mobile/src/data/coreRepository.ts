import type {
  FieldCoreBox,
  CoreBoxInput,
  FieldCoreRun,
  CoreRunInput,
  CoreValidationResult,
} from '@corechain/domain';
import { validateBoxInput, validateRunInput } from '@corechain/domain';
import { getDatabase } from './database';
import { newId, nowIso } from './ids';

// E3: core boxes and drilling runs. Deleting is a soft delete (deleted_at) so
// the record stays sync-ready (decision D6) and can be reconciled later.

type BoxRow = {
  id: string;
  drillhole_id: string;
  box_number: number;
  from_m: number;
  to_m: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};

type RunRow = {
  id: string;
  drillhole_id: string;
  from_m: number;
  to_m: number;
  recovered_m: number;
  rqd_pieces_m: number | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};

function rowToBox(row: BoxRow): FieldCoreBox {
  return {
    id: row.id,
    drillholeId: row.drillhole_id,
    boxNumber: row.box_number,
    fromM: row.from_m,
    toM: row.to_m,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    deletedAt: row.deleted_at,
  };
}

function rowToRun(row: RunRow): FieldCoreRun {
  return {
    id: row.id,
    drillholeId: row.drillhole_id,
    fromM: row.from_m,
    toM: row.to_m,
    recoveredM: row.recovered_m,
    rqdPiecesM: row.rqd_pieces_m,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    deletedAt: row.deleted_at,
  };
}

// --- Boxes (E3-1) -----------------------------------------------------------

export async function listBoxes(drillholeId: string): Promise<FieldCoreBox[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT * FROM core_boxes
     WHERE drillhole_id = ? AND deleted_at IS NULL
     ORDER BY box_number`,
    [drillholeId],
  );
  return (rows as unknown as BoxRow[]).map(rowToBox);
}

export type CreateBoxResult =
  | { outcome: 'created'; box: FieldCoreBox; warnings: string[] }
  | { outcome: 'invalid'; result: CoreValidationResult }
  // Warnings (an overlap, a gap) don't block saving, but the caller has to
  // confirm them first — pass `acceptWarnings: true` to save anyway.
  | { outcome: 'needs-confirmation'; warnings: string[] };

export async function createBox(
  drillholeId: string,
  input: CoreBoxInput,
  options: { acceptWarnings?: boolean } = {},
): Promise<CreateBoxResult> {
  const existing = await listBoxes(drillholeId);
  const result = validateBoxInput(input, existing);
  if (!result.valid) {
    return { outcome: 'invalid', result };
  }
  if (result.warnings.length > 0 && !options.acceptWarnings) {
    return { outcome: 'needs-confirmation', warnings: result.warnings };
  }

  const db = await getDatabase();
  const id = newId();
  const timestamp = nowIso();
  await db.execute(
    `INSERT INTO core_boxes (
      id, drillhole_id, box_number, from_m, to_m, note,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      drillholeId,
      input.boxNumber,
      input.fromM,
      input.toM,
      input.note?.trim() || null,
      timestamp,
      timestamp,
    ],
  );

  const { rows } = await db.execute('SELECT * FROM core_boxes WHERE id = ?', [
    id,
  ]);
  const row = (rows as unknown as BoxRow[])[0];
  if (!row) {
    throw new Error(`Failed to read back newly created core box ${id}.`);
  }
  return { outcome: 'created', box: rowToBox(row), warnings: result.warnings };
}

export async function deleteBox(id: string): Promise<void> {
  const db = await getDatabase();
  const timestamp = nowIso();
  await db.execute(
    `UPDATE core_boxes SET deleted_at = ?, updated_at = ?, version = version + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [timestamp, timestamp, id],
  );
}

// --- Runs (E3-2, E3-3) -------------------------------------------------------

export async function listRuns(drillholeId: string): Promise<FieldCoreRun[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT * FROM core_runs
     WHERE drillhole_id = ? AND deleted_at IS NULL
     ORDER BY from_m, to_m`,
    [drillholeId],
  );
  return (rows as unknown as RunRow[]).map(rowToRun);
}

export type CreateRunResult =
  | { outcome: 'created'; run: FieldCoreRun; warnings: string[] }
  | { outcome: 'invalid'; result: CoreValidationResult }
  | { outcome: 'needs-confirmation'; warnings: string[] };

export async function createRun(
  drillholeId: string,
  input: CoreRunInput,
  options: { acceptWarnings?: boolean } = {},
): Promise<CreateRunResult> {
  const existing = await listRuns(drillholeId);
  // The hole's final depth, so a run past it is flagged before saving.
  const { rows: holeRows } = await (await getDatabase()).execute(
    'SELECT actual_final_depth_m FROM drillholes WHERE id = ?',
    [drillholeId],
  );
  const hole = (holeRows as unknown as { actual_final_depth_m: number | null }[])[0];
  const result = validateRunInput(input, existing, {
    actualFinalDepthM: hole?.actual_final_depth_m ?? null,
  });
  if (!result.valid) {
    return { outcome: 'invalid', result };
  }
  if (result.warnings.length > 0 && !options.acceptWarnings) {
    return { outcome: 'needs-confirmation', warnings: result.warnings };
  }

  const db = await getDatabase();
  const id = newId();
  const timestamp = nowIso();
  await db.execute(
    `INSERT INTO core_runs (
      id, drillhole_id, from_m, to_m, recovered_m, rqd_pieces_m,
      created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      drillholeId,
      input.fromM,
      input.toM,
      input.recoveredM,
      input.rqdPiecesM ?? null,
      timestamp,
      timestamp,
    ],
  );

  const { rows } = await db.execute('SELECT * FROM core_runs WHERE id = ?', [
    id,
  ]);
  const row = (rows as unknown as RunRow[])[0];
  if (!row) {
    throw new Error(`Failed to read back newly created core run ${id}.`);
  }
  return { outcome: 'created', run: rowToRun(row), warnings: result.warnings };
}

export async function deleteRun(id: string): Promise<void> {
  const db = await getDatabase();
  const timestamp = nowIso();
  await db.execute(
    `UPDATE core_runs SET deleted_at = ?, updated_at = ?, version = version + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [timestamp, timestamp, id],
  );
}
