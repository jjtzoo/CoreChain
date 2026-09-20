// E10-2 / E10-6: tester feedback. A tester sends it from any screen; the admin
// triages it in one place. Kept here so the phone, the server and the admin page
// agree on the categories, the statuses and what counts as a valid message.

export const FEEDBACK_CATEGORIES = ["bug", "idea", "question"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_STATUSES = ["new", "seen", "planned", "done"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Something is wrong",
  idea: "An idea",
  question: "A question",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  seen: "Seen",
  planned: "Planned",
  done: "Done",
};

export const FEEDBACK_MIN_LENGTH = 5;
export const FEEDBACK_MAX_LENGTH = 2000;

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return typeof value === "string" && (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === "string" && (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

export type FeedbackInput = {
  category: string;
  message: string;
};

export type FeedbackErrors = { category?: string; message?: string };

/** Checks a feedback form before it is sent. An empty object means it can be sent. */
export function validateFeedback(input: FeedbackInput): FeedbackErrors {
  const errors: FeedbackErrors = {};
  if (!isFeedbackCategory(input.category)) {
    errors.category = "Choose what this is about.";
  }
  const length = input.message.trim().length;
  if (length < FEEDBACK_MIN_LENGTH) {
    errors.message = "Tell us a little more.";
  } else if (length > FEEDBACK_MAX_LENGTH) {
    errors.message = `Keep it under ${FEEDBACK_MAX_LENGTH} characters.`;
  }
  return errors;
}

/** What the phone tells the tester after saving a message it cannot send yet. */
export function feedbackQueuedMessage(): string {
  return "Saved. It will be sent when you have signal.";
}

/**
 * Counts feedback by a field (for example the screen), most frequent first, so
 * the places testers struggle stand out. Blank values are counted as "Unknown".
 */
export function countBy<T>(
  items: readonly T[],
  pick: (item: T) => string | null | undefined,
): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const key = pick(item)?.trim() || "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
