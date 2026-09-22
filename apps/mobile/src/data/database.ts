import {
  PowerSyncDatabase,
  Schema,
  type AbstractPowerSyncDatabase,
} from '@powersync/react-native';
import type { Scalar } from '@op-engineering/op-sqlite';
import { getOrCreateEncryptionKey } from './encryptionKey';
import { MIGRATIONS } from './migrations';
import { SYNCED_TABLES } from '@/sync/syncedTables';

// The app's single encrypted database. It is opened through PowerSync, which
// gives the app its own SQLite tables (raw tables, decision D14) and notes every
// local change so it can be sent to the server. Once the change-capture
// triggers below exist, ONLY this connection may write to the file: a plain
// SQLite connection would fail on them. Everything therefore goes through
// `getDatabase()`.
//
// Encryption is unchanged from Sprint 1: the SQLCipher key comes from the
// phone's keystore, and a successful open proves nothing on its own (see the
// note in apps/mobile/package.json about the "op-sqlite" sqlcipher flag).

const DATABASE_FILE = 'corechain.sqlite';
const TRIGGER_OPERATIONS = ['INSERT', 'UPDATE', 'DELETE'] as const;

type Row = Record<string, unknown>;
type Command =
  readonly [sql: string] | readonly [sql: string, params: Scalar[]];

/** What a statement returns: the rows it read, and how many it changed. */
export type QueryResult = { rows: Row[]; rowsAffected: number };

/** The small slice of database the repositories use. */
export type AppDatabase = {
  execute(sql: string, params?: Scalar[]): Promise<QueryResult>;
  /** Runs the commands in order, all or nothing. */
  executeBatch(commands: readonly Command[]): Promise<void>;
  transaction<T>(
    work: (tx: { execute: AppDatabase['execute'] }) => Promise<T>,
  ): Promise<T>;
};

let opened: Promise<{ sync: PowerSyncDatabase; app: AppDatabase }> | null =
  null;

const READ = /^\s*(select|with|pragma\s+user_version\s*;?\s*$)/i;

function asRows(result: { rows?: { _array?: unknown[] } }): Row[] {
  return (result.rows?._array ?? []) as Row[];
}

async function runMigrations(db: AbstractPowerSyncDatabase): Promise<void> {
  const current = await db.get<{ user_version: number }>('PRAGMA user_version');
  const pending = MIGRATIONS.filter(
    (m) => m.version > current.user_version,
  ).sort((a, b) => a.version - b.version);
  for (const migration of pending) {
    // One transaction per migration, version bump included: a migration either
    // lands completely or not at all.
    try {
      await db.writeTransaction(async (tx) => {
        for (const [sql, params] of migration.commands) {
          await tx.execute(sql, (params ?? []) as unknown[]);
        }
        // PRAGMA doesn't take bound parameters; the number is from our own fixed list.
        await tx.execute(`PRAGMA user_version = ${migration.version}`);
      });
    } catch (error) {
      console.log(
        `[Migrate] version ${migration.version} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}

function rawTableSchema(): Schema {
  const schema = new Schema({});
  // "Inferred" raw tables: PowerSync reads each table's own columns, so the
  // tables the app already has need no changes.
  schema.withRawTables(
    Object.fromEntries(SYNCED_TABLES.map((name) => [name, { schema: {} }])),
  );
  return schema;
}

/** Makes every local change to a synced table land in PowerSync's upload queue. Safe to repeat. */
async function installChangeCapture(
  db: AbstractPowerSyncDatabase,
  schema: Schema,
): Promise<void> {
  for (const table of schema.rawTables) {
    const description = JSON.stringify(Schema.rawTableToJson(table));
    for (const operation of TRIGGER_OPERATIONS) {
      const name = `cc_capture_${table.name}_${operation.toLowerCase()}`;
      await db.execute(`DROP TRIGGER IF EXISTS ${name}`);
      await db.execute(
        'SELECT powersync_create_raw_table_crud_trigger(?, ?, ?)',
        [description, name, operation],
      );
    }
  }
}

async function open() {
  const sync = new PowerSyncDatabase({
    // Empty for now: the raw tables can only be described once they exist.
    schema: new Schema({}),
    database: {
      dbFilename: DATABASE_FILE,
      sqliteOptions: { encryptionKey: await getOrCreateEncryptionKey() },
    },
  });
  await sync.init();
  await runMigrations(sync);
  const schema = rawTableSchema();
  await sync.updateSchema(schema);
  await installChangeCapture(sync, schema);

  const execute: AppDatabase['execute'] = async (sql, params = []) => {
    if (READ.test(sql)) {
      return { rows: await sync.getAll<Row>(sql, params), rowsAffected: 0 };
    }
    const result = await sync.execute(sql, params);
    return { rows: asRows(result), rowsAffected: result.rowsAffected ?? 0 };
  };

  const app: AppDatabase = {
    execute,
    async executeBatch(commands) {
      await sync.writeTransaction(async (tx) => {
        for (const [sql, params] of commands) {
          await tx.execute(sql, (params ?? []) as unknown[]);
        }
      });
    },
    transaction(work) {
      return sync.writeTransaction((tx) =>
        work({
          async execute(sql, params = []) {
            const result = await tx.execute(sql, params);
            return {
              rows: asRows(result),
              rowsAffected: result.rowsAffected ?? 0,
            };
          },
        }),
      );
    },
  };
  return { sync, app };
}

function ensureOpen() {
  if (!opened) {
    opened = open().catch((error) => {
      opened = null; // let the next call try again
      throw error;
    });
  }
  return opened;
}

/**
 * The app's database, opened and migrated on first use. Safe to call from
 * anywhere: it is opened once per app session.
 */
export async function getDatabase(): Promise<AppDatabase> {
  return (await ensureOpen()).app;
}

/** The same database as PowerSync sees it: for the sync layer only. */
export async function getSyncDatabase(): Promise<PowerSyncDatabase> {
  return (await ensureOpen()).sync;
}

/**
 * Every row on this phone, once, as if it had just been created here. Used the
 * first time an account signs in on a phone that already holds work from before
 * sync existed: the server does not have it yet, so it must be sent. Rows the
 * server already holds are recognised by their id and left alone.
 */
export async function queueAllLocalRowsForUpload(): Promise<void> {
  const { sync } = await ensureOpen();
  await sync.writeTransaction(async (tx) => {
    for (const table of SYNCED_TABLES) {
      // INSERT OR REPLACE fires the insert trigger, which queues a whole-row upload.
      await tx.execute(
        `CREATE TEMP TABLE adopt_copy AS SELECT * FROM ${table}`,
      );
      await tx.execute(
        `INSERT OR REPLACE INTO ${table} SELECT * FROM adopt_copy`,
      );
      await tx.execute('DROP TABLE adopt_copy');
    }
  });
}

/**
 * Removes every synced record, and everything waiting to be sent, from this
 * phone. For a phone handed to a different account. The caller must already
 * have checked that nothing is waiting to be sent.
 */
export async function wipeSyncedData(): Promise<void> {
  const { sync } = await ensureOpen();
  const schema = rawTableSchema();
  // Stop talking to the server first, so nothing is sent or received mid-wipe.
  await sync.disconnect();
  // Switch the change capture off first, so the deletes are not queued as changes.
  for (const table of schema.rawTables) {
    for (const operation of TRIGGER_OPERATIONS) {
      await sync.execute(
        `DROP TRIGGER IF EXISTS cc_capture_${table.name}_${operation.toLowerCase()}`,
      );
    }
  }
  await sync.writeTransaction(async (tx) => {
    for (const table of [...SYNCED_TABLES].reverse()) {
      await tx.execute(`DELETE FROM ${table}`);
    }
    await tx.execute('DELETE FROM log_drafts');
    await tx.execute('DELETE FROM sync_issues');
    await tx.execute('DELETE FROM photo_uploads');
    await tx.execute('DELETE FROM sample_blocks');
    await tx.execute('DELETE FROM feedback_outbox');
  });
  await sync.disconnectAndClear();
  await installChangeCapture(sync, schema);
  try {
    // Hand the freed space back, so removed records do not linger in the file.
    await sync.execute('VACUUM');
  } catch {
    // Housekeeping only: the records are already gone from every table.
  }
}
