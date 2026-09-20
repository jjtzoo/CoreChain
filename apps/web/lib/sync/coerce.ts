import type { Column } from "./tables";

// Checks one value from a phone against its column's type, and returns it in the
// form the database expects. Never throws: a bad value is a refused operation,
// not a crashed request.

export type Coerced =
  { ok: true; value: unknown } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_MAX_TEXT = 2000;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

export function coerceValue(column: Column, raw: unknown): Coerced {
  if (raw === null || raw === undefined) {
    return column.nullable
      ? { ok: true, value: null }
      : { ok: false, error: "is required" };
  }

  const type = column.type;
  if (typeof type === "object") {
    return typeof raw === "string" && type.values.includes(raw)
      ? { ok: true, value: raw }
      : { ok: false, error: `must be one of ${type.values.join(", ")}` };
  }

  switch (type) {
    case "uuid":
      return isUuid(raw)
        ? { ok: true, value: raw.toLowerCase() }
        : { ok: false, error: "must be an id" };
    case "text": {
      if (typeof raw !== "string") return { ok: false, error: "must be text" };
      if (raw.includes(String.fromCharCode(0)))
        return { ok: false, error: "has an invalid character" };
      return raw.length <= (column.max ?? DEFAULT_MAX_TEXT)
        ? { ok: true, value: raw }
        : { ok: false, error: "is too long" };
    }
    case "int":
      return typeof raw === "number" &&
        Number.isSafeInteger(raw) &&
        Math.abs(raw) <= 2_000_000_000
        ? { ok: true, value: raw }
        : { ok: false, error: "must be a whole number" };
    case "float":
      return typeof raw === "number" && Number.isFinite(raw)
        ? { ok: true, value: raw }
        : { ok: false, error: "must be a number" };
    case "bool":
      if (raw === true || raw === 1) return { ok: true, value: true };
      if (raw === false || raw === 0) return { ok: true, value: false };
      return { ok: false, error: "must be true or false" };
    case "timestamptz": {
      if (typeof raw !== "string")
        return { ok: false, error: "must be a date and time" };
      const time = Date.parse(raw);
      return Number.isNaN(time)
        ? { ok: false, error: "must be a date and time" }
        : { ok: true, value: new Date(time).toISOString() };
    }
    case "day":
      return typeof raw === "string" &&
        DAY.test(raw) &&
        !Number.isNaN(Date.parse(raw))
        ? { ok: true, value: raw }
        : { ok: false, error: "must be a day (YYYY-MM-DD)" };
  }
}
