import {
  validateIntervalInput,
  type CoreValidationResult,
  type LogInterval,
  type LogIntervalInput,
} from '@corechain/domain';
import { getDatabase } from './database';
import { newId, nowIso } from './ids';

// E4-3: geological log intervals, plus the autosaved draft of the interval
// currently being typed.

type IntervalRow = {
  id: string;
  drillhole_id: string;
  from_m: number;
  to_m: number;
  lithology: string | null;
  alteration_type: string | null;
  alteration_intensity: string | null;
  mineral: string | null;
  mineral_style: string | null;
  mineral_percent: number | null;
  weathering: string | null;
  structure_type: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};

function rowToInterval(row: IntervalRow): LogInterval {
  return {
    id: row.id,
    drillholeId: row.drillhole_id,
    fromM: row.from_m,
    toM: row.to_m,
    lithology: row.lithology,
    alterationType: row.alteration_type,
    alterationIntensity: row.alteration_intensity,
    mineral: row.mineral,
    mineralStyle: row.mineral_style,
    mineralPercent: row.mineral_percent,
    weathering: row.weathering,
    structureType: row.structure_type,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    deletedAt: row.deleted_at,
  };
}

/** The hole's intervals in depth order. */
export async function listIntervals(drillholeId: string): Promise<LogInterval[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT * FROM log_intervals
     WHERE drillhole_id = ? AND deleted_at IS NULL
     ORDER BY from_m, to_m`,
    [drillholeId],
  );
  return (rows as unknown as IntervalRow[]).map(rowToInterval);
}

/** Every logged interval in a project, for the lithology dictionary. */
export async function listIntervalsByProject(projectId: string): Promise<LogInterval[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT i.* FROM log_intervals i
     JOIN drillholes d ON d.id = i.drillhole_id
     WHERE d.project_id = ? AND i.deleted_at IS NULL AND d.deleted_at IS NULL
     ORDER BY i.drillhole_id, i.from_m, i.to_m`,
    [projectId],
  );
  return (rows as unknown as IntervalRow[]).map(rowToInterval);
}

/**
 * Total metres logged per drillhole in a project, overlaps counted once — the
 * "% logged" on the drillhole list (E2-4).
 */
export async function listIntervalRangesByProject(
  projectId: string,
): Promise<Map<string, { fromM: number; toM: number }[]>> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT i.drillhole_id, i.from_m, i.to_m
     FROM log_intervals i
     JOIN drillholes d ON d.id = i.drillhole_id
     WHERE d.project_id = ? AND i.deleted_at IS NULL`,
    [projectId],
  );
  const byHole = new Map<string, { fromM: number; toM: number }[]>();
  for (const row of rows as unknown as {
    drillhole_id: string;
    from_m: number;
    to_m: number;
  }[]) {
    const list = byHole.get(row.drillhole_id) ?? [];
    list.push({ fromM: row.from_m, toM: row.to_m });
    byHole.set(row.drillhole_id, list);
  }
  return byHole;
}

export type CreateIntervalResult =
  | { outcome: 'created'; interval: LogInterval }
  | { outcome: 'invalid'; result: CoreValidationResult }
  | { outcome: 'needs-confirmation'; warnings: string[] };

export async function createInterval(
  drillholeId: string,
  input: LogIntervalInput,
  options: { acceptWarnings?: boolean } = {},
): Promise<CreateIntervalResult> {
  const existing = await listIntervals(drillholeId);
  const result = validateIntervalInput(input, existing);
  if (!result.valid) {
    return { outcome: 'invalid', result };
  }
  if (result.warnings.length > 0 && !options.acceptWarnings) {
    return { outcome: 'needs-confirmation', warnings: result.warnings };
  }

  const db = await getDatabase();
  const id = newId();
  const timestamp = nowIso();
  const clean = (value: string | null | undefined) => value?.trim() || null;

  await db.execute(
    `INSERT INTO log_intervals (
      id, drillhole_id, from_m, to_m, lithology, alteration_type,
      alteration_intensity, mineral, mineral_style, mineral_percent,
      weathering, structure_type, notes, created_at, updated_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      id,
      drillholeId,
      input.fromM,
      input.toM,
      clean(input.lithology),
      clean(input.alterationType),
      clean(input.alterationIntensity),
      clean(input.mineral),
      clean(input.mineralStyle),
      input.mineralPercent ?? null,
      clean(input.weathering),
      clean(input.structureType),
      clean(input.notes),
      timestamp,
      timestamp,
    ],
  );

  const { rows } = await db.execute('SELECT * FROM log_intervals WHERE id = ?', [
    id,
  ]);
  const row = (rows as unknown as IntervalRow[])[0];
  if (!row) {
    throw new Error(`Failed to read back newly created interval ${id}.`);
  }
  return { outcome: 'created', interval: rowToInterval(row) };
}

/** One interval, or null when it no longer exists (deleted here or by a sync). */
export async function getInterval(id: string): Promise<LogInterval | null> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT * FROM log_intervals WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  const row = (rows as unknown as IntervalRow[])[0];
  return row ? rowToInterval(row) : null;
}

export type UpdateIntervalResult =
  | { outcome: 'updated'; interval: LogInterval }
  | { outcome: 'missing' }
  | { outcome: 'invalid'; result: CoreValidationResult }
  | { outcome: 'needs-confirmation'; warnings: string[] };

/**
 * Corrects an interval already logged: a typo in a code, a wrong depth. It is
 * checked against the hole's other intervals exactly as a new one is (gaps
 * and overlaps warn, they don't block), and its version goes up so the change
 * syncs like any other edit.
 */
export async function updateInterval(
  id: string,
  input: LogIntervalInput,
  options: { acceptWarnings?: boolean } = {},
): Promise<UpdateIntervalResult> {
  const current = await getInterval(id);
  if (!current) {
    return { outcome: 'missing' };
  }
  const others = (await listIntervals(current.drillholeId)).filter(
    (interval) => interval.id !== id,
  );
  const result = validateIntervalInput(input, others);
  if (!result.valid) {
    return { outcome: 'invalid', result };
  }
  if (result.warnings.length > 0 && !options.acceptWarnings) {
    return { outcome: 'needs-confirmation', warnings: result.warnings };
  }

  const db = await getDatabase();
  const clean = (value: string | null | undefined) => value?.trim() || null;
  await db.execute(
    `UPDATE log_intervals SET
      from_m = ?, to_m = ?, lithology = ?, alteration_type = ?,
      alteration_intensity = ?, mineral = ?, mineral_style = ?,
      mineral_percent = ?, weathering = ?, structure_type = ?, notes = ?,
      updated_at = ?, version = version + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [
      input.fromM,
      input.toM,
      clean(input.lithology),
      clean(input.alterationType),
      clean(input.alterationIntensity),
      clean(input.mineral),
      clean(input.mineralStyle),
      input.mineralPercent ?? null,
      clean(input.weathering),
      clean(input.structureType),
      clean(input.notes),
      nowIso(),
      id,
    ],
  );

  const updated = await getInterval(id);
  return updated
    ? { outcome: 'updated', interval: updated }
    : { outcome: 'missing' };
}

export async function deleteInterval(id: string): Promise<void> {
  const db = await getDatabase();
  const timestamp = nowIso();
  await db.execute(
    `UPDATE log_intervals SET deleted_at = ?, updated_at = ?, version = version + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [timestamp, timestamp, id],
  );
}

// --- Autosaved draft (E4-3) -------------------------------------------------

export type IntervalDraft = Record<string, string>;

export async function loadDraft(
  drillholeId: string,
): Promise<IntervalDraft | null> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT draft_json FROM log_drafts WHERE drillhole_id = ?',
    [drillholeId],
  );
  const json = (rows as unknown as { draft_json: string }[])[0]?.draft_json;
  if (!json) {
    return null;
  }
  try {
    return JSON.parse(json) as IntervalDraft;
  } catch {
    return null;
  }
}

export async function saveDraft(
  drillholeId: string,
  draft: IntervalDraft,
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO log_drafts (drillhole_id, draft_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT (drillhole_id) DO UPDATE SET
       draft_json = excluded.draft_json, updated_at = excluded.updated_at`,
    [drillholeId, JSON.stringify(draft), nowIso()],
  );
}

export async function clearDraft(drillholeId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM log_drafts WHERE drillhole_id = ?', [
    drillholeId,
  ]);
}
