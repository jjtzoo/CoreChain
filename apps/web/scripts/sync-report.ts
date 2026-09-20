// Shows what the server holds for one account and what its phones last did:
// row counts per table, devices, and the most recent audit events. Read-only.
// Use it to check that a phone's work really reached the server.
//
//   npm run sync:report -- geologist1@corechain.test

import { PrismaClient } from "@prisma/client";

const TABLES = [
  "projects",
  "drillholes",
  "drillhole_status_history",
  "core_boxes",
  "core_runs",
  "code_library",
  "log_intervals",
  "samples",
  "qc_dismissals",
  "photos",
  "custody_events",
  "dispatches",
  "dispatch_samples",
];

async function main() {
  const email = process.argv[2];
  if (!email) throw new Error("Usage: npm run sync:report -- <email>");
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`No account with that email.`);
    console.log(`Account ${user.email} (${user.role})`);

    for (const table of TABLES) {
      const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT COUNT(*) AS n FROM "${table}" WHERE organization_id = $1`,
        user.id,
      );
      console.log(`  ${table.padEnd(26)} ${rows[0].n}`);
    }

    const devices = await prisma.device.findMany({
      where: { userId: user.id },
      orderBy: { lastSeenAt: "desc" },
    });
    console.log(`Devices: ${devices.length}`);
    for (const device of devices)
      console.log(
        `  ${device.name} (${device.platform}, app ${device.appVersion ?? "?"}) last seen ${device.lastSeenAt?.toISOString() ?? "never"}${device.revokedAt ? " REVOKED" : ""}`,
      );

    const events = await prisma.auditEvent.groupBy({
      by: ["action"],
      where: { organizationId: user.id },
      _count: true,
    });
    console.log(
      "Audit events: " +
        (events.map((e) => `${e.action} ${e._count}`).join(", ") || "none"),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
