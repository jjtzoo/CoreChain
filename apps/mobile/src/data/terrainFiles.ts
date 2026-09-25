import { Directory, File, Paths } from 'expo-file-system';

import { SERVER_URL } from '@/config';

// E15-2 (terrain): each project's terrain image for the collar map, downloaded
// once from the server and kept in the app's documents folder, so the map has
// terrain with no signal. A new download happens only when the collars have
// moved outside the area the kept image covers.

const TERRAIN_DIRECTORY = 'terrain';
const TIMEOUT_MS = 30_000;

export type TerrainBounds = { south: number; west: number; north: number; east: number };
export type Terrain = { uri: string; bounds: TerrainBounds };

function terrainDirectory(): Directory {
  const directory = new Directory(Paths.document, TERRAIN_DIRECTORY);
  if (!directory.exists) directory.create({ idempotent: true });
  return directory;
}

const imageFile = (projectId: string) => new File(terrainDirectory(), `${projectId}.png`);
const boundsFile = (projectId: string) => new File(terrainDirectory(), `${projectId}.json`);

const isBounds = (value: unknown): value is TerrainBounds =>
  typeof value === 'object' &&
  value !== null &&
  ['south', 'west', 'north', 'east'].every(
    (key) => typeof (value as Record<string, unknown>)[key] === 'number',
  );

/** The kept terrain for a project, if there is one. */
export function keptTerrain(projectId: string): Terrain | null {
  try {
    const image = imageFile(projectId);
    const meta = boundsFile(projectId);
    if (!image.exists || !meta.exists) return null;
    const bounds: unknown = JSON.parse(meta.textSync());
    return isBounds(bounds) ? { uri: image.uri, bounds } : null;
  } catch {
    return null;
  }
}

/** Whether every collar lies inside the kept image, so no new download is needed. */
export function terrainCovers(
  terrain: Terrain,
  collars: readonly { latitude: number; longitude: number }[],
): boolean {
  const { south, west, north, east } = terrain.bounds;
  return collars.every(
    (c) => c.latitude > south && c.latitude < north && c.longitude > west && c.longitude < east,
  );
}

/** Fetch the project's terrain from the server and keep it. Null when it can't. */
export async function downloadTerrain(projectId: string, cookie: string): Promise<Terrain | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${SERVER_URL}/api/projects/${projectId}/terrain`, {
      headers: { Cookie: cookie },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const bounds: unknown = JSON.parse(response.headers.get('X-Terrain-Bounds') ?? 'null');
    if (!isBounds(bounds)) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const image = imageFile(projectId);
    image.write(bytes);
    boundsFile(projectId).write(JSON.stringify(bounds));
    // A new image under the same name: a changing link makes the map reload it.
    return { uri: `${image.uri}?v=${Date.now()}`, bounds };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Removes every kept terrain image from this phone (a wipe). */
export function deleteAllTerrainFiles(): void {
  const directory = new Directory(Paths.document, TERRAIN_DIRECTORY);
  if (directory.exists) directory.delete();
}
