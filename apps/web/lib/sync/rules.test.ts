import { describe, expect, it } from "vitest";
import { prepareOperation } from "./prepare";
import {
  REFERENCES,
  RULE_COLUMNS,
  checkedColumns,
  recordRuleError,
  touchesRuleColumns,
} from "./rules";
import { SYNC_TABLES } from "./tables";

const ID = "3b1f6a0e-7c1d-4f7a-9a52-0d2d6f1c9e11";
const HOLE = "a0a0a0a0-1111-4222-8333-444455556666";
const NOW = "2026-09-20T05:55:28.964Z";
const tracked = { created_at: NOW, updated_at: NOW, version: 1 };

describe("recordRuleError", () => {
  it("refuses depths below 0 and a to that isn't past its from", () => {
    const box = { box_number: 3, from_m: 9, to_m: 12 };
    expect(recordRuleError("core_boxes", box)).toBeNull();
    expect(recordRuleError("core_boxes", { ...box, from_m: -1 })).toMatch(/0 m or more/);
    expect(recordRuleError("core_boxes", { ...box, to_m: 9 })).toMatch(/greater than from/);
    expect(recordRuleError("core_boxes", { ...box, box_number: 0 })).toMatch(/Box number/);
    expect(recordRuleError("log_intervals", { from_m: 12, to_m: 3 })).toMatch(/greater than from/);
  });

  it("checks runs as the phone does: recovery over 100% passes, RQD longer than the core doesn't", () => {
    const run = { from_m: 0, to_m: 3, recovered_m: 3.2, rqd_pieces_m: 2 };
    expect(recordRuleError("core_runs", run)).toBeNull();
    expect(recordRuleError("core_runs", { ...run, recovered_m: -0.1 })).toMatch(/Recovered/);
    expect(recordRuleError("core_runs", { ...run, rqd_pieces_m: 3.5 })).toMatch(/recovered core/);
  });

  it("needs depths on a primary sample only", () => {
    expect(recordRuleError("samples", { sample_type: "primary", from_m: 1, to_m: 2 })).toBeNull();
    expect(recordRuleError("samples", { sample_type: "primary", from_m: null, to_m: 2 })).toMatch(/both/);
    expect(recordRuleError("samples", { sample_type: "standard", from_m: null, to_m: null })).toBeNull();
    expect(recordRuleError("samples", { sample_type: "blank", from_m: 5, to_m: 4 })).toMatch(/greater than from/);
  });

  it("keeps angles, collar positions and percentages in range", () => {
    const hole = { planned_depth_m: 250 };
    expect(recordRuleError("drillholes", hole)).toBeNull();
    expect(recordRuleError("drillholes", { ...hole, planned_depth_m: 0 })).toMatch(/Planned depth/);
    expect(recordRuleError("drillholes", { ...hole, planned_azimuth_deg: 361 })).toMatch(/Azimuth/);
    expect(recordRuleError("drillholes", { ...hole, planned_inclination_deg: -91 })).toMatch(/dip/);
    expect(recordRuleError("drillholes", { ...hole, collar_latitude: 91 })).toMatch(/Latitude/);
    expect(recordRuleError("drillholes", { ...hole, collar_longitude: -181 })).toMatch(/Longitude/);
    expect(recordRuleError("log_intervals", { from_m: 0, to_m: 1, mineral_percent: 101 })).toMatch(/Mineral %/);
    expect(recordRuleError("projects", { next_sample_number: 0 })).toMatch(/Next sample number/);
  });

  it("leaves tables without rules alone", () => {
    expect(recordRuleError("dispatches", { laboratory: "" })).toBeNull();
  });
});

describe("the rules' columns", () => {
  it("are real columns of each table", () => {
    for (const table of Object.keys(RULE_COLUMNS)) {
      for (const name of checkedColumns(table)) {
        expect(SYNC_TABLES[table]?.columns[name], `${table}.${name}`).toBeDefined();
      }
    }
    for (const [table, references] of Object.entries(REFERENCES)) {
      for (const reference of references) {
        expect(SYNC_TABLES[table]?.columns[reference.column], `${table}.${reference.column}`).toBeDefined();
      }
    }
  });

  it("tell a change to a checked column from one that isn't", () => {
    expect(touchesRuleColumns("core_runs", { to_m: 4, version: 2 })).toBe(true);
    expect(touchesRuleColumns("core_runs", { updated_at: NOW, version: 2 })).toBe(false);
  });

  it("point a photo at a box or an interval by its subject type", () => {
    const [subject] = REFERENCES.photos!;
    expect(subject!.target({ subject_type: "box" })).toBe("core_boxes");
    expect(subject!.target({ subject_type: "interval" })).toBe("log_intervals");
  });
});

describe("prepareOperation with the record rules", () => {
  it("refuses a new record that breaks one, with the rule as the detail", () => {
    expect(
      prepareOperation({
        op: "PUT",
        table: "core_boxes",
        id: ID,
        data: { ...tracked, drillhole_id: HOLE, box_number: 1, from_m: 6, to_m: 3 },
      }),
    ).toEqual({
      ok: false,
      reason: "invalid-record",
      detail: "To depth must be greater than from depth.",
    });
  });

  it("leaves a change to part of a record for the upload to check whole", () => {
    expect(
      prepareOperation({
        op: "PATCH",
        table: "core_boxes",
        id: ID,
        data: { to_m: 3, version: 2 },
      }),
    ).toMatchObject({ ok: true, kind: "patch" });
  });
});
