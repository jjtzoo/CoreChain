import { qcAchievement, type ControlType, type QcRates } from "@corechain/domain";

// The project manager's figures (docs/product/project-manager-mode-outline.md):
// programme progress, metres drilled in a period, laboratory turnaround,
// QA/QC decisions and QC insertion. Pure, so the pages only load and display.

const DAY_MS = 86_400_000;

/** A dispatch counts as overdue once it has been at the laboratory this long. */
export const RESULTS_OVERDUE_AFTER_DAYS = 14;

export function wholeDaysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));
}

/**
 * How deep a hole has been drilled: the final depth the geologist recorded,
 * or else the deepest run so far, or 0 for a hole not started.
 */
export function drilledDepthM(hole: {
  actualFinalDepthM: number | null;
  runs: readonly { toM: number }[];
}): number {
  if (hole.actualFinalDepthM != null && hole.actualFinalDepthM > 0) return hole.actualFinalDepthM;
  return hole.runs.reduce((max, run) => Math.max(max, run.toM), 0);
}

/** Metres of core runs recorded in [from, to). */
export function metresDrilledBetween(
  runs: readonly { fromM: number; toM: number; createdAt: Date }[],
  from: Date,
  to: Date,
): number {
  return runs.reduce(
    (sum, run) =>
      run.createdAt >= from && run.createdAt < to ? sum + Math.max(0, run.toM - run.fromM) : sum,
    0,
  );
}

/** Whole percent of `part` in `total`, capped at 100; 0 when there is no total. */
export function percentOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

export type DispatchState =
  | { kind: "open" }
  | { kind: "waiting"; days: number; overdue: boolean }
  | { kind: "returned"; days: number };

/**
 * Where a dispatch stands with the laboratory. The clock starts on the
 * hand-over day the geologist chose (a plain day, "2026-09-11"), or when the
 * dispatch was created if no day was chosen, and stops when results came back.
 */
export function dispatchState(
  dispatch: {
    status: string;
    handoverAt: string | null;
    createdAt: Date;
    resultsReturnedAt: Date | null;
  },
  now: Date,
): DispatchState {
  const started = handoverStart(dispatch);
  if (dispatch.resultsReturnedAt) {
    return { kind: "returned", days: wholeDaysBetween(started, dispatch.resultsReturnedAt) };
  }
  if (dispatch.status !== "dispatched") return { kind: "open" };
  const days = wholeDaysBetween(started, now);
  return { kind: "waiting", days, overdue: days > RESULTS_OVERDUE_AFTER_DAYS };
}

export function handoverStart(dispatch: { handoverAt: string | null; createdAt: Date }): Date {
  if (dispatch.handoverAt && /^\d{4}-\d{2}-\d{2}$/.test(dispatch.handoverAt)) {
    const day = new Date(`${dispatch.handoverAt}T00:00:00Z`);
    if (!Number.isNaN(day.getTime())) return day;
  }
  return dispatch.createdAt;
}

/** Average days to results over the dispatches that came back, or null. */
export function averageTurnaroundDays(states: readonly DispatchState[]): number | null {
  const returned = states.flatMap((s) => (s.kind === "returned" ? [s.days] : []));
  if (returned.length === 0) return null;
  return Math.round(returned.reduce((sum, d) => sum + d, 0) / returned.length);
}

/** Waiting dispatches first (longest first), then open, then returned (newest first). */
export function compareDispatchesForManager(
  a: { state: DispatchState; returnedAt: Date | null },
  b: { state: DispatchState; returnedAt: Date | null },
): number {
  const rank = (s: DispatchState) => (s.kind === "waiting" ? 0 : s.kind === "open" ? 1 : 2);
  const byRank = rank(a.state) - rank(b.state);
  if (byRank !== 0) return byRank;
  if (a.state.kind === "waiting" && b.state.kind === "waiting") return b.state.days - a.state.days;
  return (b.returnedAt?.getTime() ?? 0) - (a.returnedAt?.getTime() ?? 0);
}

export type DecisionLike = {
  drillholeId: string;
  stage: string | null;
  decision: string;
  decidedAt: Date;
};

/**
 * The decision that stands for each hole in each QA/QC stage: the newest one.
 * Decisions are append-only, so an older hold replaced by an accept is history.
 */
export function standingDecisions<T extends DecisionLike>(decisions: readonly T[]): T[] {
  const latest = new Map<string, T>();
  for (const decision of decisions) {
    const key = `${decision.drillholeId}:${decision.stage ?? ""}`;
    const current = latest.get(key);
    if (!current || decision.decidedAt > current.decidedAt) latest.set(key, decision);
  }
  return [...latest.values()].sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime());
}

export function isHeldOrRejected(decision: { decision: string }): boolean {
  return decision.decision === "hold" || decision.decision === "reject";
}

export type QcInsertionRow = {
  controlType: ControlType;
  everyN: number;
  /** Controls the rate asks for so far; null when the rate is switched off. */
  expected: number | null;
  inserted: number;
  short: boolean;
};

/** Standards, blanks and duplicates inserted against the project's rates. */
export function qcInsertion(
  samples: readonly { type: "primary" | ControlType }[],
  rates: QcRates,
): QcInsertionRow[] {
  return qcAchievement(samples, rates).map((row) => {
    const expected =
      row.targetEveryN > 0 ? Math.floor(row.primaryCount / row.targetEveryN) : null;
    return {
      controlType: row.controlType,
      everyN: row.targetEveryN,
      expected,
      inserted: row.count,
      short: expected !== null && row.count < expected,
    };
  });
}

export const REPORT_PERIODS = ["7", "30", "all"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  "7": "Last 7 days",
  "30": "Last 30 days",
  all: "Since the start",
};

export function toReportPeriod(value: unknown): ReportPeriod {
  return (REPORT_PERIODS as readonly unknown[]).includes(value) ? (value as ReportPeriod) : "7";
}

/** The start of a report period ending now; "all" starts at the epoch. */
export function reportPeriodStart(period: ReportPeriod, now: Date): Date {
  if (period === "all") return new Date(0);
  return new Date(now.getTime() - Number(period) * DAY_MS);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "11 Sep 2026", in UTC so server and browser agree. */
export function formatDay(at: Date): string {
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`;
}

/** "11 Sep", for tables where the year is obvious. */
export function formatShortDay(at: Date): string {
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
}

export function formatMetres(m: number): string {
  return `${m.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`;
}

export function daysLabel(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}
