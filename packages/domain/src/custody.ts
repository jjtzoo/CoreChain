// Chain of custody and lab dispatch
// (docs/product/corechain-mobile-mvp-scrum-plan.md, Sprint 5: E7-1..E7-3).
//
// Custody events are only ever added: a mistake is corrected with a new
// "correction" event that voids the earlier one, never by editing it. A
// sample's status (created, bagged, dispatched) is worked out from the events
// that still count, so it can always be checked against the record.

import { csvEscape } from "./export";
import type { SyncableRecord } from "./field";
import type { FieldSample, SampleStatus, SampleType } from "./sampling";

export const CUSTODY_EVENT_TYPES = [
  "bagged",
  "sealed",
  "handed_over",
  "dispatched",
  // E13-2: recorded once per sample by a laboratory account on the web when
  // it confirms a dispatch arrived. A geologist's phone only ever displays
  // this (it syncs down like any other custody event); it is never written
  // on the device, so it is not in RECORDABLE_EVENT_TYPES below.
  "received",
  "correction",
] as const;
export type CustodyEventType = (typeof CUSTODY_EVENT_TYPES)[number];

/**
 * What a geologist records by hand. "dispatched" is written for them when a
 * dispatch is handed over, "received" by the laboratory's own web screen,
 * and "correction" by the correct-a-mistake flow.
 */
export const RECORDABLE_EVENT_TYPES = [
  "bagged",
  "sealed",
  "handed_over",
] as const;
export type RecordableEventType = (typeof RECORDABLE_EVENT_TYPES)[number];

export const CUSTODY_LABELS: Record<CustodyEventType, string> = {
  bagged: "Bagged",
  sealed: "Sealed",
  handed_over: "Handed over",
  dispatched: "Dispatched to lab",
  received: "Received by laboratory",
  correction: "Correction",
};

/** One line of a sample's custody record. Append-only: it has no version. */
export type FieldCustodyEvent = {
  id: string;
  projectId: string;
  sampleId: string;
  type: CustodyEventType;
  /** When it happened, which may be earlier than when it was typed in. */
  occurredAt: string;
  /** Who did it. */
  handledBy: string;
  location: string | null;
  /** Who it was handed to. */
  recipient: string | null;
  note: string | null;
  /** The dispatch this event belongs to, for "dispatched". */
  dispatchId: string | null;
  /** For a correction: the event it voids. */
  correctsEventId: string | null;
  createdAt: string;
  /**
   * The signed-in account that logged this event, stamped by the server and
   * never chosen by the phone. Optional: blank on a fixture, and on a record
   * this phone just created until the next sync fills it in. Distinct from
   * `handledBy`, which is the free-text name of whoever physically had the
   * sample and may not be the person typing it into the app.
   */
  createdBy?: string | null;
};

export type CustodyEventInput = {
  type: RecordableEventType;
  occurredAt: string;
  handledBy: string;
  location?: string | null;
  recipient?: string | null;
  note?: string | null;
};

export type CustodyError = { field: string; message: string };

// A phone's clock can be a few minutes off; more than this in the future is a typo.
const FUTURE_TOLERANCE_MS = 5 * 60_000;

export function validateCustodyEvent(
  input: CustodyEventInput,
  now: Date,
): CustodyError[] {
  const errors: CustodyError[] = [];
  if (!(RECORDABLE_EVENT_TYPES as readonly string[]).includes(input.type)) {
    errors.push({
      field: "type",
      message: "Choose the custody step.",
    });
  }
  if (!input.handledBy.trim()) {
    errors.push({ field: "handledBy", message: "Enter who handled the sample." });
  }
  const time = Date.parse(input.occurredAt);
  if (Number.isNaN(time)) {
    errors.push({
      field: "occurredAt",
      message: "Enter a valid date and time.",
    });
  } else if (time > now.getTime() + FUTURE_TOLERANCE_MS) {
    errors.push({
      field: "occurredAt",
      message: "The time cannot be in the future.",
    });
  }
  if (input.type === "handed_over" && !(input.recipient ?? "").trim()) {
    errors.push({ field: "recipient", message: "Enter who received the samples." });
  }
  return errors;
}

export function validateCorrection(input: {
  note: string;
  handledBy: string;
}): CustodyError[] {
  const errors: CustodyError[] = [];
  if (!input.note.trim()) {
    errors.push({ field: "note", message: "Explain what was wrong." });
  }
  if (!input.handledBy.trim()) {
    errors.push({ field: "handledBy", message: "Enter who is making the correction." });
  }
  return errors;
}

export type CustodyLine = FieldCustodyEvent & {
  /** A later correction cancelled this event. */
  voided: boolean;
};

/**
 * A sample's events in the order they happened, with the ones a later
 * correction cancelled marked as voided. Nothing is hidden: the mistake and its
 * correction both stay on the record.
 */
export function custodyTimeline(
  events: readonly FieldCustodyEvent[],
): CustodyLine[] {
  const voidedIds = new Set(
    events
      .filter((event) => event.type === "correction" && event.correctsEventId)
      .map((event) => event.correctsEventId as string),
  );
  return [...events]
    .sort(
      (a, b) =>
        a.occurredAt.localeCompare(b.occurredAt) ||
        a.createdAt.localeCompare(b.createdAt),
    )
    .map((event) => ({ ...event, voided: voidedIds.has(event.id) }));
}

/** The events that still count: not voided, and not themselves corrections. */
export function effectiveEvents(
  events: readonly FieldCustodyEvent[],
): FieldCustodyEvent[] {
  return custodyTimeline(events).filter(
    (line) => !line.voided && line.type !== "correction",
  );
}

/** A sample's status, worked out from the events that count. */
export function statusFromEvents(
  events: readonly FieldCustodyEvent[],
): SampleStatus {
  const counting = effectiveEvents(events);
  if (counting.some((event) => event.type === "dispatched"))
    return "dispatched";
  if (counting.length > 0) return "bagged";
  return "created";
}

export type Eligibility = { ok: true } | { ok: false; reason: string };

/**
 * Whether a sample can take this event now. Keeps the record in order (seal a
 * bagged sample, hand over a bagged one) and stops anything being recorded on
 * a sample that has already gone to the laboratory.
 */
export function canRecordEvent(
  type: RecordableEventType,
  events: readonly FieldCustodyEvent[],
): Eligibility {
  const counting = effectiveEvents(events);
  const has = (t: CustodyEventType) => counting.some((e) => e.type === t);
  if (has("dispatched")) {
    return { ok: false, reason: "Already dispatched to the lab" };
  }
  if (type === "bagged") {
    return has("bagged")
      ? { ok: false, reason: "Already bagged" }
      : { ok: true };
  }
  if (!has("bagged")) {
    return { ok: false, reason: "Not bagged yet" };
  }
  if (type === "sealed" && has("sealed")) {
    return { ok: false, reason: "Already sealed" };
  }
  return { ok: true };
}

/**
 * Whether an event can be corrected. Only the latest step that still counts,
 * so a correction never leaves a later step (a seal) with nothing under it
 * (the bagging); correct the later steps first. A dispatch's own event is
 * corrected from the dispatch, not from here.
 */
export function canCorrectEvent(
  events: readonly FieldCustodyEvent[],
  eventId: string,
): Eligibility {
  const counting = effectiveEvents(events);
  const target = counting.find((event) => event.id === eventId);
  if (!target) {
    return { ok: false, reason: "This has already been corrected." };
  }
  if (target.type === "dispatched") {
    return {
      ok: false,
      reason: "This came from a dispatch. Correct it from the dispatch.",
    };
  }
  if (counting[counting.length - 1]?.id !== eventId) {
    return {
      ok: false,
      reason:
        "Only the latest step can be corrected. Correct the later ones first.",
    };
  }
  return { ok: true };
}

/** Splits selected samples into those that can take the event and those that cannot, with why. */
export function splitByEligibility<T extends { id: string }>(
  type: RecordableEventType,
  samples: readonly T[],
  eventsBySample: ReadonlyMap<string, readonly FieldCustodyEvent[]>,
): { eligible: T[]; skipped: { sample: T; reason: string }[] } {
  const eligible: T[] = [];
  const skipped: { sample: T; reason: string }[] = [];
  for (const sample of samples) {
    const result = canRecordEvent(type, eventsBySample.get(sample.id) ?? []);
    if (result.ok) eligible.push(sample);
    else skipped.push({ sample, reason: result.reason });
  }
  return { eligible, skipped };
}

// ---- Dispatch --------------------------------------------------------------

export const DISPATCH_STATUSES = ["open", "dispatched"] as const;
export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];

/** A batch of samples going to one laboratory. */
export type FieldDispatch = SyncableRecord & {
  projectId: string;
  dispatchNumber: string;
  laboratory: string;
  preparationRequest: string | null;
  /** The day the samples were handed over; null while the dispatch is open. */
  handoverAt: string | null;
  status: DispatchStatus;
  note: string | null;
};

/** One sample in one dispatch. */
export type FieldDispatchSample = SyncableRecord & {
  projectId: string;
  dispatchId: string;
  sampleId: string;
};

/** DSP-001, DSP-002 ...: one more than the highest number already used. */
export function nextDispatchNumber(existing: readonly string[]): string {
  let highest = 0;
  for (const number of existing) {
    const match = /(\d+)\s*$/.exec(number);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `DSP-${String(highest + 1).padStart(3, "0")}`;
}

export function validateDispatch(input: {
  laboratory: string;
  sampleCount: number;
}): CustodyError[] {
  const errors: CustodyError[] = [];
  if (!input.laboratory.trim()) {
    errors.push({
      field: "laboratory",
      message: "Enter the laboratory.",
    });
  }
  if (input.sampleCount < 1) {
    errors.push({ field: "samples", message: "Add at least one sample." });
  }
  return errors;
}

/**
 * Whether a sample can be added to an open dispatch: it must be bagged (so its
 * custody starts somewhere), not removed, and in no other open dispatch.
 */
export function canJoinDispatch(
  sample: Pick<FieldSample, "status" | "deletedAt">,
  inOtherOpenDispatch: boolean,
): Eligibility {
  if (sample.deletedAt) return { ok: false, reason: "Removed" };
  if (sample.status === "dispatched") {
    return { ok: false, reason: "Already dispatched" };
  }
  if (sample.status === "created")
    return { ok: false, reason: "Not bagged yet" };
  if (inOtherOpenDispatch) {
    return { ok: false, reason: "In another open dispatch" };
  }
  return { ok: true };
}

export type DispatchSheetSample = {
  sampleNumber: string;
  type: SampleType;
  holeId: string;
  fromM: number | null;
  toM: number | null;
  standardRef: string | null;
  /** The sample number a field duplicate was taken alongside. */
  parentSampleNumber: string | null;
};

export type DispatchSheetInput = {
  projectName: string;
  dispatch: Pick<
    FieldDispatch,
    | "dispatchNumber"
    | "laboratory"
    | "preparationRequest"
    | "handoverAt"
    | "note"
  >;
  handedOverBy: string | null;
  samples: readonly DispatchSheetSample[];
};

export type DispatchSheet = {
  filename: string;
  csv: string;
  total: number;
  byType: Record<SampleType, number>;
};

const TYPE_LABELS: Record<SampleType, string> = {
  primary: "Primary",
  standard: "Standard",
  blank: "Blank",
  duplicate: "Duplicate",
};

function qcNote(sample: DispatchSheetSample): string {
  if (sample.type === "standard") {
    return sample.standardRef
      ? `Reference material ${sample.standardRef}`
      : "Standard";
  }
  if (sample.type === "blank") return "Blank";
  if (sample.type === "duplicate") {
    return sample.parentSampleNumber
      ? `Duplicate of ${sample.parentSampleNumber}`
      : "Duplicate";
  }
  return "";
}

/**
 * The sheet that goes with the samples: who it is for and what it holds, a
 * count by type, and one line per sample. A CSV, so a laboratory can open it in
 * any spreadsheet and the office gets the same list.
 */
export function dispatchSheet(input: DispatchSheetInput): DispatchSheet {
  const { dispatch } = input;
  const samples = [...input.samples].sort((a, b) =>
    a.sampleNumber.localeCompare(b.sampleNumber, undefined, { numeric: true }),
  );
  const byType: Record<SampleType, number> = {
    primary: 0,
    standard: 0,
    blank: 0,
    duplicate: 0,
  };
  for (const sample of samples) byType[sample.type] += 1;

  const line = (...cells: (string | number | null)[]) =>
    cells.map(csvEscape).join(",");
  const lines = [
    line("Dispatch", dispatch.dispatchNumber),
    line("Project", input.projectName),
    line("Laboratory", dispatch.laboratory),
    line("Preparation request", dispatch.preparationRequest),
    line("Handover date", dispatch.handoverAt),
    line("Handed over by", input.handedOverBy),
    line("Note", dispatch.note),
    line("Samples", samples.length),
    line("Primary", byType.primary),
    line("Standard", byType.standard),
    line("Blank", byType.blank),
    line("Duplicate", byType.duplicate),
    "",
    line("SAMPLE_ID", "TYPE", "HOLEID", "FROM", "TO", "QC"),
    ...samples.map((sample) =>
      line(
        sample.sampleNumber,
        TYPE_LABELS[sample.type],
        sample.holeId,
        sample.fromM,
        sample.toM,
        qcNote(sample),
      ),
    ),
  ];

  return {
    filename: sheetFilename(dispatch.dispatchNumber, "csv"),
    csv: lines.join("\r\n").concat("\r\n"),
    total: samples.length,
    byType,
  };
}

function sheetFilename(dispatchNumber: string, extension: string): string {
  const safeNumber = dispatchNumber
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${safeNumber || "dispatch"}-sheet.${extension}`;
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type DispatchSheetPdf = {
  filename: string;
  /** A complete printable page: the phone turns it into a PDF. */
  html: string;
};

/**
 * The same sheet as a page to print or send: who it is for, a count by type,
 * one row per sample, and blank lines for the courier and the laboratory to
 * sign, so it can travel with the samples as the paper end of the record.
 */
export function dispatchSheetPdf(input: DispatchSheetInput): DispatchSheetPdf {
  const { dispatch } = input;
  const samples = [...input.samples].sort((a, b) =>
    a.sampleNumber.localeCompare(b.sampleNumber, undefined, { numeric: true }),
  );
  const count = (type: SampleType) =>
    samples.filter((sample) => sample.type === type).length;

  const detail = (label: string, value: string | null) =>
    value
      ? `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
      : "";
  const range = (sample: DispatchSheetSample) =>
    sample.fromM != null && sample.toM != null
      ? `${sample.fromM}–${sample.toM}`
      : "";
  const rows = samples
    .map(
      (sample, index) =>
        `<tr><td class="n">${index + 1}</td>` +
        `<td class="id">${escapeHtml(sample.sampleNumber)}</td>` +
        `<td>${escapeHtml(TYPE_LABELS[sample.type])}</td>` +
        `<td>${escapeHtml(sample.holeId)}</td>` +
        `<td>${escapeHtml(range(sample))}</td>` +
        `<td>${escapeHtml(qcNote(sample))}</td>` +
        `<td class="box"></td></tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(dispatch.dispatchNumber)}</title>
<style>
@page { size: A4; margin: 16mm; }
body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 11pt; }
h1 { font-size: 20pt; margin: 0 0 2pt; }
.sub { color: #555; margin: 0 0 14pt; }
table { border-collapse: collapse; width: 100%; }
.facts th { text-align: left; width: 38%; padding: 3pt 0; color: #555; font-weight: normal; vertical-align: top; }
.facts td { padding: 3pt 0; font-weight: bold; }
.counts { margin: 14pt 0 10pt; }
.list th, .list td { border: 1px solid #999; padding: 4pt 6pt; text-align: left; }
.list th { background: #eee; font-size: 9pt; }
.list tr { page-break-inside: avoid; }
.n { width: 22pt; color: #555; }
.id { font-weight: bold; white-space: nowrap; }
.box { width: 34pt; }
.sign { margin-top: 26pt; display: flex; gap: 24pt; page-break-inside: avoid; }
.sign div { flex: 1; border-top: 1px solid #111; padding-top: 4pt; font-size: 9pt; color: #555; }
</style></head><body>
<h1>${escapeHtml(dispatch.dispatchNumber)}</h1>
<p class="sub">Sample dispatch sheet · ${escapeHtml(input.projectName)}</p>
<table class="facts">
${detail("Laboratory", dispatch.laboratory)}
${detail("Preparation request", dispatch.preparationRequest)}
${detail("Handover date", dispatch.handoverAt)}
${detail("Handed over by", input.handedOverBy)}
${detail("Note", dispatch.note)}
</table>
<p class="counts"><b>${samples.length} samples:</b> ${count("primary")} primary · ${count("standard")} standard · ${count("blank")} blank · ${count("duplicate")} duplicate</p>
<table class="list">
<tr><th>#</th><th>Sample ID</th><th>Type</th><th>Hole</th><th>From–to (m)</th><th>QC</th><th>Rec'd</th></tr>
${rows}
</table>
<div class="sign"><div>Handed over by (name, signature)</div><div>Received by (name, signature)</div><div>Date and time received</div></div>
</body></html>`;

  return { filename: sheetFilename(dispatch.dispatchNumber, "pdf"), html };
}
