// Builds the showcase team: a made-up exploration team, separate from every
// real team, with two synthetic projects part-way through a drilling
// programme (lib/demo/showcaseTeam.ts). The admin opens it with "View as".
//
//   npm run showcase:seed             build it, or rebuild it with fresh dates
//   npm run showcase:seed -- --remove take it out again
//
// Only the showcase team is touched. Rebuild it before a demonstration: its
// dates count back from the day it is loaded.

import { PrismaClient } from "@prisma/client";
import { loadShowcaseTeam, removeShowcaseTeam, SHOWCASE_TEAM_NAME } from "../lib/demo/showcaseTeam";

async function main() {
  const prisma = new PrismaClient();
  try {
    if (process.argv.includes("--remove")) {
      await removeShowcaseTeam(prisma);
      console.log(`Removed "${SHOWCASE_TEAM_NAME}" and everything in it.`);
      return;
    }
    const summary = await loadShowcaseTeam(prisma);
    console.log(`Loaded "${summary.team}" with ${summary.people} people.`);
    for (const p of summary.projects)
      console.log(`  ${p.name}: ${p.holes} holes, ${p.intervals} intervals, ${p.runs} runs, ${p.samples} samples.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
