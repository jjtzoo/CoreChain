import { fromUrl, type GeoTIFFImage } from "geotiff";
import { PNG } from "pngjs";

// E15-2 (terrain): a shaded-relief and contour image for one project, from
// the free Copernicus GLO-30 elevation model (30 m), read in place from its
// public copy on AWS open data. The image is north-up and linear in latitude
// and longitude, so the phone places it by its four edges. It is a
// transparent overlay: dark where the ground faces away from the north-west
// light, light where it faces it, with contour lines, so it reads on the
// light and the dark theme.

const DEM_URL = "https://copernicus-dem-30m.s3.amazonaws.com";
const MARGIN_M = 1500;
const MAX_PIXELS = 1000;
const CONTOUR_M = 20;
const INDEX_CONTOUR_M = 100;
const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export type TerrainHole = {
  latitude: number;
  longitude: number;
  azimuthDeg: number | null;
  inclinationDeg: number | null;
  depthM: number | null;
};

export type TerrainBounds = { south: number; west: number; north: number; east: number };

function tileName(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  const la = String(Math.abs(lat)).padStart(2, "0");
  const lo = String(Math.abs(lon)).padStart(3, "0");
  return `Copernicus_DSM_COG_10_${ns}${la}_00_${ew}${lo}_00_DEM`;
}

/** The collars and planned hole ends, with a margin, as a box in degrees. */
export function terrainBounds(holes: readonly TerrainHole[]): TerrainBounds | null {
  if (holes.length === 0) return null;
  const midLat = holes.reduce((s, h) => s + h.latitude, 0) / holes.length;
  const mPerDegLat = rad(1) * R;
  const mPerDegLon = mPerDegLat * Math.cos(rad(midLat));
  const points = holes.flatMap((h) => {
    const out = [{ lat: h.latitude, lon: h.longitude }];
    if (h.azimuthDeg != null && h.inclinationDeg != null && h.depthM != null) {
      const plan = h.depthM * Math.cos(rad(Math.abs(h.inclinationDeg)));
      out.push({
        lat: h.latitude + (plan * Math.cos(rad(h.azimuthDeg))) / mPerDegLat,
        lon: h.longitude + (plan * Math.sin(rad(h.azimuthDeg))) / mPerDegLon,
      });
    }
    return out;
  });
  return {
    south: Math.min(...points.map((p) => p.lat)) - MARGIN_M / mPerDegLat,
    north: Math.max(...points.map((p) => p.lat)) + MARGIN_M / mPerDegLat,
    west: Math.min(...points.map((p) => p.lon)) - MARGIN_M / mPerDegLon,
    east: Math.max(...points.map((p) => p.lon)) + MARGIN_M / mPerDegLon,
  };
}

type Tile = {
  data: Float32Array | Int16Array | Uint16Array;
  x0: number;
  y0: number;
  width: number;
  originLon: number;
  originLat: number;
  resLon: number;
  resLat: number;
};

async function readTile(
  lat: number,
  lon: number,
  bounds: TerrainBounds,
): Promise<Tile | null> {
  const name = tileName(lat, lon);
  let image: GeoTIFFImage;
  try {
    const tiff = await fromUrl(`${DEM_URL}/${name}/${name}.tif`);
    image = await tiff.getImage();
  } catch {
    return null; // open sea: no tile
  }
  const [originLon, originLat] = image.getOrigin() as [number, number];
  const [resLon, resLat] = image.getResolution() as [number, number];
  const clampX = (v: number) => Math.min(image.getWidth(), Math.max(0, v));
  const clampY = (v: number) => Math.min(image.getHeight(), Math.max(0, v));
  const x0 = clampX(Math.floor((bounds.west - originLon) / resLon) - 2);
  const x1 = clampX(Math.ceil((bounds.east - originLon) / resLon) + 2);
  const y0 = clampY(Math.floor((bounds.north - originLat) / resLat) - 2);
  const y1 = clampY(Math.ceil((bounds.south - originLat) / resLat) + 2);
  if (x1 <= x0 || y1 <= y0) return null;
  const rasters = await image.readRasters({ window: [x0, y0, x1, y1] });
  return {
    data: rasters[0] as Float32Array,
    x0,
    y0,
    width: x1 - x0,
    originLon,
    originLat,
    resLon,
    resLat,
  };
}

/** Render the overlay for these bounds. Null when no elevation data covers them. */
export async function renderTerrain(
  bounds: TerrainBounds,
): Promise<{ png: Buffer; width: number; height: number } | null> {
  const tiles: Tile[] = [];
  for (let lat = Math.floor(bounds.south); lat <= Math.floor(bounds.north); lat++) {
    for (let lon = Math.floor(bounds.west); lon <= Math.floor(bounds.east); lon++) {
      const tile = await readTile(lat, lon, bounds);
      if (tile) tiles.push(tile);
    }
  }
  if (tiles.length === 0) return null;

  const midLat = (bounds.south + bounds.north) / 2;
  const widthM = rad(bounds.east - bounds.west) * R * Math.cos(rad(midLat));
  const heightM = rad(bounds.north - bounds.south) * R;
  const resM = Math.max(widthM, heightM) / MAX_PIXELS;
  const W = Math.max(2, Math.round(widthM / resM));
  const H = Math.max(2, Math.round(heightM / resM));

  const elevation = (lat: number, lon: number): number | null => {
    for (const t of tiles) {
      const fx = (lon - t.originLon) / t.resLon - t.x0 - 0.5;
      const fy = (lat - t.originLat) / t.resLat - t.y0 - 0.5;
      const ix = Math.floor(fx);
      const iy = Math.floor(fy);
      const rows = t.data.length / t.width;
      if (ix < 0 || iy < 0 || ix + 1 >= t.width || iy + 1 >= rows) continue;
      const tx = fx - ix;
      const ty = fy - iy;
      const at = (x: number, y: number) => t.data[y * t.width + x]!;
      return (
        at(ix, iy) * (1 - tx) * (1 - ty) +
        at(ix + 1, iy) * tx * (1 - ty) +
        at(ix, iy + 1) * (1 - tx) * ty +
        at(ix + 1, iy + 1) * tx * ty
      );
    }
    return null;
  };

  // Elevation on the image grid, then shade from a gradient measured over
  // the DEM's own 30 m spacing, so the 30 m cells don't show as facets.
  const z = new Float32Array(W * H).fill(Number.NaN);
  for (let j = 0; j < H; j++) {
    const lat = bounds.north - ((j + 0.5) / H) * (bounds.north - bounds.south);
    for (let i = 0; i < W; i++) {
      const lon = bounds.west + ((i + 0.5) / W) * (bounds.east - bounds.west);
      const value = elevation(lat, lon);
      if (value != null) z[j * W + i] = value;
    }
  }
  const step = Math.max(1, Math.round(30 / resM));
  const light = { x: -0.5, y: 0.5, z: Math.SQRT1_2 };
  const png = new PNG({ width: W, height: H });
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      const here = z[k]!;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      if (!Number.isNaN(here)) {
        const e = z[j * W + Math.min(W - 1, i + step)]!;
        const w = z[j * W + Math.max(0, i - step)]!;
        const n = z[Math.max(0, j - step) * W + i]!;
        const s = z[Math.min(H - 1, j + step) * W + i]!;
        const dzdx = ((e - w) / (2 * step * resM)) * 1.3;
        const dzdy = ((n - s) / (2 * step * resM)) * 1.3;
        if (Number.isFinite(dzdx) && Number.isFinite(dzdy)) {
          const shade = (-dzdx * light.x - dzdy * light.y + light.z) / Math.hypot(dzdx, dzdy, 1);
          if (shade < light.z) {
            a = Math.min(0.5, (light.z - shade) * 0.9);
          } else {
            r = g = b = 255;
            a = Math.min(0.16, (shade - light.z) * 0.9);
          }
        }
        const east = z[j * W + Math.min(W - 1, i + 1)]!;
        const south = z[Math.min(H - 1, j + 1) * W + i]!;
        const band = Math.floor(here / CONTOUR_M);
        const bandE = Number.isNaN(east) ? band : Math.floor(east / CONTOUR_M);
        const bandS = Number.isNaN(south) ? band : Math.floor(south / CONTOUR_M);
        if (band !== bandE || band !== bandS) {
          const level = Math.max(band, bandE, bandS) * CONTOUR_M;
          r = 150;
          g = 160;
          b = 152;
          a = level % INDEX_CONTOUR_M === 0 ? 0.6 : 0.32;
        }
      }
      png.data[k * 4] = r;
      png.data[k * 4 + 1] = g;
      png.data[k * 4 + 2] = b;
      png.data[k * 4 + 3] = Math.round(a * 255);
    }
  }
  return { png: PNG.sync.write(png), width: W, height: H };
}
