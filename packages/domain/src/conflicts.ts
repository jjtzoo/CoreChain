// Resolving a sync conflict (plan story E8-5). When two phones change one record
// while offline, the server keeps what it has and hands back its version; the
// phone keeps its own. These pure functions work out which fields really differ
// and build the values to write when the geologist picks a side, field by field.

/** Fields that are bookkeeping, never something a person chooses between. */
const NOT_A_CHOICE = new Set([
  "id",
  "version",
  "created_at",
  "updated_at",
  "organization_id",
  "created_by",
  "project_id",
  "drillhole_id",
  "sample_id",
  "dispatch_id",
]);

export type ConflictSide = "mine" | "theirs";

export type ConflictField = {
  field: string;
  /** A short name for the field, for example "Alteration intensity". */
  label: string;
  mine: unknown;
  theirs: unknown;
};

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function empty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/** Treats 5 and "5", true and 1, and the same instant written two ways as equal. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (empty(a) || empty(b)) return empty(a) && empty(b);
  if (typeof a === "boolean" || typeof b === "boolean") {
    const asNumber = (v: unknown) =>
      v === true ? 1 : v === false ? 0 : Number(v);
    return asNumber(a) === asNumber(b);
  }
  if (typeof a === "number" || typeof b === "number") {
    return Number(a) === Number(b);
  }
  if (
    typeof a === "string" &&
    typeof b === "string" &&
    ISO_DATE_TIME.test(a) &&
    ISO_DATE_TIME.test(b)
  ) {
    return Date.parse(a) === Date.parse(b);
  }
  return a === b;
}

/** "alteration_intensity" becomes "Alteration intensity", "from_m" becomes "From (m)". */
export function fieldLabel(field: string): string {
  const unit = field.endsWith("_m")
    ? " (m)"
    : field.endsWith("_deg")
      ? " (degrees)"
      : field.endsWith("_pct")
        ? " (%)"
        : "";
  const base = field.replace(/_(m|deg|pct)$/, "").replace(/_/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1) + unit;
}

/** How a value reads in the side-by-side view. */
export function conflictValueText(value: unknown): string {
  if (empty(value)) return "Empty";
  if (value === true) return "Yes";
  if (value === false) return "No";
  return String(value);
}

/** The fields where the phone's version and the server's version really differ. */
export function conflictFields(
  mine: Record<string, unknown>,
  theirs: Record<string, unknown>,
): ConflictField[] {
  const names = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])];
  return names
    .filter((name) => !NOT_A_CHOICE.has(name))
    .filter((name) => !sameValue(mine[name], theirs[name]))
    .map((field) => ({
      field,
      label: fieldLabel(field),
      mine: mine[field] ?? null,
      theirs: theirs[field] ?? null,
    }));
}

/**
 * The values to write to the record for the chosen sides. Any field without a
 * choice keeps the server's value, so nothing is overwritten by accident.
 */
export function resolvedValues(
  fields: readonly ConflictField[],
  choices: Readonly<Record<string, ConflictSide>>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of fields) {
    values[f.field] =
      (choices[f.field] ?? "theirs") === "mine" ? f.mine : f.theirs;
  }
  return values;
}
