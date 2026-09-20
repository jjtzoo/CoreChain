// What a phone may write, table by table (E8-3). The upload API accepts only
// these tables and these columns, checks each value against its type, and fills
// in the columns the phone must not choose itself (organization_id, created_by,
// project_id on tables under a drillhole, and photos' storage_key). Names match
// the Postgres tables in apps/web/prisma/schema.prisma, which mirror the phone's.

export type EnumName =
  | "CollarSource"
  | "DrillholeStatus"
  | "SampleType"
  | "SampleStatus"
  | "ControlType"
  | "PhotoSubjectType"
  | "CodeCategory"
  | "CustodyEventType"
  | "DispatchStatus";

export type ColumnType =
  | "uuid"
  | "text"
  | "int"
  | "float"
  | "bool"
  | "timestamptz"
  | "day"
  | { enum: EnumName; values: readonly string[] };

export type Column = {
  type: ColumnType;
  /** Must be present when a row is first sent. */
  required?: boolean;
  /** May be null. */
  nullable?: boolean;
  /** Set once, at creation; a later change is refused. */
  immutable?: boolean;
  /** Longest text accepted. Defaults to 2000. */
  max?: number;
};

/** Where a table's rows hang, which decides how the owning project is found. */
export type Parent = "none" | "project" | "drillhole";

export type TableSpec = {
  name: string;
  parent: Parent;
  /** Rows are only ever added: a later change is refused. */
  appendOnly?: boolean;
  columns: Record<string, Column>;
};

const uuid = (extra: Partial<Column> = {}): Column => ({
  type: "uuid",
  ...extra,
});
const text = (extra: Partial<Column> = {}): Column => ({
  type: "text",
  ...extra,
});
const num = (extra: Partial<Column> = {}): Column => ({
  type: "float",
  ...extra,
});
const int = (extra: Partial<Column> = {}): Column => ({
  type: "int",
  ...extra,
});
const when = (extra: Partial<Column> = {}): Column => ({
  type: "timestamptz",
  ...extra,
});
const oneOf = (
  name: EnumName,
  values: readonly string[],
  extra: Partial<Column> = {},
): Column => ({
  type: { enum: name, values },
  ...extra,
});

/** The columns every editable table carries (decisions D6 to D8). */
const tracked = {
  id: uuid({ required: true, immutable: true }),
  created_at: when({ required: true, immutable: true }),
  updated_at: when({ required: true }),
  version: int({ required: true }),
  deleted_at: when({ nullable: true }),
} satisfies Record<string, Column>;

const DRILLHOLE_STATUS = ["planned", "drilling", "complete", "logged"] as const;
const CONTROL_TYPE = ["standard", "blank", "duplicate"] as const;

export const SYNC_TABLES: Record<string, TableSpec> = {
  projects: {
    name: "projects",
    parent: "none",
    columns: {
      ...tracked,
      name: text({ required: true, max: 200 }),
      commodity: text({ nullable: true, max: 200 }),
      location: text({ nullable: true, max: 400 }),
      coordinate_system: text({ required: true, max: 100 }),
      sample_prefix: text({ required: true, max: 40 }),
      next_sample_number: int({ required: true }),
      qc_standard_every_n: int({ required: true }),
      qc_blank_every_n: int({ required: true }),
      qc_duplicate_every_n: int({ required: true }),
      photo_max_mb: num(),
    },
  },
  drillholes: {
    name: "drillholes",
    parent: "project",
    columns: {
      ...tracked,
      project_id: uuid({ required: true, immutable: true }),
      hole_id: text({ required: true, max: 100 }),
      collar_source: oneOf("CollarSource", ["gps", "manual"], {
        nullable: true,
      }),
      collar_latitude: num({ nullable: true }),
      collar_longitude: num({ nullable: true }),
      collar_accuracy_m: num({ nullable: true }),
      collar_captured_at: when({ nullable: true }),
      planned_azimuth_deg: num({ nullable: true }),
      planned_inclination_deg: num({ nullable: true }),
      planned_depth_m: num({ required: true }),
      actual_final_depth_m: num({ nullable: true }),
      started_at: { type: "day", nullable: true },
      completed_at: { type: "day", nullable: true },
      status: oneOf("DrillholeStatus", DRILLHOLE_STATUS, { required: true }),
      contractor: text({ nullable: true, max: 200 }),
      drill_type: text({ nullable: true, max: 100 }),
      diameter: text({ nullable: true, max: 100 }),
      note: text({ nullable: true }),
    },
  },
  drillhole_status_history: {
    name: "drillhole_status_history",
    parent: "drillhole",
    appendOnly: true,
    columns: {
      id: uuid({ required: true, immutable: true }),
      drillhole_id: uuid({ required: true, immutable: true }),
      status: oneOf("DrillholeStatus", DRILLHOLE_STATUS, { required: true }),
      changed_at: when({ required: true }),
    },
  },
  core_boxes: {
    name: "core_boxes",
    parent: "drillhole",
    columns: {
      ...tracked,
      drillhole_id: uuid({ required: true, immutable: true }),
      box_number: int({ required: true }),
      from_m: num({ required: true }),
      to_m: num({ required: true }),
      note: text({ nullable: true }),
    },
  },
  core_runs: {
    name: "core_runs",
    parent: "drillhole",
    columns: {
      ...tracked,
      drillhole_id: uuid({ required: true, immutable: true }),
      from_m: num({ required: true }),
      to_m: num({ required: true }),
      recovered_m: num({ required: true }),
      rqd_pieces_m: num({ nullable: true }),
    },
  },
  code_library: {
    name: "code_library",
    parent: "project",
    columns: {
      ...tracked,
      project_id: uuid({ required: true, immutable: true }),
      category: oneOf(
        "CodeCategory",
        [
          "lithology",
          "alteration_type",
          "alteration_intensity",
          "mineral",
          "mineral_style",
          "weathering",
          "structure_type",
        ],
        { required: true },
      ),
      code: text({ required: true, max: 100 }),
      description: text({ required: true, max: 400 }),
      hidden: { type: "bool" },
    },
  },
  log_intervals: {
    name: "log_intervals",
    parent: "drillhole",
    columns: {
      ...tracked,
      drillhole_id: uuid({ required: true, immutable: true }),
      from_m: num({ required: true }),
      to_m: num({ required: true }),
      lithology: text({ nullable: true, max: 100 }),
      alteration_type: text({ nullable: true, max: 100 }),
      alteration_intensity: text({ nullable: true, max: 100 }),
      mineral: text({ nullable: true, max: 100 }),
      mineral_style: text({ nullable: true, max: 100 }),
      mineral_percent: num({ nullable: true }),
      weathering: text({ nullable: true, max: 100 }),
      structure_type: text({ nullable: true, max: 100 }),
      notes: text({ nullable: true }),
    },
  },
  samples: {
    name: "samples",
    parent: "project",
    columns: {
      ...tracked,
      project_id: uuid({ required: true, immutable: true }),
      drillhole_id: uuid({ required: true, immutable: true }),
      sample_number: text({ required: true, max: 100, immutable: true }),
      sample_type: oneOf(
        "SampleType",
        ["primary", "standard", "blank", "duplicate"],
        { required: true },
      ),
      from_m: num({ nullable: true }),
      to_m: num({ nullable: true }),
      standard_ref: text({ nullable: true, max: 200 }),
      parent_sample_id: uuid({ nullable: true }),
      note: text({ nullable: true }),
      status: oneOf("SampleStatus", ["created", "bagged", "dispatched"], {
        required: true,
      }),
    },
  },
  qc_dismissals: {
    name: "qc_dismissals",
    parent: "project",
    appendOnly: true,
    columns: {
      id: uuid({ required: true, immutable: true }),
      project_id: uuid({ required: true, immutable: true }),
      control_type: oneOf("ControlType", CONTROL_TYPE, { required: true }),
      reason: text({ required: true, max: 1000 }),
      created_at: when({ required: true }),
    },
  },
  // E7-1: only ever added. A mistake is corrected by a new "correction" event.
  custody_events: {
    name: "custody_events",
    parent: "project",
    appendOnly: true,
    columns: {
      id: uuid({ required: true, immutable: true }),
      project_id: uuid({ required: true, immutable: true }),
      sample_id: uuid({ required: true, immutable: true }),
      event_type: oneOf(
        "CustodyEventType",
        ["bagged", "sealed", "handed_over", "dispatched", "correction"],
        { required: true },
      ),
      occurred_at: when({ required: true }),
      handled_by: text({ required: true, max: 200 }),
      location: text({ nullable: true, max: 400 }),
      recipient: text({ nullable: true, max: 200 }),
      note: text({ nullable: true }),
      dispatch_id: uuid({ nullable: true }),
      corrects_event_id: uuid({ nullable: true }),
      created_at: when({ required: true }),
    },
  },
  // E7-2: a batch of samples going to one laboratory.
  dispatches: {
    name: "dispatches",
    parent: "project",
    columns: {
      ...tracked,
      project_id: uuid({ required: true, immutable: true }),
      dispatch_number: text({ required: true, max: 40 }),
      laboratory: text({ required: true, max: 200 }),
      preparation_request: text({ nullable: true }),
      handover_at: { type: "day", nullable: true },
      status: oneOf("DispatchStatus", ["open", "dispatched"], {
        required: true,
      }),
      note: text({ nullable: true }),
    },
  },
  // E7-2: which samples are in which dispatch; removed (deleted_at) when a
  // sample leaves a dispatch that is still open.
  dispatch_samples: {
    name: "dispatch_samples",
    parent: "project",
    columns: {
      ...tracked,
      project_id: uuid({ required: true, immutable: true }),
      dispatch_id: uuid({ required: true, immutable: true }),
      sample_id: uuid({ required: true, immutable: true }),
    },
  },
  photos: {
    name: "photos",
    parent: "drillhole",
    columns: {
      ...tracked,
      drillhole_id: uuid({ required: true, immutable: true }),
      subject_type: oneOf("PhotoSubjectType", ["box", "interval"], {
        required: true,
      }),
      subject_id: uuid({ required: true }),
      hole_id: text({ required: true, max: 100 }),
      box_number: int({ nullable: true }),
      from_m: num({ required: true }),
      to_m: num({ required: true }),
      file_name: text({ required: true, max: 200 }),
      width_px: int({ required: true }),
      height_px: int({ required: true }),
      size_bytes: int({ required: true }),
      captured_at: when({ required: true }),
      note: text({ nullable: true }),
    },
  },
};
