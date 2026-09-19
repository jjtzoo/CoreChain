// Date text typed into forms (a drillhole's started/completed dates).
//
// Geologists type dates by hand, so `2026/09/19` and `2026.9.19` are accepted
// and tidied into `2026-09-19`; anything that isn't a real calendar date is
// refused rather than stored as free text that later breaks an export.

export type DateInputResult =
  | { valid: true; value: string | null }
  | { valid: false; error: string };

const DATE_TEXT = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;

/**
 * Turns typed text into a `YYYY-MM-DD` date. Empty text is valid and means
 * "not set". `label` names the field in the error message.
 */
export function normaliseDateInput(text: string, label: string): DateInputResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: true, value: null };
  }

  const error: DateInputResult = {
    valid: false,
    error: `${label} must be a date like 2026-09-19.`,
  };
  const match = DATE_TEXT.exec(trimmed);
  if (!match) {
    return error;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const real = new Date(Date.UTC(year, month - 1, day));
  if (
    real.getUTCFullYear() !== year ||
    real.getUTCMonth() !== month - 1 ||
    real.getUTCDate() !== day
  ) {
    return error;
  }

  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return { valid: true, value: `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` };
}

export type ActualDatesResult =
  | { valid: true; startedAt: string | null; completedAt: string | null }
  | { valid: false; errors: { startedAt?: string; completedAt?: string } };

/** Validates a hole's started and completed dates together. */
export function validateActualDates(
  startedText: string,
  completedText: string,
): ActualDatesResult {
  const started = normaliseDateInput(startedText, "Started");
  const completed = normaliseDateInput(completedText, "Completed");

  const errors: { startedAt?: string; completedAt?: string } = {};
  if (!started.valid) {
    errors.startedAt = started.error;
  }
  if (!completed.valid) {
    errors.completedAt = completed.error;
  }
  if (!started.valid || !completed.valid) {
    return { valid: false, errors };
  }

  // ISO dates compare correctly as text.
  if (
    started.value != null &&
    completed.value != null &&
    completed.value < started.value
  ) {
    return {
      valid: false,
      errors: { completedAt: "Completed can't be before the started date." },
    };
  }

  return {
    valid: true,
    startedAt: started.value,
    completedAt: completed.value,
  };
}

/**
 * A date as `YYYY-MM-DD` in the device's own time zone. (Not `toISOString`,
 * which is UTC and would give the wrong day for an evening entry in a
 * timezone ahead of UTC, such as the Philippines.)
 */
export function localDateToIso(date: Date): string {
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`;
}

/** Today's date as `YYYY-MM-DD`, in the device's time zone. */
export function todayIso(now: Date = new Date()): string {
  return localDateToIso(now);
}

/**
 * A `YYYY-MM-DD` (or tidy-able) date as a Date at local noon, so daylight
 * saving shifts can't move it to a neighbouring day. Null for empty or
 * invalid text.
 */
export function isoToLocalDate(text: string | null): Date | null {
  if (text == null) {
    return null;
  }
  const result = normaliseDateInput(text, "Date");
  if (!result.valid || result.value == null) {
    return null;
  }
  const [year, month, day] = result.value.split("-").map(Number);
  return new Date(year!, month! - 1, day!, 12, 0, 0);
}
