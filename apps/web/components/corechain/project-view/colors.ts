// Colours for the 3D evidence view. One copper hue, dark to light, so low
// grades recede into the dark viewport and high grades stand out; the legend
// and the scene read from the same stops.

export const GRADE_RAMP = ["#3b2a20", "#6e4329", "#a66a43", "#cf8a55", "#eab27c", "#f8dcbc"] as const;

/** Sampled, nothing back from the laboratory yet. */
export const AWAITING_COLOR = "#55605c";
/** Below detection: drawn as an outline in this colour. */
export const BELOW_DETECTION_COLOR = "#8b948f";

export const VIEWPORT_BG = "#0f1615";

const hexToRgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

/** The ramp colour for a position 0 to 1 on the grade scale, as a hex string. */
export function rampColor(t: number): string {
  const x = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 0)) * (GRADE_RAMP.length - 1);
  const i = Math.min(GRADE_RAMP.length - 2, Math.floor(x));
  const f = x - i;
  const a = hexToRgb(GRADE_RAMP[i]!);
  const b = hexToRgb(GRADE_RAMP[i + 1]!);
  const mix = a.map((c, k) => Math.round(c + (b[k]! - c) * f));
  return `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export const RAMP_GRADIENT = `linear-gradient(90deg, ${GRADE_RAMP.join(", ")})`;
