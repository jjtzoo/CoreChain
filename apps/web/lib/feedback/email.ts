import {
  ROLE_LABELS,
  isFeedbackCategory,
  toUserRole,
  type FeedbackCategory,
} from "@corechain/domain";

// An email to the owner for every feedback message a tester sends, through
// Resend's HTTP API (no SDK). It is off until both RESEND_API_KEY and
// FEEDBACK_NOTIFY_EMAIL are set, and it never stands in the way of saving the
// feedback: a failed or slow email is logged and dropped.
//
// Without a verified domain, Resend only delivers to the email address of the
// Resend account itself, which is exactly who these are for.

const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "CoreChain feedback <onboarding@resend.dev>";
const DEFAULT_SITE = "https://corechain-orpin.vercel.app";
const TIMEOUT_MS = 5_000;

/** How the owner reads each kind of feedback in a subject line. */
const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "Problem",
  idea: "Idea",
  question: "Question",
};

export type FeedbackEmailInput = {
  id: string;
  category: string;
  message: string;
  tier: string;
  source: string;
  appVersion: string | null;
  device: string | null;
  screen: string | null;
  createdAt: Date;
  person: { name: string; email: string };
};

export type EmailConfig = { apiKey: string; to: string; from: string; site: string };

/** The email settings, or null when notifications are not switched on. */
export function feedbackEmailConfig(
  env: Record<string, string | undefined> = process.env,
): EmailConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const to = env.FEEDBACK_NOTIFY_EMAIL?.trim();
  if (!apiKey || !to) return null;
  return {
    apiKey,
    to,
    from: env.FEEDBACK_EMAIL_FROM?.trim() || DEFAULT_FROM,
    site: (env.BETTER_AUTH_URL?.trim() || DEFAULT_SITE).replace(/\/+$/, ""),
  };
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** Subject, plain text and HTML for one feedback message. */
export function buildFeedbackEmail(item: FeedbackEmailInput, site: string) {
  const category = isFeedbackCategory(item.category)
    ? CATEGORY_LABELS[item.category]
    : "Feedback";
  const tier = ROLE_LABELS[toUserRole(item.tier)];
  const firstLine = item.message.split("\n")[0]!.slice(0, 60);
  const subject = `${category} from ${item.person.name}: ${firstLine}${
    item.message.length > firstLine.length ? "…" : ""
  }`;
  const inbox = `${site}/admin/feedback`;
  const details: [string, string][] = [
    ["From", `${item.person.name} (${item.person.email})`],
    ["Role", tier],
    ["Sent from", item.source === "web" ? "Website" : "Android app"],
    ["App version", item.appVersion ?? "Not given"],
    ["Phone", item.device ?? "Not given"],
    ["Screen", item.screen ?? "Not given"],
    ["Received", `${item.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC`],
  ];

  const text = [
    `${category} from ${item.person.name}`,
    "",
    item.message,
    "",
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    `Open the feedback inbox: ${inbox}`,
    "A screenshot, if the tester allowed one, is in the inbox.",
  ].join("\n");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#182321;max-width:560px">
<p style="font-size:13px;color:#49554F;margin:0 0 4px">CoreChain feedback · ${escapeHtml(category)}</p>
<p style="font-size:16px;white-space:pre-wrap;margin:0 0 16px">${escapeHtml(item.message)}</p>
<table style="font-size:13px;border-collapse:collapse">${details
    .map(
      ([label, value]) =>
        `<tr><td style="color:#49554F;padding:2px 12px 2px 0">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("")}</table>
<p style="margin:16px 0 0"><a href="${escapeHtml(inbox)}">Open the feedback inbox</a>. A screenshot, if the tester allowed one, is there.</p>
</div>`;

  return { subject, text, html };
}

/** Send the email. Never throws; reports whether it went. */
export async function sendFeedbackEmail(
  item: FeedbackEmailInput,
  config: EmailConfig | null = feedbackEmailConfig(),
  fetchImpl: typeof fetch = fetch,
): Promise<"sent" | "off" | "failed"> {
  if (!config) return "off";
  const { subject, text, html } = buildFeedbackEmail(item, config.site);
  try {
    const response = await fetchImpl(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        // Resend sends one email per key, so a retry cannot send it twice.
        "Idempotency-Key": `feedback-${item.id}`,
      },
      body: JSON.stringify({ from: config.from, to: [config.to], subject, text, html }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`Feedback email not sent: Resend answered ${response.status}.`);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("Feedback email not sent:", error instanceof Error ? error.message : error);
    return "failed";
  }
}
