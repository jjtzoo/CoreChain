import { PrismaClient } from "@prisma/client";

// One client per server process. In `next dev` the module is reloaded on every
// edit, so the client is kept on globalThis to avoid opening a new connection
// pool each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
