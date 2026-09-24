// Shared by the two demo seed scripts: finds the account by email, then loads
// one demo project into the account's workspace (its team when it is on one,
// the same rule the sync streams and the team pages use).

import { workspaceId } from "@corechain/domain";
import { PrismaClient } from "@prisma/client";
import { loadDemoProjects, type DemoProjectKey } from "../lib/demo/demoProjects";

export function runDemoSeed(which: DemoProjectKey, command: string): void {
  main(which, command).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

async function main(which: DemoProjectKey, command: string) {
  const email = process.argv[2];
  if (!email) throw new Error(`Usage: npm run ${command} -- <email>`);
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("No account with that email.");
    const team = user.organizationId
      ? await prisma.organization.findUnique({ where: { id: user.organizationId } })
      : null;
    console.log(
      team
        ? `Seeding into team "${team.name}".`
        : "Seeding into the account's personal workspace (not on a team).",
    );
    const [summary] = await loadDemoProjects(
      prisma,
      { organizationId: workspaceId(user), requestedBy: { id: user.id, name: user.name } },
      [which],
    );
    console.log(
      `Loaded "${summary.name}" into ${email}: ${summary.holes} holes, ${summary.intervals} intervals, ${summary.boxesAndRuns} boxes and runs, ${summary.samples} samples.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
