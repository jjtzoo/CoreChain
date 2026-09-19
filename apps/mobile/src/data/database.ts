import { open, type DB } from '@op-engineering/op-sqlite';
import { getOrCreateEncryptionKey } from './encryptionKey';
import { MIGRATIONS } from './migrations';

// Verified on a physical Android phone (see the Sprint 1 outcome in
// docs/product/corechain-mobile-mvp-scrum-plan.md): migrations run, and
// reads/writes survive an app kill.
//
// op-sqlite silently ignores `encryptionKey` when SQLCipher isn't compiled in,
// so a successful open proves nothing about encryption. The flag lives in
// apps/mobile/package.json ("op-sqlite": { "sqlcipher": true }) — NOT the repo
// root — and the only real check is that the database file on the device does
// not start with the plain "SQLite format 3" header.

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
