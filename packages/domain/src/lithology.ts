// The project's lithology dictionary and each hole's rock units, calculated
// from the logged intervals (docs/product/mockups/lithology-dictionary.html).
//
// A rock unit is a run of touching intervals with the same lithology (or, in
// the finer mode, the same lithology and alteration type). A gap in the log,
// or an interval with no lithology, ends a unit. Units are a way of reading
// the log; the log itself is never changed. Alteration and mineral figures
// are weighted by interval length.

import type { LogInterval } from "./logging";

export const ROCK_GROUPS = [
  "cover",
  "volcanic",
  "intrusive",
  "breccia",
  "sedimentary",
  "vein",
] as const;
export type RockGroup = (typeof ROCK_GROUPS)[number];

export const ROCK_GROUP_LABELS: Record<RockGroup, string> = {
  cover: "Cover",
  volcanic: "Volcanic",
  intrusive: "Intrusive",
  breccia: "Breccia",
  sedimentary: "Sedimentary",
  vein: "Vein",
};

/**
 * Reference notes for the starter lithology codes (logging.ts). Generic
 * textbook descriptions, like the starter codes themselves; a code a team adds
 * has no note or group.
 */
export const STARTER_LITHOLOGY_NOTES: Readonly<
  Record<string, { group: RockGroup; note: string }>
> = {
  OVB: { group: "cover", note: "Unconsolidated soil, colluvium or alluvium above bedrock." },
  AND: {
    group: "volcanic",
    note: "Intermediate volcanic rock. Fine-grained, grey to green-grey, often with plagioclase and hornblende phenocrysts.",
  },
  BAS: {
    group: "volcanic",
    note: "Mafic volcanic rock. Dark and fine-grained; may be vesicular or amygdaloidal.",
  },
  TUF: {
    group: "volcanic",
    note: "Consolidated volcanic ash. Fine-grained; may show layering and lithic or crystal fragments.",
  },
  DIO: {
    group: "intrusive",
    note: "Intermediate intrusive rock. Medium- to coarse-grained plagioclase and hornblende, little or no quartz.",
  },
  GRD: {
    group: "intrusive",
    note: "Intrusive rock between granite and diorite: quartz, plagioclase, some K-feldspar, with biotite and hornblende.",
  },
  PORP: {
    group: "intrusive",
    note: "Intrusive rock with large crystals (phenocrysts) in a fine-grained groundmass. In a porphyry system, often the mineralising stock.",
  },
  BX: {
    group: "breccia",
    note: "Angular broken fragments in a matrix or cement: hydrothermal, tectonic or volcanic.",
  },
  SST: { group: "sedimentary", note: "Sand-sized grains, cemented. Bedding and grading may show." },
  SLT: { group: "sedimentary", note: "Silt-sized grains; finer than sandstone, gritty rather than smooth." },
  SHL: { group: "sedimentary", note: "Clay-sized grains, fissile, splitting along thin layers." },
  LST: { group: "sedimentary", note: "Mostly calcium carbonate; fizzes with dilute acid." },
  QV: { group: "vein", note: "Quartz filling a fracture; may carry sulphides or gold." },
};

export function lithologyReference(
  code: string,
): { group: RockGroup; note: string } | null {
  return STARTER_LITHOLOGY_NOTES[code.trim().toUpperCase()] ?? null;
}

export type UnitMode = "lithology" | "lithology_alteration";

export type LengthShare = {
  code: string;
  lengthM: number;
  /** Of the unit's (or the rock type's) length, 0 to 1. */
  share: number;
};

export type MineralSummary = {
  code: string;
  /** Length of core where this mineral was logged. */
  lengthM: number;
  /** Length-weighted mean of the percentages entered, or null when none were. */
  meanPercent: number | null;
};

export type RockUnit = {
  drillholeId: string;
  fromM: number;
  toM: number;
  lengthM: number;
  lithology: string;
  /** The shared alteration type in the finer mode; null in lithology mode. */
  alterationType: string | null;
  intervalIds: string[];
  alteration: LengthShare[];
  /** Length-weighted mean alteration intensity (0 to 4), or null. */
  meanIntensity: number | null;
  minerals: MineralSummary[];
};

/** Intervals closer than this are treated as touching. */
const TOUCH_M = 0.005;

const clean = (code: string | null): string | null => {
  const value = code?.trim().toUpperCase();
  return value ? value : null;
};

/** Alteration, intensity and minerals across some intervals, weighted by length. */
function summarise(parts: readonly LogInterval[]) {
  const total = parts.reduce((sum, p) => sum + (p.toM - p.fromM), 0);
  const alteration = new Map<string, number>();
  const minerals = new Map<string, { lengthM: number; percentM: number; sum: number }>();
  let intensityM = 0;
  let intensitySum = 0;
  for (const part of parts) {
    const length = part.toM - part.fromM;
    const alt = clean(part.alterationType);
    if (alt) alteration.set(alt, (alteration.get(alt) ?? 0) + length);
    const intensity = part.alterationIntensity?.trim();
    if (intensity && /^\d$/.test(intensity)) {
      intensityM += length;
      intensitySum += Number(intensity) * length;
    }
    const mineral = clean(part.mineral);
    if (mineral) {
      const entry = minerals.get(mineral) ?? { lengthM: 0, percentM: 0, sum: 0 };
      entry.lengthM += length;
      if (part.mineralPercent != null && Number.isFinite(part.mineralPercent)) {
        entry.percentM += length;
        entry.sum += part.mineralPercent * length;
      }
      minerals.set(mineral, entry);
    }
  }
  return {
    alteration: [...alteration]
      .map(([code, lengthM]) => ({ code, lengthM, share: total > 0 ? lengthM / total : 0 }))
      .sort((a, b) => b.lengthM - a.lengthM || a.code.localeCompare(b.code)),
    meanIntensity: intensityM > 0 ? intensitySum / intensityM : null,
    minerals: [...minerals]
      .map(([code, m]) => ({
        code,
        lengthM: m.lengthM,
        meanPercent: m.percentM > 0 ? m.sum / m.percentM : null,
      }))
      .sort((a, b) => b.lengthM - a.lengthM || a.code.localeCompare(b.code)),
  };
}

/**
 * Rock units down each hole, in hole then depth order. Intervals from several
 * holes may be passed together; a unit never spans two holes.
 */
export function rockUnits(
  intervals: readonly LogInterval[],
  mode: UnitMode = "lithology",
): RockUnit[] {
  const rows = intervals
    .filter((i) => i.deletedAt === null && i.toM > i.fromM)
    .slice()
    .sort(
      (a, b) =>
        a.drillholeId.localeCompare(b.drillholeId) || a.fromM - b.fromM || a.toM - b.toM,
    );
  const groups: { key: string; lithology: string; alt: string | null; parts: LogInterval[] }[] = [];
  let open: (typeof groups)[number] | null = null;
  for (const row of rows) {
    const lithology = clean(row.lithology);
    if (!lithology) {
      open = null;
      continue;
    }
    const alt = mode === "lithology_alteration" ? clean(row.alterationType) : null;
    const key = `${row.drillholeId}|${lithology}|${alt ?? ""}`;
    const last = open?.parts[open.parts.length - 1];
    if (open && last && open.key === key && Math.abs(row.fromM - last.toM) <= TOUCH_M) {
      open.parts.push(row);
    } else {
      open = { key, lithology, alt, parts: [row] };
      groups.push(open);
    }
  }
  return groups.map((group) => {
    const first = group.parts[0]!;
    const toM = group.parts[group.parts.length - 1]!.toM;
    return {
      drillholeId: first.drillholeId,
      fromM: first.fromM,
      toM,
      lengthM: toM - first.fromM,
      lithology: group.lithology,
      alterationType: group.alt,
      intervalIds: group.parts.map((p) => p.id),
      ...summarise(group.parts),
    };
  });
}

export type LithologyEntry = {
  code: string;
  lengthM: number;
  /** Of all core logged with a lithology, 0 to 1. */
  share: number;
  holeCount: number;
  unitCount: number;
  topM: number;
  bottomM: number;
  thickest: RockUnit;
  alteration: LengthShare[];
  meanIntensity: number | null;
  minerals: MineralSummary[];
  /** This rock type's units in every hole, for "where it occurs". */
  units: RockUnit[];
};

export type LithologyDictionary = {
  /** Core logged with a lithology, in metres. */
  loggedM: number;
  /** Most logged first. */
  entries: LithologyEntry[];
};

/** Every rock type logged in a set of holes, with where and how it occurs. */
export function lithologyDictionary(intervals: readonly LogInterval[]): LithologyDictionary {
  const units = rockUnits(intervals, "lithology");
  const loggedM = units.reduce((sum, u) => sum + u.lengthM, 0);
  const byCode = new Map<string, RockUnit[]>();
  for (const unit of units) {
    byCode.set(unit.lithology, [...(byCode.get(unit.lithology) ?? []), unit]);
  }
  const byId = new Map(intervals.map((i) => [i.id, i]));
  const entries = [...byCode].map(([code, codeUnits]): LithologyEntry => {
    const lengthM = codeUnits.reduce((sum, u) => sum + u.lengthM, 0);
    const parts = codeUnits.flatMap((u) => u.intervalIds.map((id) => byId.get(id)!));
    return {
      code,
      lengthM,
      share: loggedM > 0 ? lengthM / loggedM : 0,
      holeCount: new Set(codeUnits.map((u) => u.drillholeId)).size,
      unitCount: codeUnits.length,
      topM: Math.min(...codeUnits.map((u) => u.fromM)),
      bottomM: Math.max(...codeUnits.map((u) => u.toM)),
      thickest: codeUnits.reduce((a, b) => (b.lengthM > a.lengthM ? b : a)),
      ...summarise(parts),
      units: codeUnits,
    };
  });
  entries.sort((a, b) => b.lengthM - a.lengthM || a.code.localeCompare(b.code));
  return { loggedM, entries };
}

const INTENSITY_WORDS = ["none", "weak", "moderate", "strong", "intense"] as const;

/** "moderate" for a mean intensity of 2.3. */
export function intensityWord(mean: number | null): string | null {
  if (mean == null || !Number.isFinite(mean)) return null;
  return INTENSITY_WORDS[Math.min(4, Math.max(0, Math.round(mean)))]!;
}

/** "45%", or "<1%" for a sliver, from a 0 to 1 share. */
export function formatShare(share: number): string {
  if (share > 0 && share < 0.005) return "<1%";
  return `${Math.round(share * 100)}%`;
}
