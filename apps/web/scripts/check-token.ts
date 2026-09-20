// Checks the whole token path against a running site, the way PowerSync will:
// sign in as a tester, ask for a PowerSync token, then verify it against the
// site's public keys (JWKS), audience and expiry.
//
//   npm run auth:check-token -- https://corechain-orpin.vercel.app
//
// Uses geologist1's password from tester-accounts.private.txt and never prints
// the password or the token.

import { readFileSync } from "node:fs";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { POWERSYNC_AUDIENCE } from "../lib/powersync";

async function main() {
  const site = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
  const email = "geologist1@corechain.test";
  const line = readFileSync("tester-accounts.private.txt", "utf8")
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${email} `));
  const password = line?.match(/password:\s+(\S+)/)?.[1];
  if (!password) throw new Error(`No password for ${email} in tester-accounts.private.txt`);

  const signIn = await fetch(`${site}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: site },
    body: JSON.stringify({ email, password }),
  });
  if (!signIn.ok) throw new Error(`sign-in failed: ${signIn.status}`);
  const cookies = signIn.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const { user } = (await signIn.json()) as { user: { id: string } };
  console.log("sign-in:          ok");

  const tokenRes = await fetch(`${site}/api/auth/token`, { headers: { Cookie: cookies, Origin: site } });
  if (!tokenRes.ok) throw new Error(`token request failed: ${tokenRes.status} ${(await tokenRes.text()).slice(0, 200)}`);
  const { token } = (await tokenRes.json()) as { token: string };
  console.log("token issued:     ok");

  const jwks = createRemoteJWKSet(new URL(`${site}/api/auth/jwks`));
  const { payload, protectedHeader } = await jwtVerify(token, jwks, { audience: POWERSYNC_AUDIENCE });
  const lifetime = (payload.exp ?? 0) - (payload.iat ?? 0);
  console.log("signature (JWKS): ok, alg", protectedHeader.alg, "kid present:", Boolean(protectedHeader.kid));
  console.log("audience:         ", payload.aud);
  console.log("lifetime:         ", lifetime / 60, "minutes");
  console.log("sub is user id:   ", payload.sub === user.id);
  console.log("claims:           ", Object.keys(payload).sort().join(", "));
}

main().catch((error) => {
  console.error("FAILED:", String(error).slice(0, 300));
  process.exit(1);
});
