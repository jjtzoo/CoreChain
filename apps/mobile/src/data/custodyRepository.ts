import {
  canCorrectEvent,
  splitByEligibility,
  statusFromEvents,
  validateCorrection,
  validateCustodyEvent,
  type CustodyError,
  type CustodyEventInput,
  type CustodyEventType,
  type FieldCustodyEvent,
} from '@corechain/domain';
import { getDatabase, type AppDatabase } from './database';
import { newId, nowIso } from './ids';

// E7-1: the chain of custody. Events are only ever added; a mistake is
// corrected by a new "correction" event that points at it. A sample's status is
// kept in step with its events, so lists and filters stay simple.

type EventRow = {
  id: string;
  project_id: string;
  sample_id: string;
  event_type: CustodyEventType;
  occurred_at: string;
  handled_by: string;
  location: string | null;
  recipient: string | null;
  note: string | null;
  dispatch_id: string | null;
  corrects_event_id: string | null;
  created_at: string;
  created_by: string | null;
};

type Tx = { execute: AppDatabase['execute'] };

function rowToEvent(row: EventRow): FieldCustodyEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    sampleId: row.sample_id,
    type: row.event_type,
    occurredAt: row.occurred_at,
    handledBy: row.handled_by,
    location: row.location,
    recipient: row.recipient,
    note: row.note,
    dispatchId: row.dispatch_id,
    correctsEventId: row.corrects_event_id,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/** One sample's custody record, in the order it was made. */
export async function listCustodyEvents(
  sampleId: string,
): Promise<FieldCustodyEvent[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT * FROM custody_events WHERE sample_id = ? ORDER BY occurred_at, created_at',
    [sampleId],
  );
  return (rows as unknown as EventRow[]).map(rowToEvent);
}

/** Every custody event on the phone, for the "My work" totals. */
export async function listAllCustody(): Promise<FieldCustodyEvent[]> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT * FROM custody_events ORDER BY occurred_at, created_at',
  );
  return (rows as unknown as EventRow[]).map(rowToEvent);
}

/** Every custody event in the project, grouped by sample. */
export async function listProjectCustody(
  projectId: string,
): Promise<Map<string, FieldCustodyEvent[]>> {
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT * FROM custody_events WHERE project_id = ? ORDER BY occurred_at, created_at',
    [projectId],
  );
  const bySample = new Map<string, FieldCustodyEvent[]>();
  for (const row of rows as unknown as EventRow[]) {
    const event = rowToEvent(row);
    const list = bySample.get(event.sampleId);
    if (list) list.push(event);
    else bySample.set(event.sampleId, [event]);
  }
  return bySample;
}

async function eventsFor(tx: Tx, sampleId: string) {
  const { rows } = await tx.execute(
    'SELECT * FROM custody_events WHERE sample_id = ?',
    [sampleId],
  );
  return (rows as unknown as EventRow[]).map(rowToEvent);
}

/**
 * Brings a sample's stored status in line with the events that count. A change
 * of status is an ordinary edit of the sample, so it syncs like one.
 */
export async function refreshSampleStatus(
  tx: Tx,
  sampleId: string,
  timestamp: string,
): Promise<void> {
  const status = statusFromEvents(await eventsFor(tx, sampleId));
  await tx.execute(
    `UPDATE samples SET status = ?, updated_at = ?, version = version + 1
     WHERE id = ? AND status <> ?`,
    [status, timestamp, sampleId, status],
  );
}

export type RecordResult =
  | {
      outcome: 'recorded';
      recorded: number;
      skipped: { sampleId: string; reason: string }[];
    }
  | { outcome: 'invalid'; errors: CustodyError[] };

/**
 * Records one event on every selected sample that can take it, in one go.
 * Samples that cannot (already bagged, not bagged yet, already dispatched) are
 * skipped and reported, never half-recorded.
 */
export async function recordCustodyEvent(
  projectId: string,
  sampleIds: readonly string[],
  input: CustodyEventInput,
): Promise<RecordResult> {
  const errors = validateCustodyEvent(input, new Date());
  if (errors.length > 0) return { outcome: 'invalid', errors };

  const db = await getDatabase();
  return db.transaction(async (tx) => {
    const eventsBySample = new Map<string, FieldCustodyEvent[]>();
    for (const sampleId of sampleIds) {
      eventsBySample.set(sampleId, await eventsFor(tx, sampleId));
    }
    const { eligible, skipped } = splitByEligibility(
      input.type,
      sampleIds.map((id) => ({ id })),
      eventsBySample,
    );

    const timestamp = nowIso();
    for (const { id: sampleId } of eligible) {
      await tx.execute(
        `INSERT INTO custody_events (
          id, project_id, sample_id, event_type, occurred_at, handled_by,
          location, recipient, note, dispatch_id, corrects_event_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
        [
          newId(),
          projectId,
          sampleId,
          input.type,
          input.occurredAt,
          input.handledBy.trim(),
          input.location?.trim() || null,
          input.recipient?.trim() || null,
          input.note?.trim() || null,
          timestamp,
        ],
      );
      await refreshSampleStatus(tx, sampleId, timestamp);
    }
    return {
      outcome: 'recorded' as const,
      recorded: eligible.length,
      skipped: skipped.map(({ sample, reason }) => ({
        sampleId: sample.id,
        reason,
      })),
    };
  });
}

export type CorrectResult =
  | { outcome: 'corrected' }
  | { outcome: 'invalid'; errors: CustodyError[] }
  | { outcome: 'not-allowed'; reason: string };

/**
 * Cancels an earlier event by adding a correction that points at it. The
 * mistake stays on the record, marked as voided, with who corrected it and why.
 */
export async function correctCustodyEvent(
  eventId: string,
  input: { note: string; handledBy: string },
): Promise<CorrectResult> {
  const errors = validateCorrection(input);
  if (errors.length > 0) return { outcome: 'invalid', errors };

  const db = await getDatabase();
  return db.transaction(async (tx) => {
    const { rows } = await tx.execute(
      'SELECT * FROM custody_events WHERE id = ?',
      [eventId],
    );
    const original = (rows as unknown as EventRow[])[0];
    if (!original || original.event_type === 'correction') {
      return { outcome: 'not-allowed' as const, reason: 'Nothing to correct.' };
    }
    const eligibility = canCorrectEvent(
      await eventsFor(tx, original.sample_id),
      eventId,
    );
    if (!eligibility.ok) {
      return { outcome: 'not-allowed' as const, reason: eligibility.reason };
    }
    const timestamp = nowIso();
    await tx.execute(
      `INSERT INTO custody_events (
        id, project_id, sample_id, event_type, occurred_at, handled_by,
        location, recipient, note, dispatch_id, corrects_event_id, created_at
      ) VALUES (?, ?, ?, 'correction', ?, ?, NULL, NULL, ?, NULL, ?, ?)`,
      [
        newId(),
        original.project_id,
        original.sample_id,
        timestamp,
        input.handledBy.trim(),
        input.note.trim(),
        eventId,
        timestamp,
      ],
    );
    await refreshSampleStatus(tx, original.sample_id, timestamp);
    return { outcome: 'corrected' as const };
  });
}
