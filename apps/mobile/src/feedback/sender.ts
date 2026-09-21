import { SERVER_URL } from '@/config';
import {
  listPendingFeedback,
  markFeedbackSent,
} from '@/data/feedbackRepository';
import { deleteScreenshot, uploadScreenshot } from '@/feedback/screenshot';

// Sends queued feedback to the server. Safe to call at any time and as often
// as you like: it stops quietly when there is no signal or no sign-in, and each
// message carries its own id, so one that was received but not acknowledged is
// stored once when it is sent again.

let flushing = false;

/** Returns how many messages are still waiting afterwards. */
export async function flushFeedback(cookie: string): Promise<number> {
  if (flushing) return (await listPendingFeedback()).length;
  flushing = true;
  try {
    for (const item of await listPendingFeedback()) {
      let response: Response;
      try {
        response = await fetch(`${SERVER_URL}/api/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({
            clientId: item.id,
            category: item.category,
            message: item.message,
            screen: item.screen,
            appVersion: item.appVersion,
            device: item.device,
            source: 'android',
          }),
        });
      } catch {
        break; // no signal: try again later
      }
      if (response.ok || response.status === 400) {
        // Stored, already stored, or refused as invalid (retrying can't fix it).
        if (response.ok && item.screenshotUri) {
          const body = (await response.json().catch(() => null)) as {
            id?: string;
          } | null;
          if (body?.id) {
            await uploadScreenshot(cookie, body.id, item.screenshotUri);
          }
        }
        if (item.screenshotUri) {
          deleteScreenshot(item.screenshotUri);
        }
        await markFeedbackSent(item.id);
      } else {
        break; // signed out (401), rate limited (429) or a server hiccup: keep it
      }
    }
  } finally {
    flushing = false;
  }
  return (await listPendingFeedback()).length;
}

export type SentFeedback = {
  id: string;
  category: string;
  message: string;
  status: string;
  note: string | null;
};

/** The person's own recent feedback and what the admin answered. Never throws. */
export async function fetchMyFeedback(cookie: string): Promise<SentFeedback[]> {
  try {
    const response = await fetch(`${SERVER_URL}/api/feedback`, {
      headers: { Cookie: cookie },
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { items?: SentFeedback[] };
    return body.items ?? [];
  } catch {
    return [];
  }
}
