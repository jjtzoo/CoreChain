import { NextResponse } from "next/server";
import { apiUser, badRequest, readJson, signInRequired } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const MAX_NAME_LENGTH = 200;

// A geologist's own display name, editable from the phone's first-login
// orientation and the Account screen afterwards — the admin sets an initial
// name when creating the account, but the account holder may prefer to go by
// something else on their own entries.
export async function PATCH(request: Request) {
  const user = await apiUser(request);
  if (!user) return signInRequired();

  const body = await readJson(request);
  if (!body) return badRequest();

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > MAX_NAME_LENGTH) return badRequest("invalid-name");

  await prisma.user.update({ where: { id: user.id }, data: { name } });
  return NextResponse.json({ ok: true, name });
}
