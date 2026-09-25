import type { QaqcException } from "./qaqc";
import type { SampleType } from "./sampling";

// E12-4: checks on the laboratory's results for the control samples the
// geologist inserted in the field (standards, blanks and field duplicates),
// for the "laboratory and assays" QA/QC stage. Computed live from the results
// every time, never stored as flags, like the other QA/QC exceptions.
//
// The rules follow common industry QA/QC practice:
// - Standard (certified reference material): within 2 standard deviations of
//   the certified value passes; between 2 and 3 is a warning; beyond 3 fails.
//   Two warnings in a row for the same standard and element, on the same side
//   of the certified value, in the same laboratory batch, also fail (the
//   usual "2 of 2 beyond 2 SD" control-chart rule).
// - Blank: fails above the limit the team sets for that element (usually 5
//   or 10 times the laboratory's detection limit). Below detection passes.
// - Field duplicate: fails when it differs from its original sample by more
//   than 30% relative difference (|a - b| / mean). Pairs where either value is
//   below detection are not compared, since the difference means nothing
//   there.
// - Any sample in a batch the laboratory marked complete that has no result.
//
// Units: a result is compared with a certified value or limit only when both
// are in the same unit (case and spacing aside), and a duplicate only with an
// original in the same unit. Nothing is converted, and a missing unit is never
// assumed to match: either case is raised as `unit_mismatch`, and the result
// is not scored until the unit is put right.
//
// Blank limits: a blank that names its material uses only that material's
// limit. A blank that doesn't (the phone doesn't ask) uses the team's limit
// for the element only when there is exactly one; with several blank
// materials for one element the choice is ambiguous, so the blank is raised
// as `qc_reference_missing` rather than checked against a guess.
//
// Batch order: a laboratory runs a batch in the order of its dispatch sheet,
// which lists samples by sample number with numbers compared as numbers
// (S-2 before S-10). The "two in a row" rule uses that order, within one
// dispatch only.

export const STANDARD_WARNING_SD = 2;
export const STANDARD_FAILURE_SD = 3;
export const FIELD_DUPLICATE_MAX_DIFFERENCE_PCT = 30;

export const QC_REFERENCE_KINDS = ["standard", "blank"] as const;
export type QcReferenceKind = (typeof QC_REFERENCE_KINDS)[number];

/** One line of the team's standards-and-blanks list. */
export type QcReferenceValue = {
  kind: QcReferenceKind;
  /** The standard's name ("OREAS 45e"), or the blank material ("Blank"). */
  reference: string;
  analyte: string;
  unit: string | null;
  /** Standards: the certified value and its standard deviation. */
  expectedValue: number | null;
  standardDeviation: number | null;
  /** Blanks: the highest acceptable value. */
  maxValue: number | null;
};

export type LabQcSample = {
  id: string;
  sampleNumber: string;
  type: SampleType;
  standardRef: string | null;
  parentSampleId: string | null;
  drillholeId: string;
  holeId: string;
};

export type LabQcResult = {
  sampleId: string;
  dispatchId: string;
  analyte: string;
  value: number | null;
  unit: string | null;
  belowDetection: boolean;
  /** When it was entered: a later result for the same element replaces an earlier one. */
  enteredAt: string;
};

export type LabQcBatch = {
  dispatchId: string;
  dispatchNumber: string;
  /** Only batches the laboratory marked complete are checked for missing results. */
  resultsReturned: boolean;
  sampleIds: readonly string[];
};

export type LabQcInput = {
  samples: readonly LabQcSample[];
  results: readonly LabQcResult[];
  batches: readonly LabQcBatch[];
  references: readonly QcReferenceValue[];
};

const norm = (text: string | null | undefined) =>
  (text ?? "").trim().toLowerCase();

/** A unit as compared: case and spacing ignored; blank means no unit. */
export function normalizeUnit(unit: string | null | undefined): string | null {
  const text = (unit ?? "").replace(/\s+/g, "").toLowerCase();
  return text || null;
}

/** Whether two units are the same. A missing unit never matches anything. */
export function sameUnit(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizeUnit(a);
  return left !== null && left === normalizeUnit(b);
}

/**
 * The order a dispatch sheet lists samples in, and so the order the
 * laboratory runs them: by sample number, with numbers compared as numbers.
 */
export function compareSampleNumbers(a: string, b: string): number {
  return (
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }) ||
    (a < b ? -1 : a > b ? 1 : 0)
  );
}

/** The error, if any, in one line of the standards-and-blanks list. */
export function validateQcReferenceValue(
  value: QcReferenceValue,
): string | null {
  if (!QC_REFERENCE_KINDS.includes(value.kind)) return "Choose standard or blank.";
  if (!value.reference.trim()) {
    return value.kind === "standard"
      ? "Enter the standard's name, as on its certificate."
      : "Enter the blank material's name.";
  }
  if (value.reference.trim().length > 60) return "The name is too long (60 characters at most).";
  if (!value.analyte.trim()) return "Enter the element, for example Cu.";
  if (value.analyte.trim().length > 20) return "The element is too long (20 characters at most).";
  if (!(value.unit ?? "").trim()) {
    return "Enter the unit the laboratory reports in, for example ppm.";
  }
  if ((value.unit ?? "").trim().length > 20) return "The unit is too long (20 characters at most).";
  const finite = (n: number | null) => n != null && Number.isFinite(n);
  if (value.kind === "standard") {
    if (!finite(value.expectedValue) || (value.expectedValue as number) < 0) {
      return "Enter the certified value.";
    }
    if (!finite(value.standardDeviation) || (value.standardDeviation as number) <= 0) {
      return "Enter the certified standard deviation (more than 0).";
    }
  } else if (!finite(value.maxValue) || (value.maxValue as number) < 0) {
    return "Enter the blank's limit.";
  }
  return null;
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toString()
    : Number(value.toPrecision(4)).toString();
}

function withUnit(value: number, unit: string | null | undefined): string {
  return unit ? `${formatNumber(value)} ${unit}` : formatNumber(value);
}

const unitLabel = (unit: string | null | undefined) =>
  unit?.trim() ? unit.trim() : "no unit";

/** The latest result per sample and element; an earlier entry is replaced. */
function latestResults(results: readonly LabQcResult[]) {
  const latest = new Map<string, LabQcResult>();
  for (const result of results) {
    const key = `${result.sampleId}|${norm(result.analyte)}`;
    const current = latest.get(key);
    if (!current || result.enteredAt >= current.enteredAt) latest.set(key, result);
  }
  const bySample = new Map<string, LabQcResult[]>();
  for (const result of latest.values()) {
    const list = bySample.get(result.sampleId) ?? [];
    list.push(result);
    bySample.set(result.sampleId, list);
  }
  for (const list of bySample.values()) {
    list.sort((a, b) => a.analyte.localeCompare(b.analyte));
  }
  return bySample;
}

type StandardReading = {
  sample: LabQcSample;
  result: LabQcResult;
  reference: QcReferenceValue;
  deviations: number;
};

type BlankMatch =
  | { reference: QcReferenceValue }
  | { missing: "none" | "ambiguous"; candidates: readonly QcReferenceValue[] };

/** E12-4: failed and doubtful controls, and missing results. */
export function laboratoryAssayExceptions(input: LabQcInput): QaqcException[] {
  const exceptions: QaqcException[] = [];
  const sampleById = new Map(input.samples.map((s) => [s.id, s]));
  const resultsBySample = latestResults(input.results);

  const standards = input.references.filter((r) => r.kind === "standard");
  const blanks = input.references.filter((r) => r.kind === "blank");
  const findStandard = (name: string, analyte: string) =>
    standards.find(
      (r) => norm(r.reference) === norm(name) && norm(r.analyte) === norm(analyte),
    );
  const findBlank = (material: string | null, analyte: string): BlankMatch => {
    const forAnalyte = blanks.filter((r) => norm(r.analyte) === norm(analyte));
    if (material?.trim()) {
      const named = forAnalyte.find((r) => norm(r.reference) === norm(material));
      return named ? { reference: named } : { missing: "none", candidates: [] };
    }
    if (forAnalyte.length === 1) return { reference: forAnalyte[0]! };
    return forAnalyte.length === 0
      ? { missing: "none", candidates: [] }
      : { missing: "ambiguous", candidates: forAnalyte };
  };

  const push = (sample: LabQcSample, exception: Omit<QaqcException, "drillholeId" | "holeId">) =>
    exceptions.push({ ...exception, drillholeId: sample.drillholeId, holeId: sample.holeId });

  const unitMismatch = (
    sample: LabQcSample,
    result: LabQcResult,
    against: { label: string; unit: string | null; value: number | null },
  ) =>
    push(sample, {
      key: `unit_mismatch:${sample.id}:${norm(result.analyte)}:${normalizeUnit(result.unit) ?? "none"}:${normalizeUnit(against.unit) ?? "none"}`,
      kind: "unit_mismatch",
      summary: `Units don't match for ${result.analyte}: ${sample.sampleNumber}`,
      evidence: `${sample.sampleNumber}: ${result.analyte} reported as ${
        result.value == null ? "below detection" : formatNumber(result.value)
      } (${unitLabel(result.unit)}); ${against.label}${
        against.value == null ? "" : ` ${formatNumber(against.value)}`
      } (${unitLabel(against.unit)}). Not checked until both are in the same unit: correct the result's unit, or the line under Standards and blanks.`,
    });

  // Standards: collect every reading first, so the "two in a row" rule can
  // look at the batch's readings in dispatch-sheet order.
  const readings: StandardReading[] = [];
  for (const sample of input.samples) {
    if (sample.type !== "standard") continue;
    const results = resultsBySample.get(sample.id) ?? [];
    const name = sample.standardRef?.trim() || null;
    const missing: string[] = [];
    for (const result of results) {
      const reference = name ? findStandard(name, result.analyte) : undefined;
      if (!reference) {
        missing.push(result.analyte);
        continue;
      }
      const expected = reference.expectedValue as number;
      const sd = reference.standardDeviation as number;
      if (result.belowDetection || result.value == null) {
        push(sample, {
          key: `standard_failed:${sample.id}:${norm(result.analyte)}:bdl`,
          kind: "standard_failed",
          summary: `Standard ${name} failed for ${result.analyte}: ${sample.sampleNumber}`,
          evidence: `Reported below detection; certified ${withUnit(expected, reference.unit)}. A standard must always be detected.`,
        });
        continue;
      }
      if (!sameUnit(result.unit, reference.unit)) {
        unitMismatch(sample, result, {
          label: `certified value for ${reference.reference}`,
          unit: reference.unit,
          value: expected,
        });
        continue;
      }
      readings.push({
        sample,
        result,
        reference,
        deviations: (result.value - expected) / sd,
      });
    }
    if (results.length > 0 && missing.length > 0) {
      push(sample, {
        key: `qc_reference_missing:${sample.id}:${missing.map(norm).join(",")}`,
        kind: "qc_reference_missing",
        summary: name
          ? `No certified values for standard ${name} (${missing.join(", ")})`
          : `Standard ${sample.sampleNumber} has no name`,
        evidence: name
          ? `${sample.sampleNumber} can't be checked. Add ${name}'s certified value and standard deviation for ${missing.join(", ")} under Standards and blanks.`
          : `${sample.sampleNumber} was recorded as a standard without saying which one, so it can't be checked.`,
      });
    }
  }

  const groups = new Map<string, StandardReading[]>();
  for (const reading of readings) {
    const key = [
      reading.result.dispatchId,
      norm(reading.reference.reference),
      norm(reading.reference.analyte),
    ].join("|");
    const list = groups.get(key) ?? [];
    list.push(reading);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => compareSampleNumbers(a.sample.sampleNumber, b.sample.sampleNumber));
    list.forEach((reading, index) => {
      const { sample, result, reference, deviations } = reading;
      const expected = reference.expectedValue as number;
      const sd = reference.standardDeviation as number;
      const unit = reference.unit;
      const value = result.value as number;
      const size = Math.abs(deviations);
      const band = (n: number) =>
        `${withUnit(expected - n * sd, null)} to ${withUnit(expected + n * sd, unit)}`;
      const reported = `${sample.sampleNumber}: ${result.analyte} ${withUnit(value, unit)}, certified ${withUnit(expected, unit)} ± ${formatNumber(sd)} (${deviations >= 0 ? "+" : ""}${deviations.toFixed(1)} SD).`;
      const previous = list[index - 1];
      const twoInARow =
        size > STANDARD_WARNING_SD &&
        size <= STANDARD_FAILURE_SD &&
        previous != null &&
        Math.abs(previous.deviations) > STANDARD_WARNING_SD &&
        Math.sign(previous.deviations) === Math.sign(deviations);

      if (size > STANDARD_FAILURE_SD || twoInARow) {
        push(sample, {
          key: `standard_failed:${sample.id}:${norm(result.analyte)}:${value}`,
          kind: "standard_failed",
          summary: `Standard ${reference.reference} failed for ${result.analyte}: ${sample.sampleNumber}`,
          evidence: twoInARow
            ? `${reported} The second reading in a row beyond 2 SD on the same side, after ${previous.sample.sampleNumber}. The batch is biased ${deviations > 0 ? "high" : "low"}.`
            : `${reported} Outside the 3 SD limit of ${band(STANDARD_FAILURE_SD)}.`,
        });
      } else if (size > STANDARD_WARNING_SD) {
        push(sample, {
          key: `standard_warning:${sample.id}:${norm(result.analyte)}:${value}`,
          kind: "standard_warning",
          summary: `Standard ${reference.reference} near its limit for ${result.analyte}: ${sample.sampleNumber}`,
          evidence: `${reported} Between 2 and 3 SD (${band(STANDARD_WARNING_SD)} passes). Watch the next standard in this batch.`,
        });
      }
    });
  }

  // Blanks.
  for (const sample of input.samples) {
    if (sample.type !== "blank") continue;
    const material = sample.standardRef?.trim() || null;
    const missing: string[] = [];
    const ambiguous: { analyte: string; materials: string[] }[] = [];
    for (const result of resultsBySample.get(sample.id) ?? []) {
      const match = findBlank(material, result.analyte);
      if ("missing" in match) {
        if (match.missing === "ambiguous") {
          ambiguous.push({
            analyte: result.analyte,
            materials: match.candidates.map((r) => r.reference),
          });
        } else {
          missing.push(result.analyte);
        }
        continue;
      }
      const reference = match.reference;
      if (result.belowDetection || result.value == null) continue;
      const limit = reference.maxValue as number;
      if (!sameUnit(result.unit, reference.unit)) {
        unitMismatch(sample, result, {
          label: `limit for ${reference.reference}`,
          unit: reference.unit,
          value: limit,
        });
        continue;
      }
      if (result.value > limit) {
        push(sample, {
          key: `blank_failed:${sample.id}:${norm(result.analyte)}:${result.value}`,
          kind: "blank_failed",
          summary: `Blank failed for ${result.analyte}: ${sample.sampleNumber}`,
          evidence: `${sample.sampleNumber}: ${result.analyte} ${withUnit(result.value, reference.unit)}, limit ${withUnit(limit, reference.unit)} (${reference.reference}). Possible contamination during preparation; check the samples prepared just before it.`,
        });
      }
    }
    if (missing.length > 0) {
      push(sample, {
        key: `qc_reference_missing:${sample.id}:${missing.map(norm).join(",")}`,
        kind: "qc_reference_missing",
        summary: material
          ? `No ${material} limit for ${missing.join(", ")}`
          : `No blank limit for ${missing.join(", ")}`,
        evidence: material
          ? `${sample.sampleNumber} is a ${material} blank, and there is no ${material} limit for ${missing.join(", ")} under Standards and blanks. Another material's limit is never used in its place.`
          : `${sample.sampleNumber} can't be checked. Add a blank limit for ${missing.join(", ")} under Standards and blanks.`,
      });
    }
    if (ambiguous.length > 0) {
      const analytes = ambiguous.map((a) => a.analyte);
      push(sample, {
        key: `qc_reference_missing:${sample.id}:ambiguous:${analytes.map(norm).join(",")}`,
        kind: "qc_reference_missing",
        summary: `Which blank limit applies to ${sample.sampleNumber}?`,
        evidence: `${sample.sampleNumber} doesn't say which blank material it is, and ${ambiguous
          .map((a) => `${a.analyte} has limits for ${a.materials.join(" and ")}`)
          .join("; ")}. Not checked, rather than checked against the wrong limit.`,
      });
    }
  }

  // Field duplicates against their original sample.
  for (const sample of input.samples) {
    if (sample.type !== "duplicate" || !sample.parentSampleId) continue;
    const original = sampleById.get(sample.parentSampleId);
    if (!original) continue;
    const originalResults = new Map(
      (resultsBySample.get(original.id) ?? []).map((r) => [norm(r.analyte), r]),
    );
    for (const result of resultsBySample.get(sample.id) ?? []) {
      const pair = originalResults.get(norm(result.analyte));
      if (!pair) continue;
      if (result.belowDetection || pair.belowDetection) continue;
      if (result.value == null || pair.value == null) continue;
      if (!sameUnit(result.unit, pair.unit)) {
        unitMismatch(sample, result, {
          label: `original ${original.sampleNumber}`,
          unit: pair.unit,
          value: pair.value,
        });
        continue;
      }
      const mean = (result.value + pair.value) / 2;
      if (mean <= 0) continue;
      const difference = (Math.abs(result.value - pair.value) / mean) * 100;
      if (difference > FIELD_DUPLICATE_MAX_DIFFERENCE_PCT) {
        const unit = result.unit;
        push(sample, {
          key: `duplicate_failed:${sample.id}:${norm(result.analyte)}:${pair.value}:${result.value}`,
          kind: "duplicate_failed",
          summary: `Duplicate failed for ${result.analyte}: ${sample.sampleNumber} against ${original.sampleNumber}`,
          evidence: `${original.sampleNumber} ${withUnit(pair.value, unit)}, duplicate ${sample.sampleNumber} ${withUnit(result.value, unit)}: ${Math.round(difference)}% apart, limit ${FIELD_DUPLICATE_MAX_DIFFERENCE_PCT}% for field duplicates. Check the splitting, or a nugget effect in this interval.`,
        });
      }
    }
  }

  // Samples with no result in a batch the laboratory marked complete.
  for (const batch of input.batches) {
    if (!batch.resultsReturned) continue;
    for (const sampleId of batch.sampleIds) {
      const sample = sampleById.get(sampleId);
      if (!sample) continue;
      const any = (resultsBySample.get(sampleId) ?? []).some(
        (r) => r.dispatchId === batch.dispatchId,
      );
      if (!any) {
        push(sample, {
          key: `result_missing:${batch.dispatchId}:${sampleId}`,
          kind: "result_missing",
          summary: `No result for ${sample.sampleNumber} in ${batch.dispatchNumber}`,
          evidence: `The laboratory marked ${batch.dispatchNumber} complete, but ${sample.sampleNumber} (${sample.type}) has no result.`,
        });
      }
    }
  }

  return exceptions;
}
