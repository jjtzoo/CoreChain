import { NextResponse } from "next/server";
import { apiUser, badRequest, readJson, signInRequired } from "@/lib/api";
import { issueSampleBlock } from "@/lib/sampleBlocks";

// Asks for a block of sample numbers for one project, for one of the caller's
// devices. The phone asks when it is running low (fewer than 20 left) and
// whenever it has signal, so it never runs out at the rig.
export async function POST(request: Request) {
  const user = await apiUser(request);
  if (!user) return signInRequired();

  const body = await readJson(request);
  if (!body) return badRequest();

  const result = await issueSampleBlock(user.id, {
    deviceId: body.deviceId,
    projectId: body.projectId,
    size: body.size,
  });

  if (result.ok)
    return NextResponse.json(
      { ok: true, block: result.block },
      { status: 201 },
    );
  switch (result.reason) {
    case "invalid":
      return badRequest("invalid");
    case "device-not-found":
    case "project-not-found":
      return NextResponse.json({ error: result.reason }, { status: 404 });
    case "device-revoked":
      return NextResponse.json({ error: result.reason }, { status: 403 });
    case "too-many-blocks":
      return NextResponse.json({ error: result.reason }, { status: 409 });
  }
}
