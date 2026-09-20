// "My work" (plan epic E14): what a geologist did on a day, a week or any range
// of dates, worked out from the records already on the phone. Work counts on
// the day it was done, not the day it synced, and editing an old record adds
// nothing new. Pure functions, so the phone and the manager view (E11) can
// share the same numbers.

import { effectiveEvents, type FieldCustodyEvent } from "./custody";
import { localDateToIso } from "./dates";
import type { SampleType } from "./sampling";

export type WorkInput = {
  intervals: readonly {
    holeName: string;
    fromM: number;
    toM: number;
    createdAt: string;
  }[];
  boxes: readonly { createdAt: string }[];
  runs: readonly { createdAt: string }[];
  samples: readonly { type: SampleType; createdAt: string }[];
  /** All custody events, so corrections on a later day still void earlier steps. */
  custody: readonly FieldCustodyEvent[];
  photos: readonly { capturedAt: string }[];
  dispatches: readonly {
    dispatchNumber: string;
    laboratory: string;
    /** YYYY-MM-DD the dispatch was handed over, null while still open. */
    handoverDay: string | null;
    sampleCount: number;
  }[];
};

/** An inclusive range of local days, YYYY-MM-DD. */
export type DayRange = { from: string; to: string };

export type HoleWork = {
  holeName: string;
  fromM: number;
  toM: number;
  metres: number;
  intervalCount: number;
};

export type DayWork = { day: string; metres: number; activity: number };

export type ActivityLine = { at: string; text: string };

export type WorkSummary = {
  range: DayRange;
  metresLogged: number;
  intervalCount: number;
  holes: HoleWork[];
  boxes: number;
  runs: number;
  samples: {
    total: number;
    qc: number;
    blank: number;
    standard: number;
    duplicate: number;
  };
  custody: {
    total: number;
    bagged: number;
    sealed: number;
    handedOver: number;
    dispatched: number;
  };
  photos: number;
  dispatches: {
    dispatchNumber: string;
    laboratory: string;
    sampleCount: number;
  }[];
  perDay: DayWork[];
  /** Newest first. */
  activity: ActivityLine[];
};

export type WorkPreset = "today" | "yesterday" | "last7";

const DAY_MS = 24 * 60 * 60 * 1000;

const defaultDayOf = (iso: string): string => localDateToIso(new Date(iso));

function dayFromText(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0);
}

export function daysInRange(range: DayRange): string[] {
  const days: string[] = [];
  for (
    let t = dayFromText(range.from).getTime();
    t <= dayFromText(range.to).getTime();
    t += DAY_MS
  ) {
    days.push(localDateToIso(new Date(t)));
  }
  return days;
}

/** Today, yesterday, or the last seven days (today and the six before). */
export function rangeForPreset(preset: WorkPreset, now: Date): DayRange {
  const today = localDateToIso(now);
  if (preset === "today") return { from: today, to: today };
  if (preset === "yesterday") {
    const y = localDateToIso(new Date(dayFromText(today).getTime() - DAY_MS));
    return { from: y, to: y };
  }
  const start = localDateToIso(
    new Date(dayFromText(today).getTime() - 6 * DAY_MS),
  );
  return { from: start, to: today };
}

/** A range whose start is after its end is turned round rather than refused. */
export function orderedRange(a: string, b: string): DayRange {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function summariseWork(
  input: WorkInput,
  range: DayRange,
  dayOf: (iso: string) => string = defaultDayOf,
): WorkSummary {
  const inRange = (iso: string) => {
    const day = dayOf(iso);
    return day >= range.from && day <= range.to;
  };

  const intervals = input.intervals.filter((i) => inRange(i.createdAt));
  const holeMap = new Map<string, HoleWork>();
  for (const i of intervals) {
    const hole = holeMap.get(i.holeName) ?? {
      holeName: i.holeName,
      fromM: i.fromM,
      toM: i.toM,
      metres: 0,
      intervalCount: 0,
    };
    hole.fromM = Math.min(hole.fromM, i.fromM);
    hole.toM = Math.max(hole.toM, i.toM);
    hole.metres += i.toM - i.fromM;
    hole.intervalCount += 1;
    holeMap.set(i.holeName, hole);
  }
  const holes = [...holeMap.values()]
    .map((h) => ({ ...h, metres: round1(h.metres) }))
    .sort((a, b) =>
      a.holeName.localeCompare(b.holeName, undefined, { numeric: true }),
    );

  const samples = input.samples.filter((s) => inRange(s.createdAt));
  const count = (type: SampleType) =>
    samples.filter((s) => s.type === type).length;
  const blank = count("blank");
  const standard = count("standard");
  const duplicate = count("duplicate");

  const steps = effectiveEvents(input.custody).filter((e) =>
    inRange(e.occurredAt),
  );
  const stepCount = (type: FieldCustodyEvent["type"]) =>
    steps.filter((e) => e.type === type).length;

  const boxes = input.boxes.filter((b) => inRange(b.createdAt));
  const runs = input.runs.filter((r) => inRange(r.createdAt));
  const photos = input.photos.filter((p) => inRange(p.capturedAt));
  const dispatches = input.dispatches
    .filter(
      (d) =>
        d.handoverDay !== null &&
        d.handoverDay >= range.from &&
        d.handoverDay <= range.to,
    )
    .map((d) => ({
      dispatchNumber: d.dispatchNumber,
      laboratory: d.laboratory,
      sampleCount: d.sampleCount,
    }));

  const perDay = daysInRange(range).map((day) => {
    const on = (iso: string) => dayOf(iso) === day;
    const dayIntervals = intervals.filter((i) => on(i.createdAt));
    const activity =
      dayIntervals.length +
      boxes.filter((b) => on(b.createdAt)).length +
      runs.filter((r) => on(r.createdAt)).length +
      samples.filter((s) => on(s.createdAt)).length +
      steps.filter((e) => on(e.occurredAt)).length +
      photos.filter((p) => on(p.capturedAt)).length;
    return {
      day,
      metres: round1(
        dayIntervals.reduce((sum, i) => sum + (i.toM - i.fromM), 0),
      ),
      activity,
    };
  });

  // Newest first. Steps and photos taken in the same minute read as one line.
  const activity: ActivityLine[] = [];
  for (const i of intervals) {
    activity.push({
      at: i.createdAt,
      text: `Logged ${i.holeName} ${i.fromM}–${i.toM} m`,
    });
  }
  const grouped = new Map<string, { at: string; text: string; n: number }>();
  const groupLine = (key: string, at: string, one: string, many: string) => {
    const g = grouped.get(key) ?? { at, text: "", n: 0 };
    g.n += 1;
    g.text = g.n === 1 ? one : many.replace("{n}", String(g.n));
    grouped.set(key, g);
  };
  for (const s of samples) {
    groupLine(
      `sample|${s.createdAt.slice(0, 16)}`,
      s.createdAt,
      "Created a sample",
      "Created {n} samples",
    );
  }
  const labels: Record<string, [string, string]> = {
    bagged: ["Bagged a sample", "Bagged {n} samples"],
    sealed: ["Sealed a sample", "Sealed {n} samples"],
    handed_over: ["Handed over a sample", "Handed over {n} samples"],
    dispatched: [
      "Dispatched a sample to the lab",
      "Dispatched {n} samples to the lab",
    ],
  };
  for (const e of steps) {
    const [one, many] = labels[e.type] ?? ["Custody step", "{n} custody steps"];
    groupLine(
      `${e.type}|${e.occurredAt.slice(0, 16)}`,
      e.occurredAt,
      one,
      many,
    );
  }
  for (const p of photos) {
    groupLine(
      `photo|${p.capturedAt.slice(0, 16)}`,
      p.capturedAt,
      "Took a photo",
      "Took {n} photos",
    );
  }
  for (const g of grouped.values()) activity.push({ at: g.at, text: g.text });
  activity.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  return {
    range,
    metresLogged: round1(
      intervals.reduce((sum, i) => sum + (i.toM - i.fromM), 0),
    ),
    intervalCount: intervals.length,
    holes,
    boxes: boxes.length,
    runs: runs.length,
    samples: {
      total: samples.length,
      qc: blank + standard + duplicate,
      blank,
      standard,
      duplicate,
    },
    custody: {
      total: steps.length,
      bagged: stepCount("bagged"),
      sealed: stepCount("sealed"),
      handedOver: stepCount("handed_over"),
      dispatched: stepCount("dispatched"),
    },
    photos: photos.length,
    dispatches,
    perDay,
    activity,
  };
}

/** True when there is nothing at all to show for the range. */
export function isEmptyWork(summary: WorkSummary): boolean {
  return (
    summary.intervalCount === 0 &&
    summary.boxes === 0 &&
    summary.runs === 0 &&
    summary.samples.total === 0 &&
    summary.custody.total === 0 &&
    summary.photos === 0 &&
    summary.dispatches.length === 0
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "Mon 21 Sep 2026", or "Mon 15 Sep – Sun 21 Sep 2026" for a range. */
export function formatRange(range: DayRange): string {
  const one = (day: string, withYear: boolean) => {
    const d = dayFromText(day);
    return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ""}`;
  };
  return range.from === range.to
    ? one(range.from, true)
    : `${one(range.from, false)} – ${one(range.to, true)}`;
}

/** The plain-text report that goes through the phone's share sheet (E14-2). */
export function formatWorkReport(input: {
  summary: WorkSummary;
  person: string;
  /** Overrides the default title, e.g. "Daily report". */
  title?: string;
}): string {
  const { summary, person } = input;
  const lines: string[] = [
    `CoreChain · ${input.title ?? (summary.range.from === summary.range.to ? "Daily report" : "Work report")}`,
    `${person} · ${formatRange(summary.range)}`,
    "",
  ];
  const row = (label: string, value: string) =>
    lines.push(`${label.padEnd(16)} ${value}`);

  if (summary.intervalCount > 0) {
    row(
      "CORE LOGGED",
      `${summary.metresLogged} m across ${plural(summary.holes.length, "hole", "holes")} (${plural(summary.intervalCount, "interval", "intervals")})`,
    );
    for (const h of summary.holes) {
      lines.push(`  ${h.holeName}  ${h.fromM} - ${h.toM} m  ${h.metres} m`);
    }
    lines.push("");
  }
  if (summary.samples.total > 0) {
    const qc = summary.samples.qc;
    const parts = [
      summary.samples.blank ? `${summary.samples.blank} blank` : "",
      summary.samples.standard ? `${summary.samples.standard} standard` : "",
      summary.samples.duplicate ? `${summary.samples.duplicate} duplicate` : "",
    ].filter(Boolean);
    row(
      "SAMPLES",
      `${summary.samples.total}${qc > 0 ? ` (${qc} QC: ${parts.join(", ")})` : ""}`,
    );
  }
  if (summary.custody.total > 0) {
    const c = summary.custody;
    const parts = [
      c.bagged ? `${c.bagged} bagged` : "",
      c.sealed ? `${c.sealed} sealed` : "",
      c.handedOver ? `${c.handedOver} handed over` : "",
      c.dispatched ? `${c.dispatched} dispatched` : "",
    ].filter(Boolean);
    row("CUSTODY", `${plural(c.total, "step", "steps")} (${parts.join(", ")})`);
  }
  for (const d of summary.dispatches) {
    row(
      "DISPATCH",
      `${d.dispatchNumber} handed over to ${d.laboratory}, ${plural(d.sampleCount, "sample", "samples")}`,
    );
  }
  if (summary.photos > 0) row("PHOTOS", String(summary.photos));
  if (summary.boxes > 0 || summary.runs > 0) {
    row("CORE BOXES", `${summary.boxes}  ·  RUNS ${summary.runs}`);
  }
  if (isEmptyWork(summary)) lines.push("Nothing recorded in this period.");
  lines.push("", "Sent from CoreChain Field");
  return lines.join("\n");
}
