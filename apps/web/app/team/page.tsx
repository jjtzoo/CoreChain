import { recoveryPercent } from "@corechain/domain";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/session";
import {
  TeamWorkspace,
  type DeviceRow,
  type HoleRow,
  type MemberRow,
} from "./team-workspace";

export default async function TeamPage() {
  const session = await requireProjectManager();

  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? null;

  if (!organizationId) {
    return (
      <>
        <div className="admin-page-header">
          <div>
            <h1>Team overview</h1>
            <p>You aren&apos;t on a team yet. Ask an admin to add you to one.</p>
          </div>
        </div>
      </>
    );
  }

  const [organization, members, holes, devices] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.user.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, title: true },
    }),
    prisma.drillhole.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        project: { select: { name: true } },
        assignment: { select: { userId: true } },
        intervals: {
          where: { deletedAt: null },
          select: { toM: true, createdBy: true },
        },
        runs: {
          where: { deletedAt: null },
          select: { fromM: true, toM: true, recoveredM: true, createdBy: true },
        },
        samples: {
          where: { deletedAt: null },
          select: { status: true, createdBy: true },
        },
      },
    }),
    prisma.device.findMany({
      where: { organizationId, revokedAt: null },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, name: true, userId: true, lastSeenAt: true },
    }),
  ]);

  const memberRows: MemberRow[] = members.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    title: member.title,
  }));
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  const holeRows: HoleRow[] = holes.map((hole) => {
    const loggedM = hole.intervals.reduce(
      (max, interval) => Math.max(max, interval.toM),
      0,
    );

    const recoveries = hole.runs
      .map((run) => recoveryPercent(run.toM - run.fromM, run.recoveredM))
      .filter((pct): pct is number => pct !== null);
    const avgRecoveryPercent =
      recoveries.length > 0
        ? Math.round(recoveries.reduce((sum, p) => sum + p, 0) / recoveries.length)
        : null;

    const waitingToBag = hole.samples.filter((s) => s.status === "created").length;
    const waitingToDispatch = hole.samples.filter((s) => s.status === "bagged").length;

    const loggerIds = new Set([
      ...hole.intervals.map((i) => i.createdBy),
      ...hole.runs.map((r) => r.createdBy),
      ...hole.samples.map((s) => s.createdBy),
    ]);
    const loggedByNames = [...loggerIds]
      .map((id) => nameById.get(id) ?? "Someone no longer on the team")
      .sort();

    return {
      id: hole.id,
      holeId: hole.holeId,
      projectName: hole.project.name,
      status: hole.status,
      plannedDepthM: hole.plannedDepthM,
      loggedM,
      avgRecoveryPercent,
      waitingToBag,
      waitingToDispatch,
      loggedByNames,
      assignedToUserId: hole.assignment?.userId ?? null,
      priority: hole.priority,
      priorityNote: hole.priorityNote,
      updatedAt: hole.updatedAt.toISOString(),
    };
  });

  const totalPlannedM = holeRows.reduce((sum, h) => sum + h.plannedDepthM, 0);
  const totalLoggedM = holeRows.reduce((sum, h) => sum + h.loggedM, 0);

  const deviceRows: DeviceRow[] = devices.map((device) => ({
    id: device.id,
    name: device.name,
    ownerName: nameById.get(device.userId) ?? "Someone no longer on the team",
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
  }));

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1>Team overview</h1>
          <p>
            {organization?.name ?? "Your team"} · {holeRows.length} holes ·{" "}
            {memberRows.length} people ·{" "}
            <Link href="/team/activity" className="admin-link">
              Activity
            </Link>
          </p>
        </div>
      </div>
      <TeamWorkspace
        holes={holeRows}
        members={memberRows}
        devices={deviceRows}
        totalPlannedM={totalPlannedM}
        totalLoggedM={totalLoggedM}
      />
    </>
  );
}
