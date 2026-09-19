import { describe, expect, it } from "vitest";
import {
  isoToLocalDate,
  localDateToIso,
  normaliseDateInput,
  todayIso,
  validateActualDates,
} from "./dates";

describe("normaliseDateInput", () => {
  it("treats empty text as not set", () => {
    expect(normaliseDateInput("", "Started")).toEqual({ valid: true, value: null });
    expect(normaliseDateInput("   ", "Started")).toEqual({
      valid: true,
      value: null,
    });
  });

  it("keeps a proper ISO date as it is", () => {
    expect(normaliseDateInput("2026-09-19", "Started")).toEqual({
      valid: true,
      value: "2026-09-19",
    });
  });

  it("tidies slashes, dots and missing zeros into an ISO date", () => {
    for (const typed of ["2026/09/19", "2026.09.19", "2026-9-19", " 2026/9/19 "]) {
      expect(normaliseDateInput(typed, "Started")).toEqual({
        valid: true,
        value: "2026-09-19",
      });
    }
  });

  it("refuses dates that don't exist", () => {
    for (const typed of ["2026-02-30", "2026-13-01", "2026-00-10", "2026-09-31"]) {
      expect(normaliseDateInput(typed, "Started").valid).toBe(false);
    }
  });

  it("accepts a real leap day and refuses a fake one", () => {
    expect(normaliseDateInput("2028-02-29", "Started").valid).toBe(true);
    expect(normaliseDateInput("2027-02-29", "Started").valid).toBe(false);
  });

  it("refuses text that isn't a date and names the field", () => {
    const result = normaliseDateInput("yesterday", "Completed");
    expect(result).toEqual({
      valid: false,
      error: "Completed must be a date like 2026-09-19.",
    });
    expect(normaliseDateInput("19/09/2026", "Started").valid).toBe(false);
    expect(normaliseDateInput("2026-09", "Started").valid).toBe(false);
  });
});

describe("validateActualDates", () => {
  it("accepts both empty, one set, or both set in order", () => {
    expect(validateActualDates("", "")).toEqual({
      valid: true,
      startedAt: null,
      completedAt: null,
    });
    expect(validateActualDates("2026/09/19", "")).toEqual({
      valid: true,
      startedAt: "2026-09-19",
      completedAt: null,
    });
    expect(validateActualDates("2026-09-19", "2026-09-19").valid).toBe(true);
    expect(validateActualDates("2026-09-19", "2026-10-02").valid).toBe(true);
  });

  it("reports each bad date on its own field", () => {
    expect(validateActualDates("nope", "2026-13-01")).toEqual({
      valid: false,
      errors: {
        startedAt: "Started must be a date like 2026-09-19.",
        completedAt: "Completed must be a date like 2026-09-19.",
      },
    });
  });

  it("refuses a completed date before the started date", () => {
    expect(validateActualDates("2026-09-19", "2026-09-01")).toEqual({
      valid: false,
      errors: { completedAt: "Completed can't be before the started date." },
    });
  });
});

describe("localDateToIso / todayIso / isoToLocalDate", () => {
  it("formats a local date without shifting the day", () => {
    // 23:30 local on the 19th must stay the 19th, whatever UTC says.
    expect(localDateToIso(new Date(2026, 8, 19, 23, 30))).toBe("2026-09-19");
    expect(localDateToIso(new Date(2026, 0, 5, 0, 5))).toBe("2026-01-05");
  });

  it("uses the given moment as 'today'", () => {
    expect(todayIso(new Date(2026, 8, 19, 17, 0))).toBe("2026-09-19");
  });

  it("round-trips a date through a Date and back", () => {
    const date = isoToLocalDate("2026-09-19");
    expect(date).not.toBeNull();
    expect(localDateToIso(date!)).toBe("2026-09-19");
  });

  it("reads a slash-style saved date too", () => {
    expect(localDateToIso(isoToLocalDate("2026/09/19")!)).toBe("2026-09-19");
  });

  it("returns null for empty or invalid text", () => {
    expect(isoToLocalDate(null)).toBeNull();
    expect(isoToLocalDate("")).toBeNull();
    expect(isoToLocalDate("2026-02-30")).toBeNull();
    expect(isoToLocalDate("soon")).toBeNull();
  });
});
