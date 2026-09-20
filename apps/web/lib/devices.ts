import { prisma } from "./prisma";

// A phone or tablet signed in to an account (E1-5). The phone makes its own
// device id once, so the server can tell two phones on one account apart: that
// is what sample-number blocks are issued to (decision D6). "Remove this
// device" sets revoked_at, and the server then refuses that device.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLATFORMS = ["android", "ios", "web"] as const;

export type DeviceInput = {
  deviceId: unknown;
  name: unknown;
  platform: unknown;
  appVersion?: unknown;
};

export type DeviceResult =
  | { ok: true; deviceId: string }
  | { ok: false; reason: "invalid" | "belongs-to-someone-else" | "revoked" };

function clean(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : null;
}

/**
 * Registers a device for the account, or notes that it is still in use. A device
 * id that already belongs to another account is refused: a phone cannot be
 * claimed by someone else by guessing its id.
 */
export async function registerDevice(
  userId: string,
  input: DeviceInput,
): Promise<DeviceResult> {
  const deviceId =
    typeof input.deviceId === "string" && UUID.test(input.deviceId)
      ? input.deviceId.toLowerCase()
      : null;
  const name = clean(input.name, 120);
  const platform = PLATFORMS.find((value) => value === input.platform);
  if (!deviceId || !name || !platform) return { ok: false, reason: "invalid" };

  const existing = await prisma.device.findUnique({ where: { id: deviceId } });
  if (existing) {
    if (existing.userId !== userId)
      return { ok: false, reason: "belongs-to-someone-else" };
    if (existing.revokedAt) return { ok: false, reason: "revoked" };
    await prisma.device.update({
      where: { id: deviceId },
      data: {
        name,
        platform,
        appVersion: clean(input.appVersion, 40),
        lastSeenAt: new Date(),
      },
    });
    return { ok: true, deviceId };
  }

  const now = new Date();
  await prisma.device.create({
    data: {
      id: deviceId,
      // A personal workspace for now (decision D9): the account is its own organization.
      organizationId: userId,
      userId,
      name,
      platform,
      appVersion: clean(input.appVersion, 40),
      createdAt: now,
      lastSeenAt: now,
    },
  });
  return { ok: true, deviceId };
}
