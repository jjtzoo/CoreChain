import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { nextCookies } from "better-auth/next-js";
import { admin, jwt } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import { DEFAULT_ROLE, OFFLINE_SESSION_DAYS } from "@corechain/domain";
import { prisma } from "./prisma";
import { POWERSYNC_AUDIENCE, POWERSYNC_TOKEN_LIFETIME } from "./powersync";

// Sign-in for CoreChain (E1-3). Decision D13: during the pilot the owner
// creates every account, so open sign-up is off. The account script and the
// admin screen create users through the admin plugin; the only thing that
// turns sign-up on is the environment variable below, set by the seed script.
//
// Roles (packages/domain/src/roles.ts): admin, project_manager, geologist.
// Only admin may create users or change tiers. The other two tiers carry no
// extra server rights yet.
const ac = createAccessControl(defaultStatements);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  // A phone signs in once and may then work for weeks with no signal (E1-4), so
  // the server must still recognise it after that long. The app enforces the
  // same 30 days on its side.
  session: {
    expiresIn: OFFLINE_SESSION_DAYS * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.CORECHAIN_ALLOW_SIGN_UP !== "true",
    minPasswordLength: 10,
  },
  plugins: [
    admin({
      ac,
      roles: {
        admin: ac.newRole({ ...adminAc.statements }),
        project_manager: ac.newRole({}),
        geologist: ac.newRole({}),
      },
      defaultRole: DEFAULT_ROLE,
      adminRoles: ["admin"],
    }),
    // A signed-in phone asks /api/auth/token for a short-lived JWT and hands it
    // to PowerSync, which checks it against /api/auth/jwks. The token's `sub`
    // is the user's id, the same value the sync streams compare against
    // (`auth.user_id()`), so nothing else about the person is put in it.
    jwt({
      jwt: {
        audience: POWERSYNC_AUDIENCE,
        expirationTime: POWERSYNC_TOKEN_LIFETIME,
        definePayload: ({ user }) => ({ role: user.role ?? DEFAULT_ROLE }),
      },
    }),
    // Lets the web pages sign in and out from server actions (must stay last).
    nextCookies(),
  ],
});
