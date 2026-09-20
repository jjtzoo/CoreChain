import { suggestPassphrase } from "@corechain/domain";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { UsersWorkspace, type UserRow } from "./users-workspace";

export default async function UsersPage() {
  const session = await requireAdmin();

  const [users, activity] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        banned: true,
        createdAt: true,
      },
    }),
    prisma.session.groupBy({ by: ["userId"], _max: { updatedAt: true } }),
  ]);
  const lastActive = new Map(
    activity.map((row) => [row.userId, row._max.updatedAt]),
  );

  const rows: UserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    switchedOff: user.banned === true,
    createdAt: user.createdAt.toISOString(),
    lastActiveAt: lastActive.get(user.id)?.toISOString() ?? null,
  }));

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1>Users</h1>
          <p>
            Create accounts for your testers and choose what each person can do.
            There is no public sign-up: nobody can join unless you add them
            here.
          </p>
        </div>
      </div>
      <UsersWorkspace
        users={rows}
        currentUserId={session.user.id}
        initialSuggestion={suggestPassphrase(randomInt)}
      />
    </>
  );
}
