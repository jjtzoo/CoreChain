import * as Crypto from 'expo-crypto';
import {
  PowerSyncDatabase,
  Schema,
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
} from '@powersync/react-native';
import { getOrCreateEncryptionKey } from '@/data/encryptionKey';

// SPRINT 4 SPIKE (developer only, delete once the sync stories are built).
//
// Question: can PowerSync sync into the phone's EXISTING encrypted SQLite
// tables ("raw tables") instead of taking the tables over? This runs the whole
// path once: sign in, get a token, open the app's own database file through
// PowerSync, download a project the server holds for this user, and capture a
// local write. It leaves the database as it found it, apart from the
// downloaded rows and PowerSync's own ps_* tables.

const SITE = 'https://corechain-orpin.vercel.app';
const POWERSYNC_URL = 'https://6aaf4b9902481fb31b97fabf.powersync.journeyapps.com';
const DATABASE_FILE = 'corechain.sqlite'; // same file the app already uses
const SYNCED_TABLES = ['projects', 'drillholes'];
const TRIGGER_OPS = ['INSERT', 'UPDATE', 'DELETE'] as const;

type Log = (line: string) => void;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function signIn(email: string, password: string, log: Log): Promise<string> {
  const response = await fetch(`${SITE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`sign-in refused (${response.status})`);
  }
  const setCookie = response.headers.get('set-cookie') ?? '';
  const cookie = setCookie.match(/((?:__Secure-)?better-auth\.session_token=[^;]+)/)?.[1];
  if (!cookie) {
    throw new Error('sign-in worked but no session cookie came back');
  }
  log('1. signed in');
  return cookie;
}

export async function runSyncSpike(email: string, password: string, log: Log): Promise<void> {
  const cookie = await signIn(email, password, log);

  const schema = new Schema({});
  // "Inferred" raw tables: PowerSync reads the table's own columns to build its
  // insert/delete statements, so the existing tables need no changes.
  schema.withRawTables(Object.fromEntries(SYNCED_TABLES.map((name) => [name, { schema: {} }])));

  const db = new PowerSyncDatabase({
    schema,
    database: {
      dbFilename: DATABASE_FILE,
      sqliteOptions: { encryptionKey: await getOrCreateEncryptionKey() },
    },
  });
  await db.init();
  log('2. opened the encrypted app database through PowerSync');

  const version = await db.get<{ user_version: number }>('PRAGMA user_version');
  log(`   user_version is ${version.user_version} (the app migration counter)`);

  const triggerNames: string[] = [];
  const uploads: string[] = [];
  try {
    for (const table of schema.rawTables) {
      for (const op of TRIGGER_OPS) {
        const name = `spike_${table.name}_${op.toLowerCase()}`;
        await db.execute('SELECT powersync_create_raw_table_crud_trigger(?, ?, ?)', [
          JSON.stringify(Schema.rawTableToJson(table)),
          name,
          op,
        ]);
        triggerNames.push(name);
      }
    }
    log(`3. installed ${triggerNames.length} change-capture triggers`);

    const connector: PowerSyncBackendConnector = {
      async fetchCredentials() {
        const response = await fetch(`${SITE}/api/auth/token`, {
          headers: { Cookie: cookie, Origin: SITE },
        });
        if (!response.ok) throw new Error(`token request failed (${response.status})`);
        const { token } = (await response.json()) as { token: string };
        return { endpoint: POWERSYNC_URL, token };
      },
      async uploadData(database: AbstractPowerSyncDatabase) {
        const transaction = await database.getNextCrudTransaction();
        if (!transaction) return;
        for (const op of transaction.crud) {
          uploads.push(`${op.op} ${op.table}`);
        }
        // The upload API does not exist yet: note the change and drop it.
        await transaction.complete();
      },
    };

    await db.connect(connector);
    log('4. connecting to PowerSync...');
    await Promise.race([
      db.waitForFirstSync(),
      wait(45000).then(() => {
        throw new Error('no first sync within 45 s');
      }),
    ]);
    log('5. first sync finished');

    for (const table of SYNCED_TABLES) {
      const rows = await db.getAll<Record<string, unknown>>(`SELECT * FROM ${table}`);
      log(`   ${table}: ${rows.length} row(s) in the app own table`);
      const first = rows[0];
      if (first) {
        const shown = [
          'id',
          'name',
          'hole_id',
          'created_at',
          'updated_at',
          'version',
          'photo_max_mb',
          'status',
        ]
          .filter((column) => column in first)
          .map((column) => `${column}=${String(first[column])}`);
        log(`   e.g. ${shown.join(', ')}`);
      }
    }

    const localId = Crypto.randomUUID();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO projects (id, name, coordinate_system, sample_prefix, next_sample_number,
         qc_standard_every_n, qc_blank_every_n, qc_duplicate_every_n, created_at, updated_at, version)
       VALUES (?, 'Spike local write', 'WGS84', 'SP', 1, 20, 20, 20, ?, ?, 1)`,
      [localId, now, now],
    );
    await wait(6000);
    await db.execute('DELETE FROM projects WHERE id = ?', [localId]);
    await wait(6000);
    log(`6. local writes captured and offered for upload: ${uploads.join(' | ') || 'NOTHING'}`);

    const own = await db.getAll<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('projects','drillholes','core_boxes','photos')",
    );
    log(`7. the app own tables are intact: ${own.map((row) => row.name).join(', ')}`);
  } finally {
    for (const name of triggerNames) {
      await db.execute(`DROP TRIGGER IF EXISTS ${name}`);
    }
    await db.disconnect();
    await db.close();
    log('8. cleaned up (triggers removed, disconnected)');
  }
}
