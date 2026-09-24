import { DEFAULT_BLOCK_SIZE, nextBlockRange } from "@corechain/domain";
import { randomUUID } from "node:crypto";
import { currentDeviceWorkspace } from "./devices";
import { prisma } from "./prisma";

// E6-4, the server half: hand a device a reserved run of sample numbers so two
// phones on one project can never use the same one, even with no signal. The
// rules (where a block starts, that blocks never overlap) live in
// packages/domain/src/sampleBlocks.ts; the database backs them with an EXCLUDE
// constraint. Here each request first locks the project row, so two requests
// for the same project are served one after the other and can't compute the
// same range.

const MAX_BLOCK_SIZE = 500;
const MAX_BLOCKS_PER_DEVICE_PER_PROJECT = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type BlockResult =
  | {
      ok: true;
      block: {
        id: string;
        projectId: string;
        deviceId: string;
        startNumber: number;
        size: number;
      };
    }
  | {
      ok: false;
      reason:
        | "invalid"
        | "device-not-found"
        | "device-revoked"
        | "project-not-found"
        | "too-many-blocks";
    };

export async function issueSampleBlock(
  userId: string,
  input: { deviceId: unknown; projectId: unknown; size?: unknown },
): Promise<BlockResult> {
  const deviceId =
    typeof input.deviceId === "string" && UUID.test(input.deviceId)
      ? input.deviceId.toLowerCase()
      : null;
  const projectId =
    typeof input.projectId === "string" && UUID.test(input.projectId)
      ? input.projectId.toLowerCase()
      : null;
  if (!deviceId || !projectId) return { ok: false, reason: "invalid" };

  let size = DEFAULT_BLOCK_SIZE;
  if (input.size !== undefined) {
    if (
      typeof input.size !== "number" ||
      !Number.isInteger(input.size) ||
      input.size < 1 ||
      input.size > MAX_BLOCK_SIZE
    ) {
      return { ok: false, reason: "invalid" };
    }
    size = input.size;
  }

  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || device.userId !== userId)
    return { ok: false, reason: "device-not-found" };
  if (device.revokedAt) return { ok: false, reason: "device-revoked" };
  // The account's workspace now (its team, else its personal workspace), so a
  // geologist gets numbers on a team project a teammate created, not only on
  // their own projects.
  const organizationId = await currentDeviceWorkspace(device);

  return prisma.$transaction(
    async (tx): Promise<BlockResult> => {
      // The lock: only one request per project gets past this line at a time.
      // Any undeleted project in the account's workspace counts, the same rule
      // the sync streams use to send the project to the phone.
      const project = await tx.$queryRaw<
        Array<{ next_sample_number: number; organization_id: string }>
      >`
        SELECT next_sample_number, organization_id FROM projects
        WHERE id = ${projectId}::uuid AND organization_id = ${organizationId} AND deleted_at IS NULL
        FOR UPDATE`;
      if (project.length === 0)
        return { ok: false, reason: "project-not-found" };

      const held = await tx.sampleNumberBlock.count({
        where: { projectId, deviceId },
      });
      if (held >= MAX_BLOCKS_PER_DEVICE_PER_PROJECT)
        return { ok: false, reason: "too-many-blocks" };

      const issued = await tx.sampleNumberBlock.findMany({
        where: { projectId },
        select: { startNumber: true, size: true },
      });
      const range = nextBlockRange(
        issued.map((block) => ({ start: block.startNumber, size: block.size })),
        project[0].next_sample_number,
        size,
      );

      const block = await tx.sampleNumberBlock.create({
        data: {
          id: randomUUID(),
          organizationId: project[0].organization_id,
          projectId,
          deviceId,
          startNumber: range.start,
          size: range.size,
          issuedAt: new Date(),
        },
      });
      await tx.device.update({
        where: { id: deviceId },
        data: { lastSeenAt: new Date() },
      });
      return {
        ok: true,
        block: {
          id: block.id,
          projectId,
          deviceId,
          startNumber: block.startNumber,
          size: block.size,
        },
      };
    },
    { timeout: 10_000 },
  );
}
