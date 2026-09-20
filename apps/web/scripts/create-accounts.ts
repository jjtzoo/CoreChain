// Creates the owner's admin account and the pilot tester accounts (decision
// D13). Run it from apps/web:
//
//   npm run accounts:create
//
// It is safe to run again: an email that already exists is left alone (its
// password is never reset or shown again). `npm run accounts:create --
// --reset-geologists` gives every geologist account a fresh password. New accounts get a random password,
// and every password this script has made is kept in one private file that git
// ignores. Send each tester their own line yourself; never commit the file.

import { randomInt } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { type UserRole } from "@corechain/domain";

type Wanted = { name: string; email: string; role: UserRole };

// Placeholder addresses on the reserved ".test" domain: nothing is ever sent to
// them. Swap in a tester's real email by creating their account with the admin
// screen once it exists.
const WANTED: Wanted[] = [
  { name: "CoreChain Admin", email: "admin@corechain.test", role: "admin" },
  { name: "Test Geologist 1", email: "geologist1@corechain.test", role: "geologist" },
  { name: "Test Geologist 2", email: "geologist2@corechain.test", role: "geologist" },
  { name: "Test Geologist 3", email: "geologist3@corechain.test", role: "geologist" },
  { name: "Test Geologist 4", email: "geologist4@corechain.test", role: "geologist" },
  { name: "Test Geologist 5", email: "geologist5@corechain.test", role: "geologist" },
];

const OUTPUT = resolve(process.cwd(), "tester-accounts.private.txt");

// Testers type their password on a phone, often outdoors, so theirs is three
// short everyday words and three digits ("copper-ridge-gold-482"): easy to say
// and spell, still far too many combinations to guess. The admin's is fully
// random. Short, spellable words only.
const WORDS = [
  "copper", "gold", "silver", "nickel", "iron", "zinc", "lead", "tin", "cobalt",
  "quartz", "granite", "basalt", "shale", "slate", "chalk", "flint", "jade",
  "opal", "agate", "garnet", "mica", "talc", "coal", "sand", "clay", "ridge",
  "valley", "river", "creek", "hill", "rock", "stone", "core", "drill", "camp",
  "trail", "peak", "ledge", "cliff", "mesa", "dune", "reef", "delta", "spring",
  "boulder", "pebble", "lava", "ash", "moss", "fern",
];
const RANDOM = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function makePassword(role: UserRole): string {
  if (role === "admin") {
    const group = () =>
      Array.from({ length: 4 }, () => RANDOM[randomInt(RANDOM.length)]).join("");
    return `${group()}-${group()}-${group()}`;
  }
  const words = Array.from({ length: 3 }, () => WORDS[randomInt(WORDS.length)]);
  return `${words.join("-")}-${randomInt(100, 1000)}`;
}

function readKnownPasswords(): Map<string, string> {
  const known = new Map<string, string>();
  if (!existsSync(OUTPUT)) return known;
  for (const line of readFileSync(OUTPUT, "utf8").split(/\r?\n/)) {
    const match = line.match(/^(\S+@\S+)\s+password:\s+(\S+)/);
    if (match) known.set(match[1], match[2]);
  }
  return known;
}

async function main() {
  // Sign-up is off in the running app (D13). This script is the one place that
  // turns it on, and only for its own process. It must be set before auth loads.
  process.env.CORECHAIN_ALLOW_SIGN_UP = "true";
  const { auth } = await import("../lib/auth");
  const { prisma } = await import("../lib/prisma");

  const passwords = readKnownPasswords();
  const resetGeologists = process.argv.includes("--reset-geologists");
  const context = await auth.$context;
  let created = 0;

  for (const wanted of WANTED) {
    const existing = await prisma.user.findUnique({ where: { email: wanted.email } });
    if (existing && resetGeologists && wanted.role === "geologist") {
      const fresh = makePassword(wanted.role);
      await prisma.account.updateMany({
        where: { userId: existing.id, providerId: "credential" },
        data: { password: await context.password.hash(fresh) },
      });
      await prisma.session.deleteMany({ where: { userId: existing.id } });
      passwords.set(wanted.email, fresh);
      created += 1;
      console.log(`reset    ${wanted.email}`);
      continue;
    }
    if (existing) {
      console.log(`exists   ${wanted.email}`);
      continue;
    }
    const password = makePassword(wanted.role);
    await auth.api.signUpEmail({
      body: { name: wanted.name, email: wanted.email, password },
    });
    await prisma.user.update({
      where: { email: wanted.email },
      data: { role: wanted.role, emailVerified: true },
    });
    passwords.set(wanted.email, password);
    created += 1;
    console.log(`created  ${wanted.email}  (${wanted.role})`);
  }

  if (created > 0) {
    const lines = [
      "CoreChain pilot accounts. PRIVATE: git ignores this file. Send each person only their own line.",
      "Passwords are shown here once; the database only stores a scrambled copy.",
      "",
      ...WANTED.filter((w) => passwords.has(w.email)).map(
        (w) => `${w.email.padEnd(30)} password: ${passwords.get(w.email)}   (${w.role}, ${w.name})`,
      ),
      "",
    ];
    writeFileSync(OUTPUT, lines.join("\n"));
    console.log(`\nPasswords written to ${OUTPUT}`);
  } else {
    console.log("\nNothing to create.");
  }
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
