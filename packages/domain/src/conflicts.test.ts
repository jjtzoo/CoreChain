import { describe, expect, it } from "vitest";

import {
  conflictFields,
  conflictValueText,
  fieldLabel,
  resolvedValues,
  sameValue,
} from "./conflicts";

describe("sameValue", () => {
  it("treats empty things as the same", () => {
    expect(sameValue(null, "")).toBe(true);
    expect(sameValue(undefined, null)).toBe(true);
    expect(sameValue(null, "text")).toBe(false);
    expect(sameValue(0, null)).toBe(false);
  });

  it("compares numbers and numbers written as text", () => {
    expect(sameValue(5, "5")).toBe(true);
    expect(sameValue(5.5, 5.6)).toBe(false);
  });

  it("treats true and 1 the same", () => {
    expect(sameValue(true, 1)).toBe(true);
    expect(sameValue(false, 0)).toBe(true);
    expect(sameValue(true, 0)).toBe(false);
  });

  it("treats one instant written two ways as the same", () => {
    expect(
      sameValue("2026-09-21T04:00:00.000Z", "2026-09-21T04:00:00.000+00:00"),
    ).toBe(true);
    expect(
      sameValue("2026-09-21T04:00:00.000Z", "2026-09-21T05:00:00.000Z"),
    ).toBe(false);
  });
});

describe("fieldLabel", () => {
  it("reads like a label", () => {
    expect(fieldLabel("alteration_intensity")).toBe("Alteration intensity");
    expect(fieldLabel("from_m")).toBe("From (m)");
    expect(fieldLabel("planned_azimuth_deg")).toBe("Planned azimuth (degrees)");
    expect(fieldLabel("note")).toBe("Note");
  });
});

describe("conflictFields", () => {
  it("lists only the fields that really differ, and never the bookkeeping ones", () => {
    const mine = {
      note: "My note",
      status: "complete",
      qty: 3,
      version: 2,
      updated_at: "2026-09-21T04:00:00.000Z",
    };
    const theirs = {
      note: "Their note",
      status: "complete",
      qty: "3",
      version: 2,
      updated_at: "2026-09-21T05:00:00.000Z",
    };
    expect(conflictFields(mine, theirs)).toEqual([
      { field: "note", label: "Note", mine: "My note", theirs: "Their note" },
    ]);
  });

  it("finds a field only one side has, as empty on the other", () => {
    expect(conflictFields({ note: "Hi" }, {})).toEqual([
      { field: "note", label: "Note", mine: "Hi", theirs: null },
    ]);
  });

  it("returns nothing when the content is the same", () => {
    expect(
      conflictFields(
        { note: "Same", version: 3 },
        { note: "Same", version: 4 },
      ),
    ).toEqual([]);
  });
});

describe("resolvedValues", () => {
  const fields = conflictFields(
    { note: "Mine", status: "logged" },
    { note: "Theirs", status: "complete" },
  );

  it("writes the chosen side for each field", () => {
    expect(resolvedValues(fields, { note: "mine", status: "theirs" })).toEqual({
      note: "Mine",
      status: "complete",
    });
  });

  it("keeps the server's value for a field with no choice", () => {
    expect(resolvedValues(fields, { note: "mine" })).toEqual({
      note: "Mine",
      status: "complete",
    });
  });
});

describe("conflictValueText", () => {
  it("shows empty and yes/no in plain words", () => {
    expect(conflictValueText(null)).toBe("Empty");
    expect(conflictValueText("")).toBe("Empty");
    expect(conflictValueText(true)).toBe("Yes");
    expect(conflictValueText(12.5)).toBe("12.5");
  });

  it("tidies a code into words but leaves other text alone", () => {
    expect(conflictValueText("complete")).toBe("Complete");
    expect(conflictValueText("handed_over")).toBe("Handed over");
    expect(conflictValueText("Core lost at 12 m")).toBe("Core lost at 12 m");
    expect(conflictValueText("AGS-00014")).toBe("AGS-00014");
  });
});
