import type {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
} from '@powersync/react-native';

import { POWERSYNC_URL, SERVER_URL } from '@/config';
import { getDeviceId, registerDevice } from './device';
import { recordIssue } from './issues';
import { PHONE_READ_ONLY_COLUMNS, SET_ONCE_COLUMNS } from './syncedTables';

// The phone's two-way link to the server (E8-2, E8-3): PowerSync downloads the
// person's records, and this connector uploads what they changed on the phone.

// The server accepts up to 200 changes per request; smaller batches finish
// well inside its time limit even on a weak connection.
const UPLOAD_BATCH = 50;

// A request that never gets a response must not wedge the upload queue
// forever: PowerSync waits for this call to settle before it will try again.
const REQUEST_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

type WireOperation = {
  op: string;
  table: string;
  id: string;
  data: Record<string, unknown>;
};

type WireResult = {
  id: string | null;
  table: string | null;
  status: 'applied' | 'duplicate' | 'conflict' | 'rejected';
  reason?: string;
  detail?: string;
  /** For a conflict: the server's current values for the changed columns. */
  serverValues?: Record<string, unknown>;
};

function toWireOperation(entry: CrudEntry): WireOperation {
  const data = { ...(entry.opData ?? {}) };
  if (entry.op === 'PATCH') {
    // Columns fixed at creation are never a change; the server refuses them.
    for (const column of SET_ONCE_COLUMNS) delete data[column];
  }
  // Read-only columns ride along on a raw-table row (PowerSync captures the
  // whole row, not just what changed), but the server refuses to see them
  // come from the phone at all, on a create as much as a change.
  for (const column of PHONE_READ_ONLY_COLUMNS) delete data[column];
  return { op: entry.op, table: entry.table, id: entry.id, data };
}

export class CoreChainConnector implements PowerSyncBackendConnector {
  private registered = false;

  /** `getCookie` is read on every call, so a refreshed session is picked up without reconnecting. */
  constructor(private readonly getCookie: () => string | null) {}

  async fetchCredentials() {
    const cookie = this.getCookie();
    if (!cookie) throw new Error('Not signed in.');
    console.log('[Sync] fetching PowerSync token');
    const response = await fetchWithTimeout(`${SERVER_URL}/api/auth/token`, {
      headers: { Cookie: cookie, Origin: SERVER_URL },
    });
    if (!response.ok)
      throw new Error(`Sign-in token refused (${response.status}).`);
    const { token } = (await response.json()) as { token: string };
    console.log('[Sync] got PowerSync token');
    return { endpoint: POWERSYNC_URL, token };
  }

  async uploadData(database: AbstractPowerSyncDatabase) {
    console.log('[Sync] uploadData starting');
    for (;;) {
      const batch = await database.getCrudBatch(UPLOAD_BATCH);
      if (!batch) {
        console.log('[Sync] uploadData: queue empty, done');
        return;
      }
      console.log(`[Sync] uploadData: batch of ${batch.crud.length}`);
      // The app never deletes a record, it marks it removed (an edit). A
      // removal in the queue is the phone tidying up after the server took a
      // record away, which is not the geologist's doing and must not be sent
      // back.
      const ops = batch.crud
        .filter((entry) => entry.op !== 'DELETE')
        .map(toWireOperation);
      const results = ops.length > 0 ? await this.send(ops) : [];
      // Every change is answered, so the queue always moves on. One the server
      // cannot take is kept on the phone and reported, never retried forever.
      for (const [index, result] of results.entries()) {
        if (result.status === 'rejected' || result.status === 'conflict') {
          const conflict = result.status === 'conflict';
          await recordIssue({
            tableName: result.table,
            recordId: result.id,
            status: result.status,
            reason: result.reason,
            detail: result.detail,
            // A conflict keeps both versions so the person can choose (E8-5).
            mine: conflict ? ops[index]?.data : undefined,
            theirs: conflict ? result.serverValues : undefined,
          });
        }
      }
      console.log(`[Sync] uploadData: batch sent, ${results.length} results`);
      await batch.complete();
      console.log('[Sync] uploadData: batch.complete() done');
    }
  }

  private async send(ops: WireOperation[]): Promise<WireResult[]> {
    const cookie = this.getCookie();
    if (!cookie) throw new Error('Not signed in.');
    if (!this.registered) await this.register(cookie);

    let response = await this.post(cookie, ops);
    if (response.status === 404) {
      // The server does not know this phone (yet): introduce it and try once more.
      await this.register(cookie);
      response = await this.post(cookie, ops);
    }
    if (!response.ok) throw new Error(`Upload refused (${response.status}).`);
    const body = (await response.json()) as { results?: WireResult[] };
    if (!Array.isArray(body.results) || body.results.length !== ops.length) {
      throw new Error('Upload answer did not match what was sent.');
    }
    return body.results;
  }

  private async register(cookie: string) {
    console.log('[Sync] registering device');
    const outcome = await registerDevice(cookie);
    if (!outcome.ok)
      throw new Error(`Device not registered (${outcome.reason}).`);
    this.registered = true;
    console.log('[Sync] device registered');
  }

  private async post(cookie: string, ops: WireOperation[]) {
    console.log(`[Sync] POST /api/sync/upload with ${ops.length} ops`);
    const response = await fetchWithTimeout(`${SERVER_URL}/api/sync/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ deviceId: await getDeviceId(), ops }),
    });
    console.log(`[Sync] POST /api/sync/upload -> ${response.status}`);
    return response;
  }
}
