// E15-1: the project's collar map. Pure geometry, no map library: collars are
// placed on a flat grid in metres around the project's centre, which is exact
// enough across a drilling programme (a few kilometres) and needs no map
// tiles, no network and no new native code on the phone.
//
// Holes drilled from one pad share almost the same collar, so collars closer
// than PAD_RADIUS_M are drawn as one marker listing every hole on it. Holes
// with no collar yet are listed separately, never dropped.
//
// Each angled hole also gets its trace: the straight line it runs along seen
// from above, from the collar in the planned azimuth, as long as the depth
// times the cosine of the dip. It is the planned direction only; there is no
// downhole survey to bend it.

/** Collars closer than this are treated as one drill pad. */
export const PAD_RADIUS_M = 10;

/** Beyond this from every collar, "you are here" is shown as a distance, not on the map. */
export const HERE_ON_MAP_WITHIN_M = 5_000;

const EARTH_RADIUS_M = 6_371_008.8;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export type LatLon = { latitude: number; longitude: number };

export type CollarMapHole<T> = {
  id: string;
  holeId: string;
  collar: LatLon | null;
  /** Planned direction and the depth to draw the trace to, when known. */
  plan?: TracePlan;
  /** Anything the caller wants back with the hole (status, progress...). */
  data: T;
};

export type TracePlan = {
  azimuthDeg: number | null;
  /** Dip, either sign: -60 and 60 both mean 60 degrees below horizontal. */
  inclinationDeg: number | null;
  depthM: number | null;
};

export type HoleTrace = {
  /** The hole's id. */
  id: string;
  /** Collar and end of hole, metres east and north of the map's centre. */
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** Length seen from above, in metres. */
  planLengthM: number;
};

export type CollarPad<T> = {
  /** Stable key: the id of the pad's first hole in hole-ID order. */
  key: string;
  /** Metres east and north of the map's centre. */
  x: number;
  y: number;
  holes: CollarMapHole<T>[];
};

export type CollarMapLayout<T> = {
  pads: CollarPad<T>[];
  /** Holes with no collar recorded yet. */
  unlocated: CollarMapHole<T>[];
  /** Traces of the located holes that are angled and have a direction and depth. */
  traces: HoleTrace[];
  /** The map's centre, or null when no hole has a collar. */
  centre: LatLon | null;
  /** Extent of the pads and traces in metres from the centre: west, south, east, north. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
};

/** Great-circle distance in metres. */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from north (0 to 360). */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** "N", "NE" ... for a bearing. */
export function compassPoint(bearing: number): (typeof COMPASS)[number] {
  return COMPASS[Math.round((((bearing % 360) + 360) % 360) / 45) % 8]!;
}

/** "140 m", "1.4 km", "812 km". */
export function formatDistance(metres: number): string {
  if (metres < 1_000) return `${Math.round(metres)} m`;
  if (metres < 10_000) return `${(metres / 1_000).toFixed(1)} km`;
  return `${Math.round(metres / 1_000)} km`;
}

/** "140 m NE of you". */
export function describeFromHere(here: LatLon, target: LatLon): string {
  const metres = distanceM(here, target);
  if (metres < 5) return "You are at this collar";
  return `${formatDistance(metres)} ${compassPoint(bearingDeg(here, target))} of you`;
}

/** Metres east and north of `centre` (equirectangular; fine over a few km). */
export function toLocalMetres(centre: LatLon, point: LatLon): { x: number; y: number } {
  const x =
    toRadians(point.longitude - centre.longitude) *
    Math.cos(toRadians(centre.latitude)) *
    EARTH_RADIUS_M;
  const y = toRadians(point.latitude - centre.latitude) * EARTH_RADIUS_M;
  return { x, y };
}

const isValidCollar = (collar: LatLon | null): collar is LatLon =>
  collar != null &&
  Number.isFinite(collar.latitude) &&
  Number.isFinite(collar.longitude) &&
  Math.abs(collar.latitude) <= 90 &&
  Math.abs(collar.longitude) <= 180;

/** Traces shorter than this from above are drawn as the collar alone. */
const MIN_TRACE_M = 1;

/**
 * Where a straight hole ends, seen from above, relative to its collar: east
 * and north in metres. Null when the direction or depth is missing, or when
 * the hole is (near) vertical.
 */
export function traceOffset(plan: TracePlan | undefined): { x: number; y: number } | null {
  if (!plan) return null;
  const { azimuthDeg, inclinationDeg, depthM } = plan;
  if (inclinationDeg == null || depthM == null || !Number.isFinite(inclinationDeg)) return null;
  if (!(depthM > 0) || Math.abs(inclinationDeg) > 90) return null;
  const planLength = depthM * Math.cos(toRadians(Math.abs(inclinationDeg)));
  if (planLength < MIN_TRACE_M) return null;
  if (azimuthDeg == null || !Number.isFinite(azimuthDeg)) return null;
  const azimuth = toRadians(azimuthDeg);
  return { x: planLength * Math.sin(azimuth), y: planLength * Math.cos(azimuth) };
}

const byHoleId = <T>(a: CollarMapHole<T>, b: CollarMapHole<T>) =>
  a.holeId.localeCompare(b.holeId, undefined, { numeric: true });

/** Collars on a flat grid, grouped into pads, plus the holes with no collar. */
export function collarMapLayout<T>(
  holes: readonly CollarMapHole<T>[],
): CollarMapLayout<T> {
  const located = holes.filter((h) => isValidCollar(h.collar)).sort(byHoleId);
  const unlocated = holes.filter((h) => !isValidCollar(h.collar)).sort(byHoleId);
  if (located.length === 0) {
    return { pads: [], unlocated, traces: [], centre: null, bounds: null };
  }

  const lats = located.map((h) => h.collar!.latitude);
  const lons = located.map((h) => h.collar!.longitude);
  const centre = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
  };

  // Greedy grouping: each hole joins the first pad within PAD_RADIUS_M of the
  // pad's first collar, so a pad never drifts wider than the radius.
  const pads: (CollarPad<T> & { anchor: { x: number; y: number } })[] = [];
  for (const hole of located) {
    const point = toLocalMetres(centre, hole.collar!);
    const pad = pads.find(
      (p) => Math.hypot(p.anchor.x - point.x, p.anchor.y - point.y) <= PAD_RADIUS_M,
    );
    if (pad) {
      pad.holes.push(hole);
      const n = pad.holes.length;
      pad.x += (point.x - pad.x) / n;
      pad.y += (point.y - pad.y) / n;
    } else {
      pads.push({ key: hole.id, x: point.x, y: point.y, holes: [hole], anchor: point });
    }
  }

  const clean = pads.map(({ anchor: _anchor, ...pad }) => pad);
  const traces: HoleTrace[] = [];
  for (const hole of located) {
    const offset = traceOffset(hole.plan);
    if (!offset) continue;
    const from = toLocalMetres(centre, hole.collar!);
    traces.push({
      id: hole.id,
      from,
      to: { x: from.x + offset.x, y: from.y + offset.y },
      planLengthM: Math.hypot(offset.x, offset.y),
    });
  }
  const xs = [...clean.map((p) => p.x), ...traces.map((t) => t.to.x)];
  const ys = [...clean.map((p) => p.y), ...traces.map((t) => t.to.y)];
  return {
    pads: clean,
    unlocated,
    traces,
    centre,
    bounds: {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    },
  };
}

/**
 * A round length for a scale bar no longer than `maxMetres`: 1, 2 or 5 times
 * a power of ten (5 m, 20 m, 100 m, 2 km...).
 */
export function scaleBarMetres(maxMetres: number): number {
  if (!(maxMetres > 0) || !Number.isFinite(maxMetres)) return 1;
  const power = 10 ** Math.floor(Math.log10(maxMetres));
  for (const step of [5, 2, 1]) {
    if (step * power <= maxMetres) return step * power;
  }
  return power;
}

/** Whether "you are here" is close enough to the collars to draw on the map. */
export function hereIsOnMap(here: LatLon, layout: CollarMapLayout<unknown>): boolean {
  if (!layout.centre || !layout.bounds) return false;
  const point = toLocalMetres(layout.centre, here);
  const { minX, minY, maxX, maxY } = layout.bounds;
  const dx = Math.max(minX - point.x, 0, point.x - maxX);
  const dy = Math.max(minY - point.y, 0, point.y - maxY);
  return Math.hypot(dx, dy) <= HERE_ON_MAP_WITHIN_M;
}

/** The nearest collar to `here`, for "the closest hole is 140 m NE". */
export function nearestPad<T>(
  here: LatLon,
  layout: CollarMapLayout<T>,
): { pad: CollarPad<T>; metres: number } | null {
  let best: { pad: CollarPad<T>; metres: number } | null = null;
  for (const pad of layout.pads) {
    const collar = pad.holes[0]!.collar!;
    const metres = distanceM(here, collar);
    if (!best || metres < best.metres) best = { pad, metres };
  }
  return best;
}
