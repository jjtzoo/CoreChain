import { describe, expect, it } from "vitest";
import {
  PAD_RADIUS_M,
  bearingDeg,
  collarMapLayout,
  compassPoint,
  describeFromHere,
  distanceM,
  formatDistance,
  hereIsOnMap,
  nearestPad,
  scaleBarMetres,
  toLocalMetres,
  traceOffset,
  type CollarMapHole,
  type LatLon,
} from "./collarMap";

// A site in northern Mindanao; 0.001 degrees of latitude is about 111 m.
const site: LatLon = { latitude: 8.5, longitude: 125.5 };
const offset = (north: number, east: number): LatLon => ({
  latitude: site.latitude + north / 111_195,
  longitude: site.longitude + east / (111_195 * Math.cos((site.latitude * Math.PI) / 180)),
});
const hole = (id: string, collar: LatLon | null): CollarMapHole<null> => ({
  id,
  holeId: id.toUpperCase(),
  collar,
  data: null,
});

describe("distances and directions", () => {
  it("measures metres and compass directions between two points", () => {
    expect(distanceM(site, offset(100, 0))).toBeCloseTo(100, 0);
    expect(distanceM(site, offset(0, 300))).toBeCloseTo(300, 0);
    expect(compassPoint(bearingDeg(site, offset(100, 0)))).toBe("N");
    expect(compassPoint(bearingDeg(site, offset(100, 100)))).toBe("NE");
    expect(compassPoint(bearingDeg(site, offset(-50, -50)))).toBe("SW");
    expect(compassPoint(359)).toBe("N");
  });

  it("says how far a collar is from you in plain words", () => {
    expect(describeFromHere(site, offset(140, 140))).toBe("198 m NE of you");
    expect(describeFromHere(site, offset(0, -1_400))).toBe("1.4 km W of you");
    expect(describeFromHere(site, offset(2, 0))).toBe("You are at this collar");
    expect(formatDistance(812_345)).toBe("812 km");
  });

  it("places points in metres east and north of the centre", () => {
    const point = toLocalMetres(site, offset(-200, 50));
    expect(point.x).toBeCloseTo(50, 0);
    expect(point.y).toBeCloseTo(-200, 0);
  });
});

describe("collarMapLayout", () => {
  it("groups holes on one pad, keeps the rest apart, and lists holes with no collar", () => {
    const layout = collarMapLayout([
      hole("dh-10", offset(0, 0)),
      hole("dh-2", offset(3, 2)), // same pad as DH-10
      hole("dh-3", offset(400, 0)),
      hole("dh-4", null),
      hole("dh-5", { latitude: Number.NaN, longitude: 125 }),
    ]);
    expect(layout.pads.map((p) => p.holes.map((h) => h.holeId))).toEqual([["DH-2", "DH-10"], ["DH-3"]]);
    expect(layout.unlocated.map((h) => h.holeId)).toEqual(["DH-4", "DH-5"]);
    const [pad, far] = layout.pads;
    expect(far!.y - pad!.y).toBeCloseTo(398.5, 0);
    expect(layout.bounds!.maxY - layout.bounds!.minY).toBeCloseTo(398.5, 0);
  });

  it("never lets a pad grow wider than its radius", () => {
    const chain = [0, 8, 16, 24].map((east, i) => hole(`h${i}`, offset(0, east)));
    const layout = collarMapLayout(chain);
    for (const pad of layout.pads) {
      const xs = pad.holes.map((h) => toLocalMetres(layout.centre!, h.collar!).x);
      expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(PAD_RADIUS_M * 2);
    }
    expect(layout.pads.length).toBeGreaterThan(1);
  });

  it("has no centre or bounds when no hole has a collar", () => {
    expect(collarMapLayout([hole("a", null)])).toMatchObject({ pads: [], centre: null, bounds: null });
  });
});

describe("you are here", () => {
  const layout = collarMapLayout([hole("a", offset(0, 0)), hole("b", offset(500, 500))]);

  it("is drawn on the map only near the collars", () => {
    expect(hereIsOnMap(offset(-300, 0), layout)).toBe(true);
    expect(hereIsOnMap(offset(-80_000, 0), layout)).toBe(false);
  });

  it("finds the nearest collar", () => {
    const nearest = nearestPad(offset(450, 480), layout);
    expect(nearest!.pad.holes[0]!.holeId).toBe("B");
    expect(nearest!.metres).toBeCloseTo(53.9, 0);
  });
});

describe("scaleBarMetres", () => {
  it("picks a round length that fits", () => {
    expect(scaleBarMetres(73)).toBe(50);
    expect(scaleBarMetres(180)).toBe(100);
    expect(scaleBarMetres(260)).toBe(200);
    expect(scaleBarMetres(1_900)).toBe(1_000);
    expect(scaleBarMetres(4)).toBe(2);
    expect(scaleBarMetres(0)).toBe(1);
  });
});

describe("hole traces", () => {
  it("runs along the azimuth for the depth times the cosine of the dip", () => {
    const south = traceOffset({ azimuthDeg: 180, inclinationDeg: -60, depthM: 250 });
    expect(south!.x).toBeCloseTo(0, 6);
    expect(south!.y).toBeCloseTo(-125, 6);
    const east = traceOffset({ azimuthDeg: 90, inclinationDeg: 60, depthM: 100 });
    expect(east!.x).toBeCloseTo(50, 6);
    expect(east!.y).toBeCloseTo(0, 6);
  });

  it("draws no trace for a vertical hole or a missing direction, dip or depth", () => {
    expect(traceOffset({ azimuthDeg: 0, inclinationDeg: -90, depthM: 300 })).toBeNull();
    expect(traceOffset({ azimuthDeg: null, inclinationDeg: -90, depthM: 300 })).toBeNull();
    expect(traceOffset({ azimuthDeg: null, inclinationDeg: -60, depthM: 300 })).toBeNull();
    expect(traceOffset({ azimuthDeg: 45, inclinationDeg: null, depthM: 300 })).toBeNull();
    expect(traceOffset({ azimuthDeg: 45, inclinationDeg: -60, depthM: null })).toBeNull();
    expect(traceOffset({ azimuthDeg: 45, inclinationDeg: -60, depthM: 0 })).toBeNull();
    expect(traceOffset(undefined)).toBeNull();
  });

  it("starts each trace at its own collar and fits the map around where the holes end", () => {
    const layout = collarMapLayout([
      { ...hole("a", offset(0, 0)), plan: { azimuthDeg: 90, inclinationDeg: -60, depthM: 400 } },
      { ...hole("b", offset(100, 0)), plan: { azimuthDeg: 0, inclinationDeg: -90, depthM: 300 } },
    ]);
    expect(layout.traces).toHaveLength(1);
    const [trace] = layout.traces;
    expect(trace!.id).toBe("a");
    expect(trace!.planLengthM).toBeCloseTo(200, 6);
    expect(trace!.to.x - trace!.from.x).toBeCloseTo(200, 6);
    expect(layout.bounds!.maxX - layout.bounds!.minX).toBeCloseTo(200, 0);
  });
});
