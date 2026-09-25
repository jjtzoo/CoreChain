// Runs before every web build (the "prebuild" script). On Vercel's production
// build it stops the deploy when a setting the live site can't work without is
// missing, so the previous deployment stays up instead of a broken one going
// live. Elsewhere (a laptop, CI) it only warns. It never prints a value.

const production = process.env.VERCEL_ENV === "production";

const required = [
  ["DATABASE_URL", "the Neon database connection (pooled)"],
  ["BETTER_AUTH_SECRET", "the sign-in secret"],
];

const missing = required.filter(([name]) => !process.env[name]?.trim());
for (const [name, what] of missing) {
  console[production ? "error" : "warn"](
    `${production ? "Missing" : "Not set (fine outside production)"}: ${name}, ${what}.`,
  );
}

const secret = process.env.BETTER_AUTH_SECRET?.trim() ?? "";
if (secret && secret.length < 32) {
  console.warn("BETTER_AUTH_SECRET is shorter than 32 characters; a longer random value is safer.");
}

if (production && missing.length > 0) {
  console.error(
    "Production build stopped. Add the settings above in Vercel: Project, Settings, Environment Variables.",
  );
  process.exit(1);
}
