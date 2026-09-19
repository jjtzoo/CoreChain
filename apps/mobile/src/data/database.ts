import { open, type DB } from '@op-engineering/op-sqlite';
import { getOrCreateEncryptionKey } from './encryptionKey';
import { MIGRATIONS } from './migrations';

// NOT YET VERIFIED ON A DEVICE. This module typechecks and matches
// op-sqlite's documented API (open({name, encryptionKey}), db.execute,
// db.executeBatch), but no Android SDK/emulator was available when it was
// written (see the Sprint 0 outcome in
// docs/product/corechain-mobile-mvp-scrum-plan.md). Opening an encrypted
// database, running these migrations, and reading/writing a row for real is
// the first thing to confirm once a device is available — that's what makes
// E8-1 actually Done, not just typechecked.

const DATABASE_NAME = 'corechain.sqlite';

let dbPromise: Promise<DB> | null = null;

async function runMigrations(db: DB): Promise<void> {
  const { rows } = await db.execute('PRAGMA user_version');
  const currentVersion = Number(rows?.[0]?.user_version ?? 0);

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version,
  );

  for (const migration of pending) {
    await db.executeBatch([...migration.commands]);
    // PRAGMA user_version doesn't accept bound parameters; the version
    // number comes from our own fixed migration list, never user input.
    await db.execute(`PRAGMA user_version = ${migration.version}`);
  }
}

async function openDatabase(): Promise<DB> {
  const encryptionKey = await getOrCreateEncryptionKey();
  const db = open({ name: DATABASE_NAME, encryptionKey });
  await runMigrations(db);
  return db;
}

/**
 * Returns the app's single encrypted database connection, opening and
 * migrating it on first call. Safe to call from multiple places — the
 * connection is only opened once per app session.
 */
export function getDatabase(): Promise<DB> {
  if (!dbPromise) {
    dbPromise = openDatabase();
  }
  return dbPromise;
}
