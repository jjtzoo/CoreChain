// Laboratory dispatch inbox, receipt and results (E13-1, E13-2, E13-3).
// A dispatch's receipt state is never stored as its own flag: it is worked
// out from the dispatched sample ids compared against which of them have a
// "received" custody event recorded against this dispatch (custody.ts) — the
// same compute-don't-store pattern qaqc.ts uses for exceptions, so there is
// only ever one place a sample's real status can be wrong.

export const RECEIPT_STATUSES = [
  "not_received",
  "partially_received",
  "received",
] as const;
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number];

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  not_received: "Not yet confirmed received",
  partially_received: "Partially received",
  received: "All samples received",
};

/** Whether none, some, or all of a dispatch's samples have a "received" custody event. */
export function receiptStatus(
  dispatchedSampleIds: readonly string[],
  receivedSampleIds: readonly string[],
): ReceiptStatus {
  if (dispatchedSampleIds.length === 0) return "not_received";
  const received = new Set(receivedSampleIds);
  const receivedCount = dispatchedSampleIds.filter((id) =>
    received.has(id),
  ).length;
  if (receivedCount === 0) return "not_received";
  if (receivedCount === dispatchedSampleIds.length) return "received";
  return "partially_received";
}

/** The dispatched samples with no "received" event yet — a short or missing shipment. */
export function missingSampleIds(
  dispatchedSampleIds: readonly string[],
  receivedSampleIds: readonly string[],
): string[] {
  const received = new Set(receivedSampleIds);
  return dispatchedSampleIds.filter((id) => !received.has(id));
}

export const RESULTS_STATUSES = ["not_started", "in_progress", "complete"] as const;
export type ResultsStatus = (typeof RESULTS_STATUSES)[number];

export const RESULTS_STATUS_LABELS: Record<ResultsStatus, string> = {
  not_started: "No results entered yet",
  in_progress: "Results in progress",
  complete: "Results complete",
};

/**
 * A dispatch's own `resultsReturnedAt` is the only thing that makes it
 * "complete" — entering every analyte for every sample does not, on its own,
 * finish the batch, since a laboratory may still want to review before
 * marking it done.
 */
export function resultsStatus(
  sampleIdsWithResults: readonly string[],
  resultsReturnedAt: string | null,
): ResultsStatus {
  if (resultsReturnedAt) return "complete";
  if (sampleIdsWithResults.length === 0) return "not_started";
  return "in_progress";
}

// Receive by scan: the laboratory scans (or types) the tag on each bag as it
// comes off the truck. A USB or Bluetooth scanner types the code and presses
// Enter, so a scan and a typed number arrive the same way. Matching ignores
// capitals, like the samples' own unique index.

/**
 * The sample number inside whatever the scanner read: surrounding spaces and
 * control characters are dropped, and a QR code that holds a link keeps only
 * its last path segment ("https://…/samples/AB-0041" gives "AB-0041").
 */
export function scannedSampleNumber(raw: string): string {
  let code = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(code)) {
    const path = code.replace(/[?#].*$/, "").replace(/\/+$/, "");
    code = decodeURIComponent(path.slice(path.lastIndexOf("/") + 1));
  }
  return code.trim();
}

/** One dispatched sample a scan could be meant for. */
export type ScanCandidate = {
  sampleId: string;
  sampleNumber: string;
  dispatchId: string;
  dispatchNumber: string;
  receivedAt: string | null;
};

export type ScanOutcome =
  | { kind: "empty" }
  | { kind: "receive"; candidate: ScanCandidate }
  | { kind: "already_received"; candidate: ScanCandidate }
  | { kind: "not_dispatched"; code: string };

/**
 * What a scan means. A sample can sit in more than one dispatch only if it
 * was taken out of an open one and sent again; the one still waiting for
 * receipt wins.
 */
export function matchScan(
  raw: string,
  candidates: readonly ScanCandidate[],
): ScanOutcome {
  const code = scannedSampleNumber(raw);
  if (!code) return { kind: "empty" };
  const matches = candidates.filter(
    (c) => c.sampleNumber.trim().toLowerCase() === code.toLowerCase(),
  );
  if (matches.length === 0) return { kind: "not_dispatched", code };
  const waiting = matches.find((c) => c.receivedAt === null);
  if (waiting) return { kind: "receive", candidate: waiting };
  return { kind: "already_received", candidate: matches[0]! };
}

/** A received sample waiting for preparation and results. */
export type QueueSample = {
  sampleId: string;
  sampleNumber: string;
  dispatchNumber: string;
  holeId: string;
  projectName: string;
  receivedAt: string;
  /** The project manager's flag on the hole (E11-3). */
  priority: "normal" | "urgent";
  priorityNote: string | null;
};

/**
 * The preparation queue: received samples with no result yet, in batches not
 * marked complete. Holes the project manager flagged urgent go first; within
 * each, first received is first prepared, then by sample number.
 */
export function preparationQueue(
  samples: ReadonlyArray<
    Omit<QueueSample, "receivedAt"> & {
      receivedAt: string | null;
      hasResults: boolean;
      resultsComplete: boolean;
    }
  >,
): QueueSample[] {
  return samples
    .filter(
      (s): s is typeof s & { receivedAt: string } =>
        s.receivedAt !== null && !s.hasResults && !s.resultsComplete,
    )
    .map(({ hasResults: _h, resultsComplete: _c, ...sample }) => sample)
    .sort(
      (a, b) =>
        Number(b.priority === "urgent") - Number(a.priority === "urgent") ||
        a.receivedAt.localeCompare(b.receivedAt) ||
        a.sampleNumber.localeCompare(b.sampleNumber, undefined, { numeric: true }),
    );
}

/**
 * The sample a scanned or typed tag names, among the ones given (the phone
 * passes its project's samples). Capitals are ignored, like the samples'
 * own unique index. A deleted sample's tag is never matched.
 */
export function findSampleByTag<
  T extends { sampleNumber: string; deletedAt?: string | null },
>(raw: string, samples: readonly T[]): T | null {
  const code = scannedSampleNumber(raw).toLowerCase();
  if (!code) return null;
  return (
    samples.find(
      (s) => !s.deletedAt && s.sampleNumber.trim().toLowerCase() === code,
    ) ?? null
  );
}
