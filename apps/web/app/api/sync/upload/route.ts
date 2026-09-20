import { NextResponse } from "next/server";
import { apiUser, badRequest, readJson, signInRequired } from "@/lib/api";
import { applyUpload } from "@/lib/sync/upload";

// The phone sends what it changed while offline. The answer lists what happened
// to each change, in order: applied, duplicate (already had it), conflict (the
// server has a different newer version; the change is kept for review) or
// rejected (with the reason). The phone marks rejected and conflicting records
// "needs attention" and carries on: one refused change never blocks the queue.
export async function POST(request: Request) {
  const user = await apiUser(request);
  if (!user) return signInRequired();

  // Uploads are batches of small records: refuse anything that is clearly not.
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 1_000_000) return badRequest("too-large");

  const body = await readJson(request);
  if (!body) return badRequest();

  const outcome = await applyUpload(user.id, {
    deviceId: body.deviceId,
    ops: body.ops,
  });
  if (outcome.ok) return NextResponse.json({ results: outcome.results });

  switch (outcome.reason) {
    case "invalid":
    case "too-many-operations":
      return badRequest(outcome.reason);
    case "device-not-found":
      return NextResponse.json({ error: outcome.reason }, { status: 404 });
    case "device-revoked":
      return NextResponse.json({ error: outcome.reason }, { status: 403 });
  }
}
