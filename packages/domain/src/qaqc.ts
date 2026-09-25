// QA/QC exceptions queue (docs/product/corechain-mobile-mvp-scrum-plan.md,
// E12-1, E12-2). QA/QC starts in the field and runs through sampling,
// custody, the laboratory and assays, so a reviewer's account is scoped to
// one stage of that chain (decision D15) rather than seeing everything.
//
// Exceptions are computed from the same evidence a geologist already
// entered — gaps and overlaps reuse `analyseContinuity` (core.ts), QC rates
// reuse `qcAchievement` (sampling.ts) — rather than duplicating that logic or
// storing a separate copy of the state. Nothing here is stored: the caller
// re-derives the queue from current data each time, and a resolution is
// recorded separately, keyed by `key`, so a resolved exception can be told
// apart from one that no longer applies.

import {
  analyseContinuity,
  recoveryPercent,
  runPastFinalDepthWarning,
  type DepthRange,
} from "./core";
import { qcAchievement, type QcRates, type SampleStatus, type SampleType } from "./sampling";

export const QAQC_STAGES = [
  "core_logging",
  "sampling_custody",
  "laboratory_assays",
] as const;
export type QaqcStage = (typeof QAQC_STAGES)[number];

export const QAQC_STAGE_LABELS: Record<QaqcStage, string> = {
  core_logging: "Core and logging",
  sampling_custody: "Sampling and custody",
  laboratory_assays: "Laboratory and assays",
};

export type QaqcExceptionKind =
  | "run_gap"
  | "run_overlap"
  | "recovery_over_100"
  | "run_past_final_depth"
  | "qc_rate_short"
  | "custody_stalled"
  | "sample_overlap"
  | "device_stale"
  // E12-4, laboratory and assays (labQc.ts)
  | "standard_failed"
  | "standard_warning"
  | "blank_failed"
  | "duplicate_failed"
  | "qc_reference_missing"
  | "unit_mismatch"
  | "result_missing";

/**
 * One row in the exceptions queue. `key` identifies the same underlying
 * condition across reloads, so a resolution recorded against it still
 * applies next time the queue is computed, as long as the condition is
 * unchanged.
 */
export type QaqcException = {
  key: string;
  drillholeId: string;
  holeId: string;
  kind: QaqcExceptionKind;
  summary: string;
  evidence: string;
};

/** E12-5: a short, stage-neutral label for an exception kind, used when the
 * full computed detail (summary, evidence) is no longer available — e.g. a
 * resolved exception whose underlying condition has since changed, so it no
 * longer recomputes. Never hides the resolution itself, only its detail. */
export const QAQC_EXCEPTION_KIND_LABELS: Record<QaqcExceptionKind, string> = {
  run_gap: "Gap between runs",
  run_overlap: "Runs overlap",
  recovery_over_100: "Recovery over 100%",
  run_past_final_depth: "Run past the final depth",
  qc_rate_short: "QC rate below target",
  custody_stalled: "Sample stalled before dispatch",
  sample_overlap: "Primary samples overlap",
  device_stale: "Device quiet for a while",
  standard_failed: "Standard failed",
  standard_warning: "Standard near its limit",
  blank_failed: "Blank failed",
  duplicate_failed: "Duplicate failed",
  qc_reference_missing: "No certified values or limit",
  unit_mismatch: "Units don't match",
  result_missing: "Result missing",
};

/** The exception kind encoded at the start of a `QaqcException.key`, or null
 * if the key doesn't start with one of the known kinds. */
export function exceptionKindFromKey(key: string): QaqcExceptionKind | null {
  const colon = key.indexOf(":");
  if (colon < 0) return null;
  const prefix = key.slice(0, colon);
  return (QAQC_EXCEPTION_KIND_LABELS as Record<string, string>)[prefix]
    ? (prefix as QaqcExceptionKind)
    : null;
}

function formatRange(range: DepthRange): string {
  return `${range.fromM}–${range.toM} m`;
}

export type HoleRunsInput = {
  drillholeId: string;
  holeId: string;
  runs: readonly { fromM: number; toM: number; recoveredM: number }[];
  /** The hole's recorded final depth, once drilling has finished. */
  actualFinalDepthM?: number | null;
};

/**
 * E12-2: run gaps, overlaps, recovery over 100% and runs past the hole's
 * final depth, for the core-and-logging stage.
 */
export function coreLoggingExceptions(
  holes: readonly HoleRunsInput[],
): QaqcException[] {
  const exceptions: QaqcException[] = [];
  for (const hole of holes) {
    const { gaps, overlaps } = analyseContinuity(hole.runs);
    for (const gap of gaps) {
      exceptions.push({
        key: `run_gap:${hole.drillholeId}:${gap.fromM}-${gap.toM}`,
        drillholeId: hole.drillholeId,
        holeId: hole.holeId,
        kind: "run_gap",
        summary: `Gap between runs at ${formatRange(gap)}`,
        evidence: `No run covers ${formatRange(gap)}.`,
      });
    }
    for (const overlap of overlaps) {
      exceptions.push({
        key: `run_overlap:${hole.drillholeId}:${overlap.fromM}-${overlap.toM}`,
        drillholeId: hole.drillholeId,
        holeId: hole.holeId,
        kind: "run_overlap",
        summary: `Runs overlap at ${formatRange(overlap)}`,
        evidence: `More than one run covers ${formatRange(overlap)}.`,
      });
    }
    for (const run of hole.runs) {
      const drilledM = run.toM - run.fromM;
      const pct = recoveryPercent(drilledM, run.recoveredM);
      if (pct != null && pct > 100) {
        exceptions.push({
          key: `recovery_over_100:${hole.drillholeId}:${run.fromM}-${run.toM}`,
          drillholeId: hole.drillholeId,
          holeId: hole.holeId,
          kind: "recovery_over_100",
          summary: `Recovery ${pct}% at ${formatRange(run)}`,
          evidence: `${run.recoveredM} m recovered from a ${drilledM.toFixed(2)} m run.`,
        });
      }
      const finalDepth = hole.actualFinalDepthM ?? null;
      if (runPastFinalDepthWarning(run, finalDepth)) {
        exceptions.push({
          key: `run_past_final_depth:${hole.drillholeId}:${run.fromM}-${run.toM}:${finalDepth}`,
          drillholeId: hole.drillholeId,
          holeId: hole.holeId,
          kind: "run_past_final_depth",
          summary: `Run ${formatRange(run)} ends past the final depth`,
          evidence: `The hole's recorded final depth is ${finalDepth} m. Either the run's depth block or the final depth is wrong.`,
        });
      }
    }
  }
  return exceptions;
}

export type HoleSamplesInput = {
  drillholeId: string;
  holeId: string;
  samples: readonly {
    id: string;
    sampleNumber: string;
    type: SampleType;
    status: SampleStatus;
    createdAt: string;
    /** Primary samples' depths, for the overlap check. */
    fromM?: number | null;
    toM?: number | null;
  }[];
  qcRates: QcRates;
};

/** Depths closer than this are the same depth (as in core.ts). */
const SAMPLE_DEPTH_TOLERANCE_M = 0.005;

export type SamplingCustodyOptions = {
  now: Date;
  /** A sample not yet dispatched past this many days is a custody exception. */
  staleAfterDays: number;
};

/**
 * E12-2: QC insertion rates below target, samples stalled before dispatch, and
 * primary samples whose depths overlap, for the sampling-and-custody stage.
 * The phone refuses an overlapping sample, but two phones offline can each
 * record one over the same core; the server keeps both (each is a real bag
 * with a real tag) and raises the overlap here for a person to settle. QC rates use the project's own targets
 * (`Project.qcStandardEveryN` etc.), the same numbers the field reminder uses.
 */
export function samplingCustodyExceptions(
  holes: readonly HoleSamplesInput[],
  options: SamplingCustodyOptions,
): QaqcException[] {
  const exceptions: QaqcException[] = [];
  for (const hole of holes) {
    const achievement = qcAchievement(hole.samples, hole.qcRates);
    for (const a of achievement) {
      if (a.targetEveryN > 0 && a.primaryCount > 0) {
        const expected = Math.floor(a.primaryCount / a.targetEveryN);
        if (a.count < expected) {
          exceptions.push({
            key: `qc_rate_short:${hole.drillholeId}:${a.controlType}`,
            drillholeId: hole.drillholeId,
            holeId: hole.holeId,
            kind: "qc_rate_short",
            summary: `${a.controlType} rate below target`,
            evidence: `${a.count} of an expected ${expected}+ for ${a.primaryCount} primary samples (target 1 per ${a.targetEveryN}).`,
          });
        }
      }
    }
    const primaries = hole.samples
      .filter(
        (s): s is typeof s & { fromM: number; toM: number } =>
          s.type === "primary" && s.fromM != null && s.toM != null,
      )
      .sort((a, b) => a.fromM - b.fromM || a.toM - b.toM);
    primaries.forEach((a, i) => {
      for (const b of primaries.slice(i + 1)) {
        if (b.fromM >= a.toM - SAMPLE_DEPTH_TOLERANCE_M) break;
        const [first, second] = [a, b].sort((x, y) =>
          x.sampleNumber < y.sampleNumber ? -1 : 1,
        );
        exceptions.push({
          key: `sample_overlap:${first!.id}:${second!.id}`,
          drillholeId: hole.drillholeId,
          holeId: hole.holeId,
          kind: "sample_overlap",
          summary: `${a.sampleNumber} and ${b.sampleNumber} overlap at ${b.fromM}–${Math.min(a.toM, b.toM)} m`,
          evidence: `${a.sampleNumber} is ${a.fromM}–${a.toM} m and ${b.sampleNumber} is ${b.fromM}–${b.toM} m in ${hole.holeId}. The same core can't be in two primary samples: check the bags, then void or correct one.`,
        });
      }
    });
    for (const sample of hole.samples) {
      if (sample.status === "dispatched") continue;
      const ageDays =
        (options.now.getTime() - Date.parse(sample.createdAt)) / 86_400_000;
      if (ageDays > options.staleAfterDays) {
        exceptions.push({
          key: `custody_stalled:${sample.id}`,
          drillholeId: hole.drillholeId,
          holeId: hole.holeId,
          kind: "custody_stalled",
          summary: `${sample.sampleNumber} has sat ${sample.status} for ${Math.floor(ageDays)} days`,
          evidence: `Created ${sample.createdAt}, still ${sample.status}, not yet dispatched.`,
        });
      }
    }
  }
  return exceptions;
}

export type DeviceSyncInput = {
  deviceId: string;
  name: string;
  lastSeenAt: string | null;
};

export type DeviceStaleOptions = {
  now: Date;
  /** Weeks offline are normal for this app; only flag well beyond that. */
  staleAfterDays: number;
};

/**
 * E12-2 "unsynced work": devices that have gone quiet longer than a generous
 * threshold. Worded as evidence freshness, not a fault — the app is built to
 * work offline for weeks, so this is visibility for a reviewer, not an alarm.
 */
export function deviceStaleExceptions(
  devices: readonly DeviceSyncInput[],
  options: DeviceStaleOptions,
): QaqcException[] {
  const exceptions: QaqcException[] = [];
  for (const device of devices) {
    if (!device.lastSeenAt) continue;
    const ageDays =
      (options.now.getTime() - Date.parse(device.lastSeenAt)) / 86_400_000;
    if (ageDays > options.staleAfterDays) {
      exceptions.push({
        key: `device_stale:${device.deviceId}`,
        drillholeId: "",
        holeId: "",
        kind: "device_stale",
        summary: `${device.name} last synced ${Math.floor(ageDays)} days ago`,
        evidence: `Last seen ${device.lastSeenAt}.`,
      });
    }
  }
  return exceptions;
}

export type QaqcExceptionFilter = {
  resolvedKeys: ReadonlySet<string>;
};

/** Drops exceptions a reviewer already resolved (E12-2: "resolved with a reason"). */
export function openExceptions(
  exceptions: readonly QaqcException[],
  filter: QaqcExceptionFilter,
): QaqcException[] {
  return exceptions.filter((e) => !filter.resolvedKeys.has(e.key));
}

// --- Review decisions (E12-3) -----------------------------------------------

export const QAQC_DECISIONS = ["accept", "hold", "reject"] as const;
export type QaqcDecision = (typeof QAQC_DECISIONS)[number];

export const QAQC_DECISION_LABELS: Record<QaqcDecision, string> = {
  accept: "Accept",
  hold: "Hold",
  reject: "Reject",
};

export function isQaqcDecision(value: unknown): value is QaqcDecision {
  return (
    typeof value === "string" &&
    (QAQC_DECISIONS as readonly string[]).includes(value)
  );
}
