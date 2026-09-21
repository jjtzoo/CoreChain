import { coerceValue, isUuid } from "./coerce";
import { SYNC_TABLES, type ColumnType, type TableSpec } from "./tables";

// Turns one operation from a phone into something safe to run, or a reason it
// was refused. No database here: everything the server can decide from the
// operation alone is decided in this file, and tested without a database.

export type Rejection =
  | "bad-operation"
  | "unknown-table"
  | "bad-id"
  | "hard-delete-not-allowed"
  | "unknown-column"
  | "invalid-value"
  | "missing-value"
  | "immutable-column"
  | "append-only"
  | "missing-version";

export type Prepared =
  | {
      ok: true;
      kind: "put" | "patch";
      spec: TableSpec;
      id: string;
      values: Record<string, unknown>;
    }
  | { ok: false; reason: Rejection; detail?: string };

export function prepareOperation(raw: unknown): Prepared {
  if (raw === null || typeof raw !== "object")
    return { ok: false, reason: "bad-operation" };
  const op = raw as {
    op?: unknown;
    table?: unknown;
    id?: unknown;
    data?: unknown;
  };

  if (op.op === "DELETE")
    return { ok: false, reason: "hard-delete-not-allowed" };
  if (op.op !== "PUT" && op.op !== "PATCH")
    return { ok: false, reason: "bad-operation" };
  const kind = op.op === "PUT" ? "put" : "patch";

  const spec = typeof op.table === "string" ? SYNC_TABLES[op.table] : undefined;
  if (!spec) return { ok: false, reason: "unknown-table" };
  if (!isUuid(op.id)) return { ok: false, reason: "bad-id" };
  const id = op.id.toLowerCase();

  const data =
    op.data && typeof op.data === "object" && !Array.isArray(op.data)
      ? (op.data as Record<string, unknown>)
      : {};
  if (kind === "patch" && spec.appendOnly)
    return { ok: false, reason: "append-only" };

  const values: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(data)) {
    if (name === "id") continue; // the operation's own id is the row's id
    const column = spec.columns[name];
    if (!column) return { ok: false, reason: "unknown-column", detail: name };
    if (kind === "patch" && column.immutable)
      return { ok: false, reason: "immutable-column", detail: name };
    const coerced = coerceValue(column, value);
    if (!coerced.ok)
      return {
        ok: false,
        reason: "invalid-value",
        detail: `${name} ${coerced.error}`,
      };
    values[name] = coerced.value;
  }

  if (kind === "put") {
    for (const [name, column] of Object.entries(spec.columns)) {
      if (name === "id" || !column.required) continue;
      if (values[name] === undefined)
        return { ok: false, reason: "missing-value", detail: name };
    }
  } else if (spec.columns.version && values.version === undefined) {
    // A change must say which version it makes, so an old edit can't overwrite a newer one.
    return { ok: false, reason: "missing-version" };
  }

  return { ok: true, kind, spec, id, values };
}

function cast(type: ColumnType): string {
  if (typeof type === "object") return `"${type.enum}"`;
  switch (type) {
    case "uuid":
      return "uuid";
    case "int":
      return "integer";
    case "float":
      return "double precision";
    case "bool":
      return "boolean";
    case "timestamptz":
      return "timestamptz";
    default:
      return "text";
  }
}

export type Statement = { sql: string; params: unknown[] };

/**
 * INSERT for a new row. `server` are the columns the phone must not choose
 * (organization_id, created_by, project_id where derived). A replay of the same
 * row does nothing (ON CONFLICT DO NOTHING), which is what makes a retried
 * upload safe.
 */
export function insertStatement(
  spec: TableSpec,
  id: string,
  values: Record<string, unknown>,
  server: Record<string, unknown>,
): Statement {
  const columns: string[] = ["id"];
  const params: unknown[] = [id];
  const placeholders: string[] = ["$1::uuid"];
  const add = (name: string, value: unknown, castTo: string) => {
    columns.push(name);
    params.push(value);
    placeholders.push(`$${params.length}::${castTo}`);
  };
  for (const [name, value] of Object.entries(values))
    add(name, value, cast(spec.columns[name].type));
  for (const [name, value] of Object.entries(server))
    add(name, value, name === "project_id" ? "uuid" : "text");
  return {
    sql: `INSERT INTO "${spec.name}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders.join(", ")}) ON CONFLICT ("id") DO NOTHING`,
    params,
  };
}

/**
 * UPDATE for an existing row, only if the change carries a higher version than
 * the row has and the row belongs to the caller's organization.
 */
export function updateStatement(
  spec: TableSpec,
  id: string,
  values: Record<string, unknown>,
  organizationId: string,
): Statement {
  const params: unknown[] = [id, organizationId, values.version];
  const sets: string[] = [];
  for (const [name, value] of Object.entries(values)) {
    params.push(value);
    sets.push(
      `"${name}" = $${params.length}::${cast(spec.columns[name].type)}`,
    );
  }
  return {
    sql: `UPDATE "${spec.name}" SET ${sets.join(", ")} WHERE "id" = $1::uuid AND "organization_id" = $2 AND "version" < $3::integer`,
    params,
  };
}

/**
 * The server's current values for the columns a change touched, so a phone whose
 * change conflicted can show both versions side by side (E8-5).
 */
export function currentValuesStatement(
  spec: TableSpec,
  id: string,
  names: readonly string[],
  organizationId: string,
): Statement {
  const columns = names.map((name) => `"${name}"`).join(", ");
  return {
    sql: `SELECT ${columns} FROM "${spec.name}" WHERE "id" = $1::uuid AND "organization_id" = $2`,
    params: [id, organizationId],
  };
}

/**
 * Does the row already hold exactly these values? This tells a replay of the
 * same change (harmless) from a different change with the same version number
 * (two phones editing one record offline: a conflict, never a silent overwrite).
 */
export function matchStatement(
  spec: TableSpec,
  id: string,
  values: Record<string, unknown>,
  organizationId: string,
): Statement {
  const params: unknown[] = [id, organizationId];
  const checks: string[] = [];
  for (const [name, value] of Object.entries(values)) {
    params.push(value);
    checks.push(
      `"${name}" IS NOT DISTINCT FROM $${params.length}::${cast(spec.columns[name].type)}`,
    );
  }
  return {
    sql: `SELECT 1 AS same FROM "${spec.name}" WHERE "id" = $1::uuid AND "organization_id" = $2${checks.length ? " AND " + checks.join(" AND ") : ""}`,
    params,
  };
}
