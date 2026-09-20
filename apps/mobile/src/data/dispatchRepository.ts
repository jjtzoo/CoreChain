import {
  canJoinDispatch,
  dispatchSheet,
  nextDispatchNumber,
  validateDispatch,
  type CustodyError,
  type DispatchSheet,
  type DispatchStatus,
  type FieldDispatch,
  type FieldSample,
  type SampleStatus,
  type SampleType,
} from '@corechain/domain';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { refreshSampleStatus } from './custodyRepository';
import { getDatabase, type AppDatabase } from './database';
import { newId, nowIso } from './ids';
import { getProject } from './projectsRepository';

// E7-2 / E7-3: lab dispatches. A dispatch is a batch of bagged samples going to
// one laboratory. It stays open (samples can be added and taken out) until it is
// handed over, which writes a "dispatched" custody event on every sample in it.

type Tx = { execute: AppDatabase['execute'] };

type DispatchRow = {
  id: string;
  project_id: string;
  dispatch_number: string;
  laboratory: string;
  preparation_request: string | null;
  handover_at: string | null;
  status: DispatchStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  deleted_at: string | null;
};

function rowToDispatch(row: DispatchRow): FieldDispatch {
  return {
    id: row.id,
    projectId: row.project_id,
    dispatchNumber: row.dispatch_number,
    laboratory: row.laboratory,
    preparationRequest: row.preparation_request,
    handoverAt: row.handover_at,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
    deletedAt: row.deleted_at,
  };
}

export type DispatchSummary = FieldDispatch & { sampleCount: number };

/** The project's dispatches, newest first, each with how many samples it holds. */
export async function listDispatches(
  projectId: string,
): Promise<DispatchSummary[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT d.*, (
       SELECT COUNT(*) FROM dispatch_samples ds
       WHERE ds.dispatch_id = d.id AND ds.deleted_at IS NULL
     ) AS sample_count
     FROM dispatches d
     WHERE d.project_id = ? AND d.deleted_at IS NULL
     ORDER BY d.created_at DESC`,
    [projectId],
  );
  return (rows as unknown as (DispatchRow & { sample_count: number })[]).map(
    (row) => ({ ...rowToDispatch(row), sampleCount: Number(row.sample_count) }),
  );
}

export async function getDispatch(id: string): Promise<FieldDispatch | null> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT * FROM dispatches WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  const row = (rows as unknown as DispatchRow[])[0];
  return row ? rowToDispatch(row) : null;
}

type MemberRow = {
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
  hole_id: string;
};

export type DispatchMember = FieldSample & { holeId: string };

function rowToMember(row: MemberRow): DispatchMember {
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
    holeId: row.hole_id,
  };
}

/** The samples currently in a dispatch, in sample-number order. */
export async function listDispatchSamples(
  dispatchId: string,
): Promise<DispatchMember[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT s.*, h.hole_id AS hole_id
     FROM dispatch_samples ds
     JOIN samples s ON s.id = ds.sample_id
     JOIN drillholes h ON h.id = s.drillhole_id
     WHERE ds.dispatch_id = ? AND ds.deleted_at IS NULL
     ORDER BY s.sample_number`,
    [dispatchId],
  );
  return (rows as unknown as MemberRow[]).map(rowToMember);
}

/**
 * The samples that could go into a dispatch now: bagged, not removed, and in no
 * open dispatch (which also leaves out a dispatch's own members).
 */
export async function listDispatchableSamples(
  projectId: string,
): Promise<DispatchMember[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT s.*, h.hole_id AS hole_id
     FROM samples s
     JOIN drillholes h ON h.id = s.drillhole_id
     WHERE s.project_id = ? AND s.deleted_at IS NULL AND s.status = 'bagged'
       AND s.id NOT IN (
         SELECT ds.sample_id
         FROM dispatch_samples ds
         JOIN dispatches d ON d.id = ds.dispatch_id
         WHERE ds.deleted_at IS NULL AND d.deleted_at IS NULL
           AND d.status = 'open'
       )
     ORDER BY s.sample_number`,
    [projectId],
  );
  return (rows as unknown as MemberRow[]).map(rowToMember);
}

/** Sample ids that sit in an open dispatch, other than `exceptDispatchId`. */
export async function samplesInOpenDispatches(
  projectId: string,
  exceptDispatchId: string | null = null,
): Promise<Set<string>> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT ds.sample_id
     FROM dispatch_samples ds
     JOIN dispatches d ON d.id = ds.dispatch_id
     WHERE ds.project_id = ? AND ds.deleted_at IS NULL
       AND d.deleted_at IS NULL AND d.status = 'open'
       AND d.id <> ?`,
    [projectId, exceptDispatchId ?? ''],
  );
  return new Set(
    (rows as unknown as { sample_id: string }[]).map((r) => r.sample_id),
  );
}

async function addMembers(
  tx: Tx,
  projectId: string,
  dispatchId: string,
  sampleIds: readonly string[],
  timestamp: string,
) {
  for (const sampleId of sampleIds) {
    await tx.execute(
      `INSERT INTO dispatch_samples (
        id, project_id, dispatch_id, sample_id, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [newId(), projectId, dispatchId, sampleId, timestamp, timestamp],
    );
  }
}

export type CreateDispatchResult =
  | { outcome: 'created'; dispatchId: string }
  | { outcome: 'invalid'; errors: CustodyError[] };

export async function createDispatch(
  projectId: string,
  input: {
    laboratory: string;
    preparationRequest?: string | null;
    note?: string | null;
    sampleIds: readonly string[];
  },
): Promise<CreateDispatchResult> {
  const errors = validateDispatch({
    laboratory: input.laboratory,
    sampleCount: input.sampleIds.length,
  });
  if (errors.length > 0) return { outcome: 'invalid', errors };

  const db = await getDatabase();
  const id = newId();
  await db.transaction(async (tx) => {
    // Every dispatch this phone knows of, removed ones too: a number is not reused.
    const { rows } = await tx.execute(
      'SELECT dispatch_number FROM dispatches WHERE project_id = ?',
      [projectId],
    );
    const number = nextDispatchNumber(
      (rows as unknown as { dispatch_number: string }[]).map(
        (r) => r.dispatch_number,
      ),
    );
    const timestamp = nowIso();
    await tx.execute(
      `INSERT INTO dispatches (
        id, project_id, dispatch_number, laboratory, preparation_request,
        handover_at, status, note, created_at, updated_at, version
      ) VALUES (?, ?, ?, ?, ?, NULL, 'open', ?, ?, ?, 1)`,
      [
        id,
        projectId,
        number,
        input.laboratory.trim(),
        input.preparationRequest?.trim() || null,
        input.note?.trim() || null,
        timestamp,
        timestamp,
      ],
    );
    await addMembers(tx, projectId, id, input.sampleIds, timestamp);
  });
  return { outcome: 'created', dispatchId: id };
}

/** Adds samples to a dispatch that is still open. Samples that cannot join are left out. */
export async function addSamplesToDispatch(
  dispatch: FieldDispatch,
  samples: readonly FieldSample[],
): Promise<{ added: number }> {
  if (dispatch.status !== 'open') return { added: 0 };
  const db = await getDatabase();
  const elsewhere = await samplesInOpenDispatches(
    dispatch.projectId,
    dispatch.id,
  );
  const current = new Set(
    (await listDispatchSamples(dispatch.id)).map((s) => s.id),
  );
  const joinable = samples.filter(
    (s) =>
      !current.has(s.id) && canJoinDispatch(s, elsewhere.has(s.id)).ok === true,
  );
  await db.transaction(async (tx) => {
    await addMembers(
      tx,
      dispatch.projectId,
      dispatch.id,
      joinable.map((s) => s.id),
      nowIso(),
    );
  });
  return { added: joinable.length };
}

/** Takes a sample out of a dispatch that is still open. */
export async function removeSampleFromDispatch(
  dispatchId: string,
  sampleId: string,
): Promise<void> {
  const db = await getDatabase();
  const timestamp = nowIso();
  await db.execute(
    `UPDATE dispatch_samples
     SET deleted_at = ?, updated_at = ?, version = version + 1
     WHERE dispatch_id = ? AND sample_id = ? AND deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM dispatches d WHERE d.id = ? AND d.status = 'open')`,
    [timestamp, timestamp, dispatchId, sampleId, dispatchId],
  );
}

/** Deletes a dispatch that has not been handed over, and lets its samples go free. */
export async function deleteOpenDispatch(dispatchId: string): Promise<boolean> {
  const db = await getDatabase();
  const timestamp = nowIso();
  return db.transaction(async (tx) => {
    const { rows } = await tx.execute(
      "SELECT id FROM dispatches WHERE id = ? AND status = 'open' AND deleted_at IS NULL",
      [dispatchId],
    );
    if (rows.length === 0) return false;
    await tx.execute(
      `UPDATE dispatch_samples
       SET deleted_at = ?, updated_at = ?, version = version + 1
       WHERE dispatch_id = ? AND deleted_at IS NULL`,
      [timestamp, timestamp, dispatchId],
    );
    await tx.execute(
      `UPDATE dispatches
       SET deleted_at = ?, updated_at = ?, version = version + 1
       WHERE id = ?`,
      [timestamp, timestamp, dispatchId],
    );
    return true;
  });
}

export type HandOverResult =
  | { outcome: 'handed-over'; samples: number }
  | { outcome: 'invalid'; errors: CustodyError[] }
  | { outcome: 'not-open' };

/**
 * Hands the dispatch over: it becomes "dispatched" with its handover day, and
 * every sample in it gets a "dispatched" custody event and moves to dispatched.
 * All of it happens together or not at all.
 */
export async function handOverDispatch(
  dispatchId: string,
  input: {
    handledBy: string;
    recipient: string | null;
    /** The day, as YYYY-MM-DD. */
    handoverDay: string;
    occurredAt: string;
  },
): Promise<HandOverResult> {
  const errors: CustodyError[] = [];
  if (!input.handledBy.trim()) {
    errors.push({ field: 'handledBy', message: 'Say who handed it over.' });
  }
  if (Date.parse(input.occurredAt) > Date.now() + 5 * 60_000) {
    errors.push({
      field: 'occurredAt',
      message: 'That time is in the future.',
    });
  }
  if (errors.length > 0) return { outcome: 'invalid', errors };

  const db = await getDatabase();
  return db.transaction(async (tx) => {
    const { rows } = await tx.execute(
      "SELECT * FROM dispatches WHERE id = ? AND status = 'open' AND deleted_at IS NULL",
      [dispatchId],
    );
    const dispatch = (rows as unknown as DispatchRow[])[0];
    if (!dispatch) return { outcome: 'not-open' as const };

    const members = await tx.execute(
      `SELECT ds.sample_id FROM dispatch_samples ds
       WHERE ds.dispatch_id = ? AND ds.deleted_at IS NULL`,
      [dispatchId],
    );
    const sampleIds = (members.rows as unknown as { sample_id: string }[]).map(
      (r) => r.sample_id,
    );
    if (sampleIds.length === 0) {
      return {
        outcome: 'invalid' as const,
        errors: [{ field: 'samples', message: 'Add at least one sample.' }],
      };
    }

    // Safe to repeat: a sample that already has a "dispatched" step for this
    // dispatch (one that no correction has voided) is not given a second one.
    // This lets a handover that never fully reached the server be finished
    // without duplicating the custody record.
    const recorded = await tx.execute(
      `SELECT sample_id FROM custody_events
       WHERE dispatch_id = ? AND event_type = 'dispatched'
         AND id NOT IN (
           SELECT corrects_event_id FROM custody_events
           WHERE corrects_event_id IS NOT NULL
         )`,
      [dispatchId],
    );
    const alreadyDispatched = new Set(
      (recorded.rows as unknown as { sample_id: string }[]).map(
        (r) => r.sample_id,
      ),
    );

    const timestamp = nowIso();
    for (const sampleId of sampleIds) {
      if (alreadyDispatched.has(sampleId)) {
        // Only changes the sample if its status had fallen behind its steps.
        await refreshSampleStatus(tx, sampleId, timestamp);
        continue;
      }
      await tx.execute(
        `INSERT INTO custody_events (
          id, project_id, sample_id, event_type, occurred_at, handled_by,
          location, recipient, note, dispatch_id, corrects_event_id, created_at
        ) VALUES (?, ?, ?, 'dispatched', ?, ?, NULL, ?, NULL, ?, NULL, ?)`,
        [
          newId(),
          dispatch.project_id,
          sampleId,
          input.occurredAt,
          input.handledBy.trim(),
          input.recipient?.trim() || dispatch.laboratory,
          dispatchId,
          timestamp,
        ],
      );
      await refreshSampleStatus(tx, sampleId, timestamp);
    }
    await tx.execute(
      `UPDATE dispatches
       SET status = 'dispatched', handover_at = ?, updated_at = ?, version = version + 1
       WHERE id = ?`,
      [input.handoverDay, timestamp, dispatchId],
    );
    return { outcome: 'handed-over' as const, samples: sampleIds.length };
  });
}

/** Builds the dispatch sheet from what is on the phone. */
export async function buildDispatchSheet(
  dispatchId: string,
): Promise<DispatchSheet | null> {
  const dispatch = await getDispatch(dispatchId);
  if (!dispatch) return null;
  const [project, members] = await Promise.all([
    getProject(dispatch.projectId),
    listDispatchSamples(dispatchId),
  ]);
  const db = await getDatabase();
  const { rows } = await db.execute(
    `SELECT handled_by FROM custody_events
     WHERE dispatch_id = ? AND event_type = 'dispatched'
     ORDER BY created_at LIMIT 1`,
    [dispatchId],
  );
  const handedOverBy =
    (rows as unknown as { handled_by: string }[])[0]?.handled_by ?? null;
  const numberById = new Map(members.map((m) => [m.id, m.sampleNumber]));
  // A duplicate's parent may not be in this dispatch; look it up.
  const parents = members.filter(
    (m) => m.parentSampleId && !numberById.has(m.parentSampleId),
  );
  for (const member of parents) {
    const found = await db.execute(
      'SELECT sample_number FROM samples WHERE id = ?',
      [member.parentSampleId],
    );
    const number = (found.rows as unknown as { sample_number: string }[])[0]
      ?.sample_number;
    if (number && member.parentSampleId) {
      numberById.set(member.parentSampleId, number);
    }
  }
  return dispatchSheet({
    projectName: project?.name ?? '',
    dispatch,
    handedOverBy,
    samples: members.map((m) => ({
      sampleNumber: m.sampleNumber,
      type: m.type,
      holeId: m.holeId,
      fromM: m.fromM,
      toM: m.toM,
      standardRef: m.standardRef,
      parentSampleNumber: m.parentSampleId
        ? (numberById.get(m.parentSampleId) ?? null)
        : null,
    })),
  });
}

/** Writes the dispatch sheet to a file and opens the phone's share sheet (E7-3). */
export async function shareDispatchSheet(dispatchId: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing isn’t available on this device.');
  }
  const sheet = await buildDispatchSheet(dispatchId);
  if (!sheet) throw new Error('This dispatch is no longer available.');
  const file = new File(Paths.cache, sheet.filename);
  file.create({ overwrite: true });
  file.write(sheet.csv);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Share dispatch sheet',
    UTI: 'public.comma-separated-values-text',
  });
}
