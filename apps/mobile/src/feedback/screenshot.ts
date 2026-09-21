import { Directory, File, Paths } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import { captureScreen } from 'react-native-view-shot';

import { SERVER_URL } from '@/config';

// E10-2: an optional screenshot of the screen a message was sent from. Kept
// in its own cache folder (never the shared gallery, and never synced) until
// it has been offered to the server once.

const SCREENSHOT_DIRECTORY = 'feedback-screenshots';

function screenshotsDirectory(): Directory {
  const directory = new Directory(Paths.cache, SCREENSHOT_DIRECTORY);
  if (!directory.exists) {
    directory.create({ idempotent: true });
  }
  return directory;
}

/**
 * Captures the screen behind the feedback form, right before navigating to
 * it (the feedback screen itself has nothing worth a screenshot of). Returns
 * null on any failure — a missing screenshot never blocks sending feedback.
 */
export async function captureCurrentScreen(): Promise<string | null> {
  try {
    const uri = await captureScreen({ format: 'png', quality: 0.9 });
    const source = new File(uri);
    const destination = new File(
      screenshotsDirectory(),
      `${Date.now()}.png`,
    );
    source.move(destination);
    return destination.uri;
  } catch {
    return null;
  }
}

export function deleteScreenshot(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Best-effort cleanup: a leftover cache file costs nothing worth failing over.
  }
}

/**
 * One best-effort attempt — never retried, unlike the message itself, since
 * the screenshot is an optional extra a tester can always redo.
 */
export async function uploadScreenshot(
  cookie: string,
  feedbackId: string,
  uri: string,
): Promise<void> {
  try {
    const file = new File(uri);
    if (!file.exists) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    await fetch(`${SERVER_URL}/api/feedback/${feedbackId}/screenshot`, {
      method: 'PUT',
      headers: { Cookie: cookie, 'Content-Type': 'image/png' },
      body: bytes,
    });
  } catch {
    // No signal, a dropped connection, or the server declined it: the
    // message itself was already sent, so the screenshot is simply dropped.
  }
}
