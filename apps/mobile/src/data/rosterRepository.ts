import { SERVER_URL } from '@/config';
import { getDatabase } from './database';
import { nowIso } from './ids';

// Sprint 6: a cached, phone-local copy of "who's on my team" (id -> name),
// refreshed from GET /api/roster. Not a PowerSync-synced table: it is a
// small, refreshable read cache, the same idea as the min app version cached
// in the keystore (sync/device.ts), not a record the phone owns or edits.
// Used to turn a synced `created_by` account id into a name to show, e.g. the
// custody timeline's "logged by".

const REQUEST_TIMEOUT_MS = 15_000;

/** Fetches the roster and replaces the cache. Best effort: never throws. */
export async function refreshRoster(cookie: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${SERVER_URL}/api/roster`, {
      headers: { Cookie: cookie },
      signal: controller.signal,
    });
    if (!response.ok) return;
    const body = (await response.json().catch(() => null)) as {
      roster?: { id?: unknown; name?: unknown }[];
    } | null;
    const roster = (body?.roster ?? []).filter(
      (entry): entry is { id: string; name: string } =>
        typeof entry.id === 'string' && typeof entry.name === 'string',
    );
    if (roster.length === 0) return;
    const db = await getDatabase();
    const fetchedAt = nowIso();
    await db.executeBatch(
      roster.map(
        (entry) =>
          [
            `INSERT INTO team_roster (user_id, name, fetched_at) VALUES (?, ?, ?)
             ON CONFLICT (user_id) DO UPDATE SET name = excluded.name, fetched_at = excluded.fetched_at`,
            [entry.id, entry.name, fetchedAt],
          ] as const,
      ),
    );
  } catch {
    // Offline, or the server had a moment: the cache just stays as it was.
  } finally {
    clearTimeout(timer);
  }
}

/** The cached name for an account id, or null if it isn't known yet. */
export async function nameForUserId(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const db = await getDatabase();
  const { rows } = await db.execute(
    'SELECT name FROM team_roster WHERE user_id = ?',
    [userId],
  );
  const row = (rows as unknown as { name: string }[])[0];
  return row?.name ?? null;
}

/** Every cached id -> name pair, for resolving several ids at once. */
export async function loadRosterNames(): Promise<Record<string, string>> {
  const db = await getDatabase();
  const { rows } = await db.execute('SELECT user_id, name FROM team_roster');
  const result: Record<string, string> = {};
  for (const row of rows as unknown as { user_id: string; name: string }[]) {
    result[row.user_id] = row.name;
  }
  return result;
}

/** Updates the signed-in account's own name, on the server and in the cache. */
export async function updateOwnName(
  cookie: string,
  userId: string,
  name: string,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${SERVER_URL}/api/account/name`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ name }),
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO team_roster (user_id, name, fetched_at) VALUES (?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET name = excluded.name, fetched_at = excluded.fetched_at`,
      [userId, name, nowIso()],
    );
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
