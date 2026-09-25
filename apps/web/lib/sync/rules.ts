import {
  isValidAzimuthDeg,
  isValidInclinationDeg,
  isValidPhotoMaxMb,
} from "@corechain/domain";

// The rules about one record that the server enforces itself, whatever the
// phone checked first (change register item 6). They are the phone's own
// "can't save" errors (a depth below 0, a "to" not past its "from", RQD
// pieces longer than the core recovered, an angle out of range), so a record
// the app would accept always passes.
//
// What is left to people on purpose: anything that needs other records to
// judge. Gaps and overlaps between runs, and runs past the final depth, are
// QA/QC exceptions; so are overlapping primary samples (two phones offline can
// each bag the same core, and both bags are real). Refusing those here would
// lose a real record, since a refused change is not sent again by itself.

/** Depths closer than this are the same depth (as in the domain rules). */
const TOLERANCE_M = 0.005;

type Row = Record<string, unknown>;
type Rule = (row: Row) => string | null;

const num = (row: Row, name: string): number | null => {
  const value = row[name];
  return typeof value === "number" ? value : null;
};

const atLeastZero =
  (name: string, label: string): Rule =>
  (row) => {
    const value = num(row, name);
    return value != null && value < 0 ? `${label} must be 0 or more.` : null;
  };

const depthRange =
  (options: { allowEqual?: boolean; optional?: boolean } = {}): Rule =>
  (row) => {
    const from = num(row, "from_m");
    const to = num(row, "to_m");
    if (from == null || to == null) {
      return options.optional ? null : "Needs both a from and a to depth.";
    }
    if (from < 0) return "From depth must be 0 m or more.";
    if (options.allowEqual ? to < from : to <= from) {
      return "To depth must be greater than from depth.";
    }
    return null;
  };

const between =
  (name: string, label: string, low: number, high: number): Rule =>
  (row) => {
    const value = num(row, name);
    return value != null && (value < low || value > high)
      ? `${label} must be between ${low} and ${high}.`
      : null;
  };

const RULES: Record<string, Rule[]> = {
  projects: [
    (row) => {
      const next = num(row, "next_sample_number");
      return next != null && next < 1 ? "Next sample number must be 1 or more." : null;
    },
    atLeastZero("qc_standard_every_n", "Standard rate"),
    atLeastZero("qc_blank_every_n", "Blank rate"),
    atLeastZero("qc_duplicate_every_n", "Duplicate rate"),
    (row) => {
      const mb = num(row, "photo_max_mb");
      return mb != null && !isValidPhotoMaxMb(mb) ? "Photo size limit is out of range." : null;
    },
  ],
  drillholes: [
    (row) => {
      const depth = num(row, "planned_depth_m");
      return depth != null && depth <= 0 ? "Planned depth must be greater than 0." : null;
    },
    atLeastZero("actual_final_depth_m", "Final depth"),
    (row) => {
      const azimuth = num(row, "planned_azimuth_deg");
      return azimuth != null && !isValidAzimuthDeg(azimuth)
        ? "Azimuth must be between 0 and 360 degrees."
        : null;
    },
    (row) => {
      const dip = num(row, "planned_inclination_deg");
      return dip != null && !isValidInclinationDeg(dip)
        ? "Inclination (dip) must be between -90 and 90 degrees."
        : null;
    },
    between("collar_latitude", "Latitude", -90, 90),
    between("collar_longitude", "Longitude", -180, 180),
    atLeastZero("collar_accuracy_m", "GPS accuracy"),
  ],
  core_boxes: [
    (row) => {
      const box = num(row, "box_number");
      return box != null && box < 1 ? "Box number must be 1 or higher." : null;
    },
    depthRange(),
  ],
  core_runs: [
    depthRange(),
    atLeastZero("recovered_m", "Recovered length"),
    atLeastZero("rqd_pieces_m", "Pieces ≥ 10 cm"),
    (row) => {
      const pieces = num(row, "rqd_pieces_m");
      const recovered = num(row, "recovered_m");
      return pieces != null && recovered != null && pieces > recovered + TOLERANCE_M
        ? "Pieces ≥ 10 cm can't be longer than the recovered core."
        : null;
    },
  ],
  log_intervals: [depthRange(), between("mineral_percent", "Mineral %", 0, 100)],
  samples: [
    (row) =>
      row.sample_type === "primary"
        ? depthRange()(row)
        : depthRange({ optional: true })(row),
  ],
  photos: [
    depthRange({ allowEqual: true }),
    atLeastZero("width_px", "Width"),
    atLeastZero("height_px", "Height"),
    atLeastZero("size_bytes", "Size"),
  ],
};

/** The columns the rules for a table read, so a change to one part of a record can be checked whole. */
export const RULE_COLUMNS: Record<string, readonly string[]> = {
  projects: [
    "next_sample_number",
    "qc_standard_every_n",
    "qc_blank_every_n",
    "qc_duplicate_every_n",
    "photo_max_mb",
  ],
  drillholes: [
    "planned_depth_m",
    "actual_final_depth_m",
    "planned_azimuth_deg",
    "planned_inclination_deg",
    "collar_latitude",
    "collar_longitude",
    "collar_accuracy_m",
  ],
  core_boxes: ["box_number", "from_m", "to_m"],
  core_runs: ["from_m", "to_m", "recovered_m", "rqd_pieces_m"],
  log_intervals: ["from_m", "to_m", "mineral_percent"],
  samples: ["sample_type", "from_m", "to_m"],
  photos: ["from_m", "to_m", "width_px", "height_px", "size_bytes"],
};

/**
 * The first rule a whole record breaks, or null. `row` is the record as it
 * would be stored: for a change to part of a record, the stored record with
 * the change applied.
 */
export function recordRuleError(table: string, row: Row): string | null {
  for (const rule of RULES[table] ?? []) {
    const error = rule(row);
    if (error) return error;
  }
  return null;
}

/** Whether a change touches any column the table's rules read. */
export function touchesRuleColumns(table: string, values: Row): boolean {
  return (RULE_COLUMNS[table] ?? []).some((name) => name in values);
}

/**
 * Columns that point at another record, which must be in the same project
 * (or, for a photo's subject, the same hole) and the same organization. A
 * foreign key only proves the record exists somewhere.
 */
export type Reference = {
  column: string;
  /** The table the column points at, or null when the row doesn't say. */
  target: (row: Row) => string | null;
  within: "project" | "drillhole";
};

export const REFERENCES: Record<string, readonly Reference[]> = {
  samples: [{ column: "parent_sample_id", target: () => "samples", within: "project" }],
  dispatch_samples: [
    { column: "dispatch_id", target: () => "dispatches", within: "project" },
    { column: "sample_id", target: () => "samples", within: "project" },
  ],
  custody_events: [
    { column: "sample_id", target: () => "samples", within: "project" },
    { column: "dispatch_id", target: () => "dispatches", within: "project" },
    { column: "corrects_event_id", target: () => "custody_events", within: "project" },
  ],
  photos: [
    {
      column: "subject_id",
      target: (row) =>
        row.subject_type === "box"
          ? "core_boxes"
          : row.subject_type === "interval"
            ? "log_intervals"
            : null,
      within: "drillhole",
    },
  ],
};

/** Every column a check on this table reads, for loading the stored record before a change. */
export function checkedColumns(table: string): string[] {
  const names = new Set(RULE_COLUMNS[table] ?? []);
  for (const reference of REFERENCES[table] ?? []) names.add(reference.column);
  if (table === "photos") {
    names.add("subject_type");
    names.add("drillhole_id");
  }
  return [...names];
}
