import { describe, expect, it } from "vitest";
import { coerceValue } from "./coerce";
import {
  insertStatement,
  matchStatement,
  prepareOperation,
  updateStatement,
} from "./prepare";
import { SYNC_TABLES } from "./tables";

const ID = "3b1f6a0e-7c1d-4f7a-9a52-0d2d6f1c9e11";
const PROJECT = "a0a0a0a0-1111-4222-8333-444455556666";
const NOW = "2026-09-20T05:55:28.964000Z";

const box = {
  drillhole_id: PROJECT,
  box_number: 3,
  from_m: 9,
  to_m: 12,
  created_at: NOW,
  updated_at: NOW,
  version: 1,
};

describe("prepareOperation", () => {
  it("accepts a new row with every required column", () => {
    const result = prepareOperation({
      op: "PUT",
      table: "core_boxes",
      id: ID,
      data: box,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kind).toBe("put");
      expect(result.values.created_at).toBe("2026-09-20T05:55:28.964Z");
    }
  });

  it("refuses a new row that is missing a required column", () => {
    const { to_m: _omit, ...partial } = box;
    expect(
      prepareOperation({
        op: "PUT",
        table: "core_boxes",
        id: ID,
        data: partial,
      }),
    ).toEqual({
      ok: false,
      reason: "missing-value",
      detail: "to_m",
    });
  });

  it("refuses tables and columns it does not know", () => {
    expect(
      prepareOperation({ op: "PUT", table: "user", id: ID, data: {} }),
    ).toMatchObject({ reason: "unknown-table" });
    expect(
      prepareOperation({
        op: "PUT",
        table: "core_boxes",
        id: ID,
        data: { ...box, created_by: "x" },
      }),
    ).toMatchObject({
      reason: "unknown-column",
      detail: "created_by",
    });
    // Tables that are the server's to write.
    for (const table of [
      "devices",
      "sample_number_blocks",
      "audit_events",
      "account",
      "session",
    ]) {
      expect(
        prepareOperation({ op: "PUT", table, id: ID, data: {} }),
      ).toMatchObject({ reason: "unknown-table" });
    }
  });

  it("refuses a hard delete: rows are removed by setting deleted_at", () => {
    expect(
      prepareOperation({ op: "DELETE", table: "core_boxes", id: ID }),
    ).toEqual({ ok: false, reason: "hard-delete-not-allowed" });
  });

  it("refuses a bad id or operation", () => {
    expect(
      prepareOperation({ op: "PUT", table: "core_boxes", id: "1", data: box }),
    ).toMatchObject({ reason: "bad-id" });
    expect(
      prepareOperation({ op: "UPSERT", table: "core_boxes", id: ID }),
    ).toMatchObject({ reason: "bad-operation" });
    expect(prepareOperation(null)).toMatchObject({ reason: "bad-operation" });
  });

  it("refuses values of the wrong type", () => {
    const result = prepareOperation({
      op: "PUT",
      table: "core_boxes",
      id: ID,
      data: { ...box, from_m: "nine" },
    });
    expect(result).toMatchObject({ ok: false, reason: "invalid-value" });
  });

  it("accepts a change that names its version and refuses one that does not", () => {
    expect(
      prepareOperation({
        op: "PATCH",
        table: "core_boxes",
        id: ID,
        data: { to_m: 13, version: 2, updated_at: NOW },
      }).ok,
    ).toBe(true);
    expect(
      prepareOperation({
        op: "PATCH",
        table: "core_boxes",
        id: ID,
        data: { to_m: 13 },
      }),
    ).toMatchObject({ reason: "missing-version" });
  });

  it("refuses to change a column that is set once", () => {
    expect(
      prepareOperation({
        op: "PATCH",
        table: "core_boxes",
        id: ID,
        data: { drillhole_id: PROJECT, version: 2 },
      }),
    ).toMatchObject({
      reason: "immutable-column",
    });
    expect(
      prepareOperation({
        op: "PATCH",
        table: "samples",
        id: ID,
        data: { sample_number: "S-2", version: 2 },
      }),
    ).toMatchObject({
      reason: "immutable-column",
    });
  });

  it("never lets an append-only record be changed", () => {
    expect(
      prepareOperation({
        op: "PATCH",
        table: "qc_dismissals",
        id: ID,
        data: { reason: "changed my mind" },
      }),
    ).toEqual({
      ok: false,
      reason: "append-only",
    });
  });

  it("accepts a soft delete", () => {
    expect(
      prepareOperation({
        op: "PATCH",
        table: "core_boxes",
        id: ID,
        data: { deleted_at: NOW, version: 3 },
      }).ok,
    ).toBe(true);
  });
});

describe("coerceValue", () => {
  it("turns the phone's 0/1 into a boolean and normalises times", () => {
    expect(coerceValue(SYNC_TABLES.code_library.columns.hidden, 1)).toEqual({
      ok: true,
      value: true,
    });
    expect(coerceValue(SYNC_TABLES.code_library.columns.hidden, 0)).toEqual({
      ok: true,
      value: false,
    });
    expect(
      coerceValue(
        SYNC_TABLES.projects.columns.created_at,
        "2026-09-20T05:55:28Z",
      ),
    ).toEqual({
      ok: true,
      value: "2026-09-20T05:55:28.000Z",
    });
  });

  it("checks enums, days, numbers and text length", () => {
    expect(
      coerceValue(SYNC_TABLES.drillholes.columns.status, "drilling").ok,
    ).toBe(true);
    expect(
      coerceValue(SYNC_TABLES.drillholes.columns.status, "finished").ok,
    ).toBe(false);
    expect(
      coerceValue(SYNC_TABLES.drillholes.columns.started_at, "2026-09-20").ok,
    ).toBe(true);
    expect(
      coerceValue(SYNC_TABLES.drillholes.columns.started_at, "20 Sep").ok,
    ).toBe(false);
    expect(
      coerceValue(SYNC_TABLES.core_boxes.columns.from_m, Number.NaN).ok,
    ).toBe(false);
    expect(coerceValue(SYNC_TABLES.core_boxes.columns.box_number, 2.5).ok).toBe(
      false,
    );
    expect(
      coerceValue(SYNC_TABLES.projects.columns.name, "x".repeat(201)).ok,
    ).toBe(false);
    expect(
      coerceValue(
        SYNC_TABLES.projects.columns.name,
        "bad" + String.fromCharCode(0) + "name",
      ).ok,
    ).toBe(false);
  });

  it("allows null only where the column allows it", () => {
    expect(coerceValue(SYNC_TABLES.core_boxes.columns.note, null).ok).toBe(
      true,
    );
    expect(coerceValue(SYNC_TABLES.core_boxes.columns.from_m, null).ok).toBe(
      false,
    );
  });
});

describe("statements", () => {
  it("compares a change with what the row already holds, treating null as equal to null", () => {
    const spec = SYNC_TABLES.core_boxes;
    const statement = matchStatement(
      spec,
      ID,
      { note: null, version: 2 },
      "org-1",
    );
    expect(statement.sql).toContain('"note" IS NOT DISTINCT FROM $3::text');
    expect(statement.sql).toContain(
      '"version" IS NOT DISTINCT FROM $4::integer',
    );
    expect(statement.params).toEqual([ID, "org-1", null, 2]);
  });

  it("builds a parameterised insert that ignores a replay", () => {
    const spec = SYNC_TABLES.core_boxes;
    const prepared = prepareOperation({
      op: "PUT",
      table: "core_boxes",
      id: ID,
      data: box,
    });
    if (!prepared.ok) throw new Error("should prepare");
    const statement = insertStatement(spec, prepared.id, prepared.values, {
      organization_id: "user-1",
      created_by: "user-1",
      project_id: PROJECT,
    });
    expect(statement.sql).toContain('INSERT INTO "core_boxes"');
    expect(statement.sql).toContain('ON CONFLICT ("id") DO NOTHING');
    expect(statement.sql).toContain('"created_by"');
    // Values are never written into the SQL text.
    expect(statement.sql).not.toContain("user-1");
    expect(statement.params).toContain("user-1");
  });

  it("only updates a row in the caller's organization and only to a higher version", () => {
    const spec = SYNC_TABLES.core_boxes;
    const statement = updateStatement(
      spec,
      ID,
      { to_m: 13, version: 2 },
      "user-1",
    );
    expect(statement.sql).toContain('"organization_id" = $2');
    expect(statement.sql).toContain('"version" < $3::integer');
    expect(statement.params.slice(0, 3)).toEqual([ID, "user-1", 2]);
  });

  it("casts enum columns to their Postgres type", () => {
    const spec = SYNC_TABLES.drillholes;
    const statement = updateStatement(
      spec,
      ID,
      { status: "complete", version: 4 },
      "user-1",
    );
    expect(statement.sql).toContain('"status" = $4::"DrillholeStatus"');
  });
});
