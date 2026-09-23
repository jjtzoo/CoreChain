import { NextResponse } from "next/server";
import { apiUser, signInRequired } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// Lets a phone turn a teammate's account id (drillholes.created_by,
// custody_events.created_by, ...) into a name to show, e.g. the custody
// timeline's "logged by". Id and name only: email, role and everything else
// about a teammate never leaves this endpoint.
export async function GET(request: Request) {
  const user = await apiUser(request);
  if (!user) return signInRequired();

  const self = await prisma.user.findUnique({
    where: { id: user.id },
    select: { organizationId: true },
  });

  const roster = self?.organizationId
    ? await prisma.user.findMany({
        where: { organizationId: self.organizationId },
        select: { id: true, name: true },
      })
    : [{ id: user.id, name: user.name }];

  return NextResponse.json({ roster });
}
