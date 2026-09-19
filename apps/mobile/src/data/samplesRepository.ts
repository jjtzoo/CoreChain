import {
  formatSampleNumber,
  sampleDepth,
  validateSampleInput,
  type ControlType,
  type CoreValidationResult,
  type FieldSample,
  type FieldSampleInput,
  type QcEvent,
  type SampleStatus,
  type SampleType,
} from '@corechain/domain';
import { getDatabase } from './database';
import { getDrillhole } from './drillholesRepository';
import { newId, nowIso } from './ids';
import { getProject } from './projectsRepository';

// E6: samples (primary and QC), the next device sample number, and QC-reminder
// dismissals.

type SampleRow = {
  id: string;
  project_id: string;
  drillhole_id: string;
  sample_number: string;
  sample_type: SampleType;
  from_m: number | null;
  to_m: number | null;
  standard_ref: string | null;
  parent_sample_id: string | null;
  note: string | null;
  status: SampleStatus;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};

function rowToSample(row: SampleRow): FieldSample {
  return {
    id: row.id,
    projectId: row.project_id,
    drillholeId: row.drillhole_id,
    sampleNumber: row.sample_number,
    type: row.sample_type,
    fromM: row.from_m,
    toM: row.to_m,
    standardRef: row.standard_ref,
    parentSampleId: row.parent_sample_id,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    deletedAt: row.deleted_at,
  };
}

/** Every sample in the project, oldest first. */
export async function listSamples(projectId: string): Promise<FieldSample[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT * FROM samples
     WHERE project_id = ? AND deleted_at IS NULL
     ORDER BY created_at, sample_number`,
    [projectId],
  );
  return (rows as unknown as SampleRow[]).map(rowToSample);
}

export async function listHoleSamples(
  drillholeId: string,
): Promise<FieldSample[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT * FROM samples
     WHERE drillhole_id = ? AND deleted_at IS NULL
     ORDER BY created_at, sample_number`,
    [drillholeId],
  );
  return (rows as unknown as SampleRow[]).map(rowToSample);
}

/**
 * The next device-issued sample number, from the project's counter (E1-2).
 * Sprint 4's device-issued blocks (E6-4) replace this source.
 */
export async function suggestNextSampleNumber(
  projectId: string,
): Promise<string | null> {
  const project = await getProject(projectId);
  return project
    ? formatSampleNumber(project.samplePrefix, project.nextSampleNumber)
    : null;
}

async function allSampleNumbers(projectId: string): Promise<string[]> {
  const db = await getDatabase();
  // Including deleted samples: a number is never reused.
  const { rows } = await db.execute(
    'SELECT sample_number FROM samples WHERE project_id = ?',
    [projectId],
  );
  return (rows as unknown as { sample_number: string }[]).map(
    (r) => r.sample_number,
  );
}

export type CreateSampleResult =
  | { outcome: 'created'; sample: FieldSample }
  | { outcome: 'invalid'; result: CoreValidationResult };

/**
 * E6-1 / E6-2: creates a sample. `usedSuggestedNumber` says the number is the
 * device's next one, so the project's counter moves on; a typed pre-printed tag
 * leaves the counter alone. A duplicate takes its parent's depth.
 */
export async function createSample(
  projectId: string,
  drillholeId: string,
  input: FieldSampleInput,
  options: { usedSuggestedNumber: boolean },
): Promise<CreateSampleResult> {
  const drillhole = await getDrillhole(drillholeId);
  if (!drillhole) {
    throw new Error(`Drillhole ${drillholeId} not found.`);
  }

  const [existingNumbers, holeSamples] = await Promise.all([
    allSampleNumbers(projectId),
    listHoleSamples(drillholeId),
  ]);
  const result = validateSampleInput(input, {
    holeDepthM: drillhole.actualFinalDepthM ?? drillhole.plannedDepthM,
    existingNumbers,
    holeSamples,
  });
  if (!result.valid) {
    return { outcome: 'invalid', result };
  }

  const parent =
    input.type === 'duplicate'
      ? (holeSamples.find((s) => s.id === input.parentSampleId) ?? null)
      : null;
  const depth = sampleDepth(input, parent);

  const db = await getDatabase();
  const id = newId();
  const timestamp = nowIso();

  await db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO samples (
        id, project_id, drillhole_id, sample_number, sample_type, from_m, to_m,
        standard_ref, parent_sample_id, note, status,
        created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'created', ?, ?, 1)`,
      [
        id,
        projectId,
        drillholeId,
        input.sampleNumber.trim(),
        input.type,
        depth.fromM,
        depth.toM,
        input.type === 'standard' ? input.standardRef?.trim() || null : null,
        input.type === 'duplicate' ? (input.parentSampleId ?? null) : null,
        input.note?.trim() || null,
        timestamp,
        timestamp,
      ],
    );
    if (options.usedSuggestedNumber) {
      await tx.execute(
        `UPDATE projects
         SET next_sample_number = next_sample_number + 1,
             updated_at = ?, version = version + 1
         WHERE id = ?`,
        [timestamp, projectId],
      );
    }
  });

  const { rows } = await db.execute('SELECT * FROM samples WHERE id = ?', [id]);
  const row = (rows as unknown as SampleRow[])[0];
  if (!row) {
    throw new Error(`Failed to read back newly created sample ${id}.`);
  }
  return { outcome: 'created', sample: rowToSample(row) };
}

export type DeleteSampleResult =
  | { outcome: 'deleted' }
  | { outcome: 'has-duplicates' };

/**
 * Deletes a sample (soft delete; its number stays reserved). A primary sample
 * that a field duplicate points at can't be deleted until the duplicate is.
 */
export async function deleteSample(id: string): Promise<DeleteSampleResult> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT COUNT(*) AS n FROM samples
     WHERE parent_sample_id = ? AND deleted_at IS NULL`,
    [id],
  );
  if (Number((rows as unknown as { n: number }[])[0]?.n ?? 0) > 0) {
    return { outcome: 'has-duplicates' };
  }

  const timestamp = nowIso();
  await db.execute(
    `UPDATE samples SET deleted_at = ?, updated_at = ?, version = version + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [timestamp, timestamp, id],
  );
  return { outcome: 'deleted' };
}

// --- QC reminders (E6-2) ----------------------------------------------------

/** The project's samples and dismissals as one chronological event list. */
export async function listQcEvents(projectId: string): Promise<QcEvent[]> {
  const db = await getDatabase();
  const [samples, dismissals] = await Promise.all([
    db.execute(
      `SELECT sample_type, created_at FROM samples
       WHERE project_id = ? AND deleted_at IS NULL`,
      [projectId],
    ),
    db.execute(
      'SELECT control_type, created_at FROM qc_dismissals WHERE project_id = ?',
      [projectId],
    ),
  ]);

  const events: { at: string; event: QcEvent }[] = [
    ...(samples.rows as unknown as { sample_type: SampleType; created_at: string }[]).map(
      (r) => ({
        at: r.created_at,
        event: { kind: 'sample', type: r.sample_type } as QcEvent,
      }),
    ),
    ...(dismissals.rows as unknown as { control_type: ControlType; created_at: string }[]).map(
      (r) => ({
        at: r.created_at,
        event: { kind: 'dismissal', controlType: r.control_type } as QcEvent,
      }),
    ),
  ];
  return events.sort((a, b) => a.at.localeCompare(b.at)).map((e) => e.event);
}

export type DismissResult =
  | { outcome: 'dismissed' }
  | { outcome: 'reason-required' };

/** E6-2: a reminder can be dismissed, but only with a reason. */
export async function dismissQcReminder(
  projectId: string,
  controlType: ControlType,
  reason: string,
): Promise<DismissResult> {
  if (reason.trim().length === 0) {
    return { outcome: 'reason-required' };
  }
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO qc_dismissals (id, project_id, control_type, reason, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [newId(), projectId, controlType, reason.trim(), nowIso()],
  );
  return { outcome: 'dismissed' };
}
