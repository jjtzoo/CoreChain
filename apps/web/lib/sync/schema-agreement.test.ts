import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  SET_ONCE_COLUMNS,
  SYNCED_TABLES,
} from "../../../mobile/src/sync/syncedTables";
import { SYNC_TABLES, type ColumnType } from "./tables";

// The upload rules (tables.ts) decide how each value is cast in SQL; the real
// column types live in prisma/schema.prisma. If the two disagree, Postgres
// refuses every write to that column, and the phone (which never retries a
// refused change) loses it. This happened once with a date column, so the
// agreement is checked here for every synced table and column.

const schema = readFileSync(
  new URL("../../prisma/schema.prisma", import.meta.url),
  "utf8",
);

type Field = { type: string; optional: boolean; attrs: string };

function readModels(): Map<string, Map<string, Field>> {
  const models = new Map<string, Map<string, Field>>();
  for (const match of schema.matchAll(/^model \w+ \{([\s\S]*?)^\}/gm)) {
    const body = match[1];
    const table = /@@map\("([^"]+)"\)/.exec(body)?.[1];
    if (!table) continue;
    const fields = new Map<string, Field>();
    for (const line of body.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith("@@") || trimmed.startsWith("//")) continue;
      const field = /^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(trimmed);
      if (!field) continue;
      const column = /@map\("([^"]+)"\)/.exec(field[5])?.[1] ?? field[1];
      fields.set(column, {
        type: field[2],
        optional: field[4] === "?",
        attrs: field[5],
      });
    }
    models.set(table, fields);
  }
  return models;
}

function readEnums(): Map<string, string[]> {
  const enums = new Map<string, string[]>();
  for (const match of schema.matchAll(/^enum (\w+) \{([\s\S]*?)^\}/gm)) {
    enums.set(
      match[1],
      match[2]
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("//")),
    );
  }
  return enums;
}

/** What the database column must look like for the way the server casts it. */
function problem(type: ColumnType, field: Field): string | null {
  const db = /@db\.(\w+)/.exec(field.attrs)?.[1];
  if (typeof type === "object") {
    return field.type === type.enum ? null : `must be the ${type.enum} enum`;
  }
  switch (type) {
    case "uuid":
      return field.type === "String" && db === "Uuid" ? null : "must be a uuid";
    case "text":
      return field.type === "String" && !db ? null : "must be plain text";
    case "day":
      // Days travel as YYYY-MM-DD text, like started_at and completed_at. A
      // real DATE column refuses the server's text cast.
      return field.type === "String" && !db
        ? null
        : "must be plain text (a day is stored as YYYY-MM-DD text)";
    case "int":
      return field.type === "Int" && !db ? null : "must be an integer";
    case "float":
      return field.type === "Float" ? null : "must be a float";
    case "bool":
      return field.type === "Boolean" ? null : "must be a boolean";
    case "timestamptz":
      return field.type === "DateTime" && db === "Timestamptz"
        ? null
        : "must be a timestamptz";
  }
}

const models = readModels();
const enums = readEnums();

describe("upload rules agree with the database schema", () => {
  for (const spec of Object.values(SYNC_TABLES)) {
    describe(spec.name, () => {
      const fields = models.get(spec.name);

      it("has a table in the schema", () => {
        expect(fields, `no model maps to "${spec.name}"`).toBeDefined();
      });
      if (!fields) return;

      for (const [name, column] of Object.entries(spec.columns)) {
        it(`${name} matches its database column`, () => {
          const field = fields.get(name);
          expect(field, `no column "${name}"`).toBeDefined();
          if (!field) return;
          expect(
            problem(column.type, field),
            `${spec.name}.${name}`,
          ).toBeNull();
          if (column.nullable) {
            expect(
              field.optional,
              `${spec.name}.${name} may be null in the rules but not in the database`,
            ).toBe(true);
          }
          if (typeof column.type === "object") {
            expect(
              [...column.type.values].sort(),
              `${spec.name}.${name} values`,
            ).toEqual([...(enums.get(column.type.enum) ?? [])].sort());
          }
        });
      }

      it("has the columns the server fills in itself", () => {
        for (const name of ["organization_id", "created_by"]) {
          if (name === "created_by" && spec.name === "drillhole_status_history")
            continue;
          const field = fields.get(name);
          expect(field, `no column "${name}"`).toBeDefined();
          expect(field?.type).toBe("String");
        }
        if (spec.parent === "drillhole") {
          expect(fields.get("project_id")?.attrs).toContain("@db.Uuid");
        }
      });
    });
  }
});

// The phone (apps/mobile) keeps its own copy of two lists. They are plain
// constants with no React Native imports, so they can be read here, and a
// disagreement fails this test instead of losing a change in the field.
describe("the phone and the server agree", () => {
  it("sync the same tables", () => {
    expect([...SYNCED_TABLES].sort()).toEqual(Object.keys(SYNC_TABLES).sort());
  });

  it("the phone never sends a column the server treats as fixed", () => {
    // The phone sends the whole row on an update, so every column the server
    // refuses to change must be stripped first (see toWireOperation).
    const fixed = new Set<string>();
    for (const spec of Object.values(SYNC_TABLES)) {
      if (spec.appendOnly) continue; // never updated at all
      for (const [name, column] of Object.entries(spec.columns)) {
        if (column.immutable) fixed.add(name);
      }
    }
    const stripped = new Set<string>(SET_ONCE_COLUMNS);
    expect([...fixed].filter((name) => !stripped.has(name))).toEqual([]);
  });
});
