import { describe, expect, it } from "vitest";
import { terrainBounds } from "./render";

describe("terrainBounds", () => {
  it("covers the collars and planned hole ends with a 1.5 km margin", () => {
    const b = terrainBounds([
      { latitude: 17.0452, longitude: 120.851, azimuthDeg: 0, inclinationDeg: -90, depthM: 300 },
      { latitude: 17.0452, longitude: 120.8492, azimuthDeg: 90, inclinationDeg: -60, depthM: 400 },
    ])!;
    const mPerDegLat = (Math.PI / 180) * 6_371_008.8;
    // 1.5 km north and south of the collars' latitude.
    expect((b.north - 17.0452) * mPerDegLat).toBeCloseTo(1500, 0);
    expect((17.0452 - b.south) * mPerDegLat).toBeCloseTo(1500, 0);
    // East edge: the angled hole's end (200 m east of its collar) plus 1.5 km, past the vertical hole.
    const mPerDegLon = mPerDegLat * Math.cos((17.0452 * Math.PI) / 180);
    expect((b.east - 120.8492) * mPerDegLon).toBeCloseTo(1700, 0);
  });

  it("has nothing to draw without collars", () => {
    expect(terrainBounds([])).toBeNull();
  });
});
