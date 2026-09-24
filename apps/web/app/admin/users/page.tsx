import { suggestPassphrase } from "@corechain/domain";
import { randomInt } from "node:crypto";
import { DEMO_PROJECT_NAMES } from "@/lib/demo/demoProjects";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { UsersWorkspace, type UserRow } from "./users-workspace";

// Adding the demo projects writes about two thousand rows in one transaction.
export const maxDuration = 60;

export default async function UsersPage() {
  const session = await requireAdmin();

  const [users, activity, requestRows, teams, demoProjects] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        title: true,
        banned: true,
        createdAt: true,
        organizationId: true,
        qaqcStage: true,
      },
    }),
    prisma.session.groupBy({ by: ["userId"], _max: { updatedAt: true } }),
    prisma.accessRequest.findMany({
      where: { status: "new" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.organization.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.project.findMany({
      where: { name: { in: [...DEMO_PROJECT_NAMES] }, deletedAt: null },
      select: { organizationId: true },
    }),
  ]);
  const demoCounts = new Map<string, number>();
  for (const p of demoProjects) {
    demoCounts.set(p.organizationId, (demoCounts.get(p.organizationId) ?? 0) + 1);
  }
  const lastActive = new Map(
    activity.map((row) => [row.userId, row._max.updatedAt]),
  );

  const rows: UserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    title: user.title,
    switchedOff: user.banned === true,
    createdAt: user.createdAt.toISOString(),
    lastActiveAt: lastActive.get(user.id)?.toISOString() ?? null,
    organizationId: user.organizationId,
    qaqcStage: user.qaqcStage,
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
        teams={teams.map((team) => ({
          id: team.id,
          name: team.name,
          demoProjects: demoCounts.get(team.id) ?? 0,
        }))}
        currentUserId={session.user.id}
        hasTester={rows.some((user) => user.id !== session.user.id)}
        requests={requestRows.map((request) => ({
          id: request.id,
          name: request.name,
          company: request.company,
          email: request.email,
          createdAt: request.createdAt.toISOString(),
        }))}
        initialSuggestion={suggestPassphrase(randomInt)}
      />
    </>
  );
}
