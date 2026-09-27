// Builds the showcase team: a made-up exploration team, separate from every
// real team, with two synthetic projects part-way through a drilling
// programme (lib/demo/showcaseTeam.ts). The admin opens it with "View as".
//
//   npm run showcase:seed                 build it, or rebuild it with fresh dates
//   npm run showcase:seed -- --passwords  also give each showcase account a password
//   npm run showcase:seed -- --remove     take it out again
//
// Only the showcase team is touched. Rebuild it before a demonstration: its
// dates count back from the day it is loaded.
//
// Passwords go in showcase-accounts.private.txt (git ignores *.private.txt),
// never on screen. A password already in that file is kept, so a rebuild or a
// second run does not change anyone's sign-in.

import { randomInt } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { suggestPassphrase } from "@corechain/domain";
import { PrismaClient } from "@prisma/client";
import { loadShowcaseTeam, removeShowcaseTeam, SHOWCASE_TEAM_ID, SHOWCASE_TEAM_NAME } from "../lib/demo/showcaseTeam";

const OUTPUT = resolve(process.cwd(), "showcase-accounts.private.txt");

function readKnownPasswords(): Map<string, string> {
  const known = new Map<string, string>();
  if (!existsSync(OUTPUT)) return known;
  for (const line of readFileSync(OUTPUT, "utf8").split(/\r?\n/)) {
    const match = line.match(/^(\S+@\S+)\s+password:\s+(\S+)/);
    if (match) known.set(match[1], match[2]);
  }
  return known;
}

async function setPasswords(prisma: PrismaClient) {
  const { auth } = await import("../lib/auth");
  const context = await auth.$context;
  const known = readKnownPasswords();
  const people = await prisma.user.findMany({
    where: { organizationId: SHOWCASE_TEAM_ID, id: { startsWith: "showcase-" } },
    orderBy: { id: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
  const lines: string[] = [];
  for (const person of people) {
    const password = known.get(person.email) ?? suggestPassphrase(randomInt);
    const hash = await context.password.hash(password);
    const existing = await prisma.account.findFirst({
      where: { userId: person.id, providerId: "credential" },
    });
    if (existing) {
      await prisma.account.update({ where: { id: existing.id }, data: { password: hash } });
    } else {
      await prisma.account.create({
        data: {
          id: `${person.id}-credential`,
          accountId: person.id,
          providerId: "credential",
          userId: person.id,
          password: hash,
        },
      });
    }
    lines.push(`${person.email.padEnd(44)} password: ${password}   (${person.role}, ${person.name})`);
  }
  writeFileSync(
    OUTPUT,
    [
      `${SHOWCASE_TEAM_NAME}: sign-ins. PRIVATE: git ignores this file. Never commit or post it.`,
      "The database only stores a scrambled copy of each password.",
      "",
      ...lines,
      "",
    ].join("\n"),
  );
  console.log(`Passwords for ${people.length} showcase accounts written to ${OUTPUT}`);
}

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
    if (process.argv.includes("--passwords")) await setPasswords(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
