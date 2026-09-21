import { NextResponse } from "next/server";
import { apiUser, badRequest, readJson, signInRequired } from "@/lib/api";
import { registerDevice } from "@/lib/devices";
import { MIN_APP_VERSION } from "@/lib/minAppVersion";

// The phone calls this after signing in (and now and then) to say "this device
// is mine and still in use". Safe to repeat. The response also carries the
// oldest app version the server still accepts (E10-8), so a phone that was
// offline for weeks learns as soon as it can reach the server again.
export async function POST(request: Request) {
  const user = await apiUser(request);
  if (!user) return signInRequired();

  const body = await readJson(request);
  if (!body) return badRequest();

  const result = await registerDevice(user.id, {
    deviceId: body.deviceId,
    name: body.name,
    platform: body.platform,
    appVersion: body.appVersion,
  });
  if (result.ok)
    return NextResponse.json({
      ok: true,
      deviceId: result.deviceId,
      minAppVersion: MIN_APP_VERSION,
    });
  if (result.reason === "invalid") return badRequest("invalid");
  // "belongs-to-someone-else" and "revoked" are both a refusal, not a retry.
  return NextResponse.json({ error: result.reason }, { status: 403 });
}
