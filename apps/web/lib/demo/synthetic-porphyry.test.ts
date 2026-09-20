import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STARTER_CODES } from "@corechain/domain";

// The synthetic Cordillera sample (data/demo/synthetic-cordillera-porphyry) is
// loaded onto real phones, so its logs must obey the same rules the app enforces.

const dir = new URL(
  "../../data/demo/synthetic-cordillera-porphyry/curated/",
  import.meta.url,
);

function readCsv(name: string): Record<string, string>[] {
  const [header, ...lines] = readFileSync(new URL(name, dir), "utf8")
    .trim()
    .split(/\r?\n/);
  const split = (line: string) =>
    [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) =>
      m[1].replace(/""/g, '"'),
    );
  const names = split(header);
  return lines.map((line) => {
    const cells = split(line);
    return Object.fromEntries(names.map((n, i) => [n, cells[i] ?? ""]));
  });
}

const holes = readCsv("drillholes.csv");
const intervals = readCsv("intervals.csv");
const codes = (category: string) =>
  new Set(
    STARTER_CODES.filter((c) => c.category === category).map((c) => c.code),
  );

describe("synthetic Cordillera porphyry sample", () => {
  it("has six holes with unique names and sensible collars", () => {
    expect(holes).toHaveLength(6);
    expect(new Set(holes.map((h) => h.hole_id)).size).toBe(6);
    for (const hole of holes) {
      expect(Number(hole.final_depth_m)).toBeGreaterThan(0);
      expect(Math.abs(Number(hole.dip_deg))).toBeLessThanOrEqual(90);
      expect(Number(hole.azimuth_deg)).toBeGreaterThanOrEqual(0);
      expect(Number(hole.azimuth_deg)).toBeLessThan(360);
    }
  });

  it("logs every hole continuously from 0 m to its final depth", () => {
    for (const hole of holes) {
      const mine = intervals
        .filter((row) => row.hole_id === hole.hole_id)
        .sort((a, b) => Number(a.from_m) - Number(b.from_m));
      expect(mine.length, hole.hole_id).toBeGreaterThan(0);
      let at = 0;
      for (const row of mine) {
        expect(Number(row.from_m), `${hole.hole_id} at ${at}`).toBeCloseTo(
          at,
          6,
        );
        expect(Number(row.to_m)).toBeGreaterThan(Number(row.from_m));
        at = Number(row.to_m);
      }
      expect(at, hole.hole_id).toBeCloseTo(Number(hole.final_depth_m), 6);
    }
  });

  it("uses only codes from the starter code library", () => {
    const fields: [string, string][] = [
      ["lithology", "lithology"],
      ["alteration_type", "alteration_type"],
      ["alteration_intensity", "alteration_intensity"],
      ["mineral", "mineral"],
      ["mineral_style", "mineral_style"],
      ["weathering", "weathering"],
      ["structure_type", "structure_type"],
    ];
    for (const row of intervals) {
      for (const [column, category] of fields) {
        if (row[column] === "") continue;
        expect(
          codes(category).has(row[column]),
          `${row.hole_id} ${row.from_m}: ${column} "${row[column]}"`,
        ).toBe(true);
      }
      // A mineral needs its style and percentage, and the reverse.
      expect(row.mineral === "", row.hole_id).toBe(row.mineral_style === "");
      expect(row.mineral === "", row.hole_id).toBe(row.mineral_percent === "");
    }
  });

  it("says plainly that it is synthetic", () => {
    const readme = readFileSync(new URL("../README.md", dir), "utf8");
    expect(readme).toMatch(/synthetic/i);
    expect(readme).toMatch(/not real data/i);
  });
});
