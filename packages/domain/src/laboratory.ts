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
