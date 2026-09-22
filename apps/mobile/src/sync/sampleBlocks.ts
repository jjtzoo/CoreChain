import { SERVER_URL } from '@/config';
import { listProjects } from '@/data/projectsRepository';
import { blockStatus, saveBlock } from '@/data/sampleBlocksRepository';
import { getDeviceId, registerDevice } from './device';

// Asks the server for more sample numbers whenever a project's run is getting
// short (E6-4), so a geologist at the rig does not run out. Safe to call as
// often as you like: a project that already has enough is a cheap no-op, and
// a project the server refused (see RETRY_COOLDOWN_MS below) is skipped until
// the cooldown passes rather than retried on every call.

let running = false;

// The caller (sync-context.tsx's refresh()) runs on every status change from
// PowerSync, which can fire many times a second even while idle. A refusal
// (404: project not provisioned yet, 409: no runs left) will not resolve
// itself that fast, so retrying immediately just hammers the server; wait
// this long before trying the same project again.
const RETRY_COOLDOWN_MS = 60_000;
const lastAttemptAt = new Map<string, number>();

export async function topUpSampleBlocks(cookie: string): Promise<void> {
  if (running) return;
  running = true;
  try {
    const projects = await listProjects();
    for (const project of projects) {
      const status = await blockStatus(project.id);
      // A project with no run yet needs one too: until it has one, numbers
      // come from the project's own counter, which two phones could share.
      if (status.hasBlocks && !status.low) continue;

      const last = lastAttemptAt.get(project.id) ?? 0;
      if (Date.now() - last < RETRY_COOLDOWN_MS) continue;
      lastAttemptAt.set(project.id, Date.now());

      const registered = await registerDevice(cookie);
      if (!registered.ok) return;
      let response: Response;
      try {
        response = await fetch(`${SERVER_URL}/api/sample-blocks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({
            deviceId: await getDeviceId(),
            projectId: project.id,
          }),
        });
      } catch {
        return; // no signal: try again later
      }
      // 404: the server does not have the project yet. 409: as many runs as
      // it allows. Neither is fixed by asking again right now.
      if (!response.ok) continue;
      const body = (await response.json()) as {
        block?: {
          id: string;
          projectId: string;
          startNumber: number;
          size: number;
        };
      };
      if (body.block) await saveBlock(body.block);
    }
  } catch {
    // Sample numbers are topped up on a later try.
  } finally {
    running = false;
  }
}
