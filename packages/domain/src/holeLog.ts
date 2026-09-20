// The graphic hole log (plan story E4-6): the logged intervals and core runs of
// one hole turned into columns by depth, the way a geologist reads a strip log.
// Pure data and colours, no drawing, so the phone and the web can share it.

import { recoveryPercent, rqdPercent, type FieldCoreRun } from "./core";
import type { LogInterval } from "./logging";

export const HOLE_LOG_COLUMNS = ["lithology", "alteration", "mineral"] as const;
export type HoleLogColumn = (typeof HOLE_LOG_COLUMNS)[number];

export const HOLE_LOG_COLUMN_LABELS: Record<HoleLogColumn, string> = {
  lithology: "Lithology",
  alteration: "Alteration",
  mineral: "Mineralisation",
};

export type HoleLogSegment = {
  /** The interval this stretch comes from, so a tap can open it. */
  intervalId: string;
  fromM: number;
  toM: number;
  /** The code in this column, or null when nothing was logged for it. */
  code: string | null;
  /**
   * Alteration: intensity 0 to 4 (null when not a number).
   * Mineralisation: estimated percent of the mineral (null when not entered).
   * Lithology: always null.
   */
  detail: number | null;
};

export type HoleLogRun = {
  fromM: number;
  toM: number;
  recoveryPercent: number | null;
  rqdPercent: number | null;
};

export type HoleLog = {
  /** The depth the picture runs to: the hole depth or the deepest record. */
  depthM: number;
  columns: Record<HoleLogColumn, HoleLogSegment[]>;
  runs: HoleLogRun[];
};

function intensity(raw: string | null): number | null {
  if (raw === null || !/^\d$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

export function buildHoleLog(input: {
  intervals: readonly LogInterval[];
  runs: readonly FieldCoreRun[];
  /** Final depth if known, otherwise the planned depth. */
  depthM: number;
}): HoleLog {
  const intervals = input.intervals
    .filter((i) => i.deletedAt === null)
    .slice()
    .sort((a, b) => a.fromM - b.fromM || a.toM - b.toM);
  const runs = input.runs
    .filter((r) => r.deletedAt === null)
    .slice()
    .sort((a, b) => a.fromM - b.fromM);

  const segment = (
    i: LogInterval,
    code: string | null,
    detail: number | null,
  ): HoleLogSegment => ({
    intervalId: i.id,
    fromM: i.fromM,
    toM: i.toM,
    code: code && code.trim() !== "" ? code.trim() : null,
    detail,
  });

  const deepest = Math.max(
    input.depthM,
    ...intervals.map((i) => i.toM),
    ...runs.map((r) => r.toM),
  );

  return {
    depthM: deepest,
    columns: {
      lithology: intervals.map((i) => segment(i, i.lithology, null)),
      alteration: intervals.map((i) =>
        segment(i, i.alterationType, intensity(i.alterationIntensity)),
      ),
      mineral: intervals.map((i) =>
        segment(i, i.mineral, i.mineral ? i.mineralPercent : null),
      ),
    },
    runs: runs.map((r) => ({
      fromM: r.fromM,
      toM: r.toM,
      recoveryPercent: recoveryPercent(r.toM - r.fromM, r.recoveredM),
      rqdPercent:
        r.rqdPiecesM === null
          ? null
          : rqdPercent(r.toM - r.fromM, r.rqdPiecesM),
    })),
  };
}

// --- Colours ---------------------------------------------------------------

// Mid-tone colours that read on both the light and the dark theme. Alteration
// and mineral colours follow common exploration practice: potassic pink,
// phyllic yellow, propylitic green; chalcopyrite gold, bornite purple.
const KNOWN_COLOURS: Record<HoleLogColumn, Record<string, string>> = {
  lithology: {
    OVB: "#8B6B4A",
    AND: "#6E8B74",
    BAS: "#4B5A5A",
    DIO: "#A89B8C",
    GRD: "#C9A38F",
    PORP: "#9B6FA8",
    TUF: "#C9BC8C",
    BX: "#B5563F",
    SST: "#E0C36A",
    SLT: "#9AA7B5",
    SHL: "#5F6B78",
    LST: "#6FA8C9",
    QV: "#EDEDED",
  },
  alteration: {
    POT: "#D9527A",
    PHY: "#E6C84C",
    PROP: "#4E9B5A",
    ARG: "#C8B08A",
    ADV: "#E9A15A",
    SIL: "#8FA7BF",
    CHL: "#2F7D5B",
    EPI: "#A8C04A",
    CARB: "#7FB6D9",
  },
  mineral: {
    PY: "#B8B36A",
    CPY: "#E8A317",
    BN: "#7B3FA0",
    CC: "#2C4F7C",
    MAG: "#5A5A5A",
    SPH: "#8A5A2B",
    GAL: "#8A9AA5",
    MOL: "#5B7FB5",
    AU: "#FFD400",
  },
};

// A code the geologist added themselves gets a stable colour from this list.
const FALLBACK_COLOURS = [
  "#C77D4F",
  "#5E9EA0",
  "#B0648F",
  "#8A9A4B",
  "#6B7DB3",
  "#C9954C",
  "#7A9E7E",
  "#A0728F",
];

export const NO_CODE_COLOUR = "#3A4643";

export function holeLogColour(
  column: HoleLogColumn,
  code: string | null,
): string {
  if (code === null) return NO_CODE_COLOUR;
  const known = KNOWN_COLOURS[column][code.toUpperCase()];
  if (known) return known;
  let hash = 0;
  for (const ch of code.toUpperCase())
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_COLOURS[hash % FALLBACK_COLOURS.length];
}

/** Black or white text, whichever is easier to read on this colour. */
export function readableTextOn(hex: string): "#111111" | "#FFFFFF" {
  const value = hex.replace("#", "");
  const channel = (start: number) => {
    const c = parseInt(value.slice(start, start + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.4 ? "#111111" : "#FFFFFF";
}

/** The codes used in a column, in order of first depth, for the legend. */
export function legendCodes(log: HoleLog, column: HoleLogColumn): string[] {
  const seen: string[] = [];
  for (const s of log.columns[column]) {
    if (s.code !== null && !seen.includes(s.code)) seen.push(s.code);
  }
  return seen;
}
