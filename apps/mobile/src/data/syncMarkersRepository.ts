import { getDatabase } from './database';
import { markersQuery, type MarkerKind } from './syncMarkersQuery';

export type { MarkerKind };

// E8-4: which records have changes the server has not confirmed (waiting) or
// refused (attention). A change to a box, an interval, a photo or a custody step
// marks the hole or sample it belongs to as well, so a list row can say "waiting"
// for the whole record and not only for its own fields.

export type MarkerSets = Record<MarkerKind, Set<string>>;

export function emptyMarkers(): MarkerSets {
  return {
    project: new Set(),
    drillhole: new Set(),
    sample: new Set(),
    dispatch: new Set(),
  };
}

async function load(source: string): Promise<MarkerSets> {
  const db = await getDatabase();
  const { rows } = await db.execute(markersQuery(source));
  const sets = emptyMarkers();
  for (const row of rows as unknown as { kind: MarkerKind; id: string }[]) {
    if (row.id) sets[row.kind].add(row.id);
  }
  return sets;
}

/** Records with a change still in the upload queue. */
export const loadWaitingMarkers = () =>
  load(
    `SELECT json_extract(data, '$.type'), json_extract(data, '$.id') FROM ps_crud`,
  );

/** Records with a change the server refused and the person has not settled. */
export const loadAttentionMarkers = () =>
  load(
    `SELECT table_name, record_id FROM sync_issues
     WHERE resolved_at IS NULL AND record_id IS NOT NULL`,
  );

/** A stable text form, so a screen only redraws when the answer really changed. */
export function markersKey(sets: MarkerSets): string {
  return (Object.keys(sets) as MarkerKind[])
    .map((kind) => `${kind}:${[...sets[kind]].sort().join(',')}`)
    .join('|');
}
