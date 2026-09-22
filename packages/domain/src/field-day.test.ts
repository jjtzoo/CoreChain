// The "day in the field" test scenario (fixtures/mb-ddh-001.json), used to
// write the field-test guide. Running every record through the app's own
// rules means the guide can never tell a tester to type something the app
// would refuse.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  analyseContinuity,
  drilledLengthM,
  recoveryPercent,
  rqdPercent,
  validateBoxInput,
  validateRunInput,
} from "./core";
import { buildExportTables } from "./export";
import type { FieldDrillhole } from "./field";
import { validateDrillholeInput, validateProjectInput } from "./field";
import {
  loggedLengthM,
  STARTER_CODES,
  validateIntervalInput,
  type LogInterval,
} from "./logging";
import { buildSampleTrace } from "./overview";
import {
  formatSampleNumber,
  qcAchievement,
  qcReminders,
  validateSampleInput,
  type FieldSample,
  type QcEvent,
  type SampleType,
} from "./sampling";

type Day = {
  project: {
    name: string;
    coordinateSystem: "WGS84";
    samplePrefix: string;
    nextSampleNumber: number;
    qcEveryN: number;
  };
  hole: {
    holeId: string;
    plannedDepthM: number;
    plannedAzimuthDeg: number;
    plannedInclinationDeg: number;
    collar: { latitude: number; longitude: number };
    finalDepthM: number;
  };
  runs: { fromM: number; toM: number; recoveredM: number; rqdPiecesM: number }[];
  boxes: { boxNumber: number; fromM: number; toM: number; note: string }[];
  intervals: {
    fromM: number;
    toM: number;
    lithology: string;
    alterationType: string;
    alterationIntensity: string;
    mineral: string;
    mineralStyle: string;
    mineralPercent: number | null;
    weathering: string;
    structureType: string;
    notes: string;
  }[];
  photos: { subject: "box" | "interval"; ref?: number; fromM?: number; toM?: number }[];
  samples: {
    number: string;
    type: SampleType;
    fromM?: number;
    toM?: number;
    standardRef?: string;
    duplicateOf?: string;
    note?: string;
  }[];
};

const day: Day = JSON.parse(
  readFileSync(new URL("./fixtures/mb-ddh-001.json", import.meta.url), "utf8"),
);

const blank = (text: string): string | null => (text === "" ? null : text);

describe("the field-day scenario: setup", () => {
  it("has a valid project and a valid hole", () => {
    expect(
      validateProjectInput({
        name: day.project.name,
        coordinateSystem: day.project.coordinateSystem,
        nextSampleNumber: day.project.nextSampleNumber,
      }).valid,
    ).toBe(true);

    expect(
      validateDrillholeInput(
        {
          holeId: day.hole.holeId,
          plannedDepthM: day.hole.plannedDepthM,
          plannedAzimuthDeg: day.hole.plannedAzimuthDeg,
          plannedInclinationDeg: day.hole.plannedInclinationDeg,
        },
        [],
      ).valid,
    ).toBe(true);
  });
});

describe("the field-day scenario: core runs and boxes", () => {
  it("accepts every run in order with no warnings", () => {
    const saved: { fromM: number; toM: number }[] = [];
    for (const run of day.runs) {
      const result = validateRunInput(run, saved);
      expect(result.valid, `run ${run.fromM}-${run.toM}`).toBe(true);
      expect(result.warnings, `run ${run.fromM}-${run.toM}`).toEqual([]);
      saved.push(run);
    }
    expect(day.runs).toHaveLength(15);
  });

  it("covers the whole hole with no gaps or overlaps", () => {
    const report = analyseContinuity(day.runs);
    expect(report.gaps).toEqual([]);
    expect(report.overlaps).toEqual([]);
    expect(day.runs[0]!.fromM).toBe(0);
    expect(day.runs[day.runs.length - 1]!.toM).toBe(day.hole.finalDepthM);
  });

  it("gives 94.5% recovery overall and the per-run figures the guide quotes", () => {
    const drilled = day.runs.reduce((n, r) => n + drilledLengthM(r), 0);
    const recovered = day.runs.reduce((n, r) => n + r.recoveredM, 0);
    expect(Math.round(drilled * 100) / 100).toBe(45.3);
    expect(Math.round(recovered * 100) / 100).toBe(42.81);
    expect(recoveryPercent(drilled, recovered)).toBe(94.5);

    expect(recoveryPercent(3, 1.8)).toBe(60);
    expect(rqdPercent(3, 0.4)).toBe(13.3);
    expect(recoveryPercent(3, 2.7)).toBe(90);
    expect(rqdPercent(3, 1.6)).toBe(53.3);
  });

  it("accepts every box in order with no warnings, covering the hole", () => {
    const saved: { boxNumber: number; fromM: number; toM: number }[] = [];
    for (const box of day.boxes) {
      const result = validateBoxInput(box, saved);
      expect(result.valid, `box ${box.boxNumber}`).toBe(true);
      expect(result.warnings, `box ${box.boxNumber}`).toEqual([]);
      saved.push(box);
    }
    expect(day.boxes).toHaveLength(9);
    expect(day.boxes[day.boxes.length - 1]!.toM).toBe(day.hole.finalDepthM);
  });
});

describe("the field-day scenario: core log", () => {
  const codes = new Map<string, Set<string>>();
  for (const c of STARTER_CODES) {
    codes.set(c.category, (codes.get(c.category) ?? new Set()).add(c.code));
  }

  it("uses only codes from the starter code library", () => {
    const check = (category: string, code: string) => {
      if (code !== "") {
        expect(codes.get(category)?.has(code), `${category} ${code}`).toBe(true);
      }
    };
    for (const i of day.intervals) {
      check("lithology", i.lithology);
      check("alteration_type", i.alterationType);
      check("alteration_intensity", i.alterationIntensity);
      check("mineral", i.mineral);
      check("mineral_style", i.mineralStyle);
      check("weathering", i.weathering);
      check("structure_type", i.structureType);
    }
  });

  it("accepts every interval in order with no warnings", () => {
    const saved: { fromM: number; toM: number }[] = [];
    for (const interval of day.intervals) {
      const result = validateIntervalInput(
        {
          fromM: interval.fromM,
          toM: interval.toM,
          mineralPercent: interval.mineralPercent,
        },
        saved,
      );
      expect(result.valid, `interval ${interval.fromM}-${interval.toM}`).toBe(true);
      expect(result.warnings).toEqual([]);
      saved.push(interval);
    }
    expect(day.intervals).toHaveLength(12);
  });

  it("logs the whole hole, 45.3 of 45.3 m", () => {
    expect(loggedLengthM(day.intervals)).toBe(45.3);
    const report = analyseContinuity(day.intervals);
    expect(report.gaps).toEqual([]);
    expect(report.overlaps).toEqual([]);
  });
});

/** Turns the fixture's samples into saved records, in the order they are made. */
function savedSamples(upTo: number): FieldSample[] {
  return day.samples.slice(0, upTo).map((s, index) => ({
    id: `sample-${index + 1}`,
    projectId: "p",
    drillholeId: "h",
    sampleNumber: s.number,
    type: s.type,
    fromM: s.type === "duplicate" ? null : (s.fromM ?? null),
    toM: s.type === "duplicate" ? null : (s.toM ?? null),
    standardRef: s.standardRef ?? null,
    parentSampleId: s.duplicateOf
      ? `sample-${day.samples.findIndex((p) => p.number === s.duplicateOf) + 1}`
      : null,
    note: s.note ?? null,
    status: "created" as const,
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
    version: 1,
    deletedAt: null,
  }));
}

describe("the field-day scenario: samples and QC", () => {
  it("numbers samples MB-00001 onwards in the order they are made", () => {
    day.samples.forEach((s, i) => {
      expect(s.number).toBe(
        formatSampleNumber(day.project.samplePrefix, day.project.nextSampleNumber + i),
      );
    });
  });

  it("accepts every sample in order", () => {
    day.samples.forEach((s, index) => {
      const before = savedSamples(index);
      const parent = s.duplicateOf
        ? before.find((b) => b.sampleNumber === s.duplicateOf)
        : undefined;
      const result = validateSampleInput(
        {
          sampleNumber: s.number,
          type: s.type,
          fromM: s.fromM,
          toM: s.toM,
          standardRef: s.standardRef,
          parentSampleId: parent?.id,
        },
        {
          holeDepthM: day.hole.finalDepthM,
          existingNumbers: before.map((b) => b.sampleNumber),
          holeSamples: before,
        },
      );
      expect(result.valid, s.number).toBe(true);
    });
    expect(day.samples).toHaveLength(25);
  });

  it("shows all three QC reminders after the 20th primary, then none once they are inserted", () => {
    const rates = {
      standardEveryN: day.project.qcEveryN,
      blankEveryN: day.project.qcEveryN,
      duplicateEveryN: day.project.qcEveryN,
    };
    const eventsAfter = (count: number): QcEvent[] =>
      savedSamples(count).map((s) => ({ kind: "sample" as const, type: s.type }));

    // 19 primaries: nothing due yet. 20: all three due.
    expect(qcReminders(eventsAfter(19), rates)).toEqual([]);
    expect(qcReminders(eventsAfter(20), rates).map((r) => r.controlType).sort()).toEqual([
      "blank",
      "duplicate",
      "standard",
    ]);
    expect(qcReminders(eventsAfter(20), rates)[0]!.sinceLast).toBe(20);

    // Standard, blank and duplicate inserted (samples 21 to 23): cleared.
    expect(qcReminders(eventsAfter(23), rates)).toEqual([]);
    expect(qcReminders(eventsAfter(25), rates)).toEqual([]);
  });

  it("finishes with 22 primaries and one of each control", () => {
    const rates = {
      standardEveryN: day.project.qcEveryN,
      blankEveryN: day.project.qcEveryN,
      duplicateEveryN: day.project.qcEveryN,
    };
    const result = qcAchievement(savedSamples(25), rates);
    expect(result.map((r) => [r.controlType, r.count, r.achievedEveryN])).toEqual([
      ["standard", 1, 22],
      ["blank", 1, 22],
      ["duplicate", 1, 22],
    ]);
  });

  it("makes the duplicate copy its parent's depth", () => {
    const parent = day.samples.find((s) => s.number === "MB-00012")!;
    expect(parent.fromM).toBe(27);
    expect(parent.toM).toBe(28.2);
  });
});

describe("the field-day scenario: traceability and export", () => {
  const hole = {
    holeId: day.hole.holeId,
    collar: {
      source: "manual" as const,
      latitude: day.hole.collar.latitude,
      longitude: day.hole.collar.longitude,
      accuracyM: null,
      capturedAt: "2026-09-19T00:00:00.000Z",
    },
  };
  const boxes = day.boxes.map((b) => ({
    boxNumber: b.boxNumber,
    fromM: b.fromM,
    toM: b.toM,
    photoCount: day.photos.filter((p) => p.subject === "box" && p.ref === b.boxNumber).length,
  }));
  const intervals = day.intervals.map((i) => ({
    fromM: i.fromM,
    toM: i.toM,
    lithology: blank(i.lithology),
    alterationType: blank(i.alterationType),
  }));
  const trace = (number: string) => {
    const s = day.samples.find((x) => x.number === number)!;
    return buildSampleTrace({
      sample: {
        sampleNumber: s.number,
        type: s.type,
        fromM: s.fromM ?? null,
        toM: s.toM ?? null,
        status: "created",
        standardRef: s.standardRef ?? null,
      },
      hole,
      boxes,
      intervals,
    });
  };

  it("traces the visible-gold sample back to Box 6 and the quartz vein", () => {
    const steps = trace("MB-00012");
    expect(steps.find((s) => s.key === "box")).toMatchObject({
      title: "Box 6 · 27–28.2 m",
      detail: "1 photo",
      state: "done",
    });
    expect(steps.find((s) => s.key === "interval")).toMatchObject({
      detail: "QV · SIL",
      state: "done",
    });
  });

  it("traces the last sample across two logged intervals", () => {
    const steps = trace("MB-00025");
    expect(steps.find((s) => s.key === "box")!.title).toBe("Box 8 · 38–40 m");
    expect(steps.find((s) => s.key === "interval")!.detail).toBe("GRD · PROP (+1 more)");
  });

  it("finds no missing links anywhere in the day", () => {
    for (const s of day.samples.filter((x) => x.type === "primary")) {
      expect(
        trace(s.number).filter((step) => step.state === "missing"),
        s.number,
      ).toEqual([]);
    }
  });

  it("exports five files with the row counts the guide quotes", () => {
    const now = "2026-09-19T00:00:00.000Z";
    const drillhole: FieldDrillhole = {
      id: "h",
      projectId: "p",
      holeId: day.hole.holeId,
      collar: hole.collar,
      plannedAzimuthDeg: day.hole.plannedAzimuthDeg,
      plannedInclinationDeg: day.hole.plannedInclinationDeg,
      plannedDepthM: day.hole.plannedDepthM,
      actualFinalDepthM: day.hole.finalDepthM,
      startedAt: "2026-09-16",
      completedAt: "2026-09-18",
      status: "logged",
      contractor: null,
      drillType: null,
      diameter: null,
      note: null,
      priority: "normal",
      priorityNote: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
      deletedAt: null,
    };
    const tables = buildExportTables({
      project: { name: day.project.name, coordinateSystem: day.project.coordinateSystem },
      drillholes: [drillhole],
      runs: day.runs.map((r, i) => ({
        id: `r${i}`,
        drillholeId: "h",
        fromM: r.fromM,
        toM: r.toM,
        recoveredM: r.recoveredM,
        rqdPiecesM: r.rqdPiecesM,
        createdAt: now,
        updatedAt: now,
        version: 1,
        deletedAt: null,
      })),
      intervals: day.intervals.map(
        (i, n): LogInterval => ({
          id: `i${n}`,
          drillholeId: "h",
          fromM: i.fromM,
          toM: i.toM,
          lithology: blank(i.lithology),
          alterationType: blank(i.alterationType),
          alterationIntensity: blank(i.alterationIntensity),
          mineral: blank(i.mineral),
          mineralStyle: blank(i.mineralStyle),
          mineralPercent: i.mineralPercent,
          weathering: blank(i.weathering),
          structureType: blank(i.structureType),
          notes: blank(i.notes),
          createdAt: now,
          updatedAt: now,
          version: 1,
          deletedAt: null,
        }),
      ),
      samples: savedSamples(25),
    });

    expect(tables.map((t) => [t.filename, t.rowCount])).toEqual([
      ["masbate-gold-pilot-collars.csv", 1],
      ["masbate-gold-pilot-surveys.csv", 1],
      ["masbate-gold-pilot-log.csv", 12],
      ["masbate-gold-pilot-runs.csv", 15],
      ["masbate-gold-pilot-samples.csv", 25],
    ]);
  });
});
