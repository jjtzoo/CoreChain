import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";
import { DEFAULT_ROLE } from "@corechain/domain";
import { prisma } from "./prisma";

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
  ],
});
