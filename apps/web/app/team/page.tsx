import { recoveryPercent } from "@corechain/domain";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/session";
import {
  TeamWorkspace,
  type ActivityRow,
  type AttentionRow,
  type DeviceRow,
  type DispatchSummary,
  type HoleRow,
  type MemberRow,
} from "./team-workspace";

// Same thresholds the Activity page uses (app/team/activity/page.tsx): a
// hole still being worked with no new evidence in a week is worth a look,
// while a quiet phone alone is normal for weeks in this offline-first app.
const HOLE_STALE_AFTER_DAYS = 7;
const DEVICE_STALE_AFTER_DAYS = 21;
const ACTIVE_STATUSES = new Set(["planned", "drilling"]);

function daysSince(at: Date, now: Date): number {
  return Math.floor((now.getTime() - at.getTime()) / 86_400_000);
}

function formatSince(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

// Same style as the Activity page's feed (app/team/activity/page.tsx),
// shortened here to a handful of the most recent items for a preview card.
function formatWhen(at: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return at.toISOString().slice(0, 10);
}

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

  const [organization, members, holes, devices, dispatches, qaqcDecisions] =
    await Promise.all([
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
            select: { fromM: true, toM: true, createdBy: true, createdAt: true },
          },
          runs: {
            where: { deletedAt: null },
            select: { fromM: true, toM: true, recoveredM: true, createdBy: true, createdAt: true },
          },
          samples: {
            where: { deletedAt: null },
            select: { sampleNumber: true, status: true, createdBy: true, createdAt: true },
          },
        },
      }),
      prisma.device.findMany({
        where: { organizationId, revokedAt: null },
        orderBy: { lastSeenAt: "desc" },
        select: { id: true, name: true, userId: true, lastSeenAt: true },
      }),
      prisma.dispatch.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, resultsReturnedAt: true },
      }),
      // Lab & QA/QC rollup: only the latest decision per hole matters for the
      // manager's summary, so the full history stays on the QA/QC screen.
      prisma.qaqcReviewDecision.findMany({
        where: { organizationId },
        orderBy: { decidedAt: "desc" },
        select: { drillholeId: true, decision: true },
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

  const latestQaqcDecisionByHole = new Map<string, string>();
  for (const decision of qaqcDecisions) {
    if (!latestQaqcDecisionByHole.has(decision.drillholeId)) {
      latestQaqcDecisionByHole.set(decision.drillholeId, decision.decision);
    }
  }

  const now = new Date();
  const attentionRows: AttentionRow[] = [];
  const feedEntries: { at: Date; byName: string; summary: string }[] = [];

  const holeRows: HoleRow[] = holes.map((hole) => {
    for (const interval of hole.intervals) {
      feedEntries.push({
        at: interval.createdAt,
        byName: nameById.get(interval.createdBy) ?? "Someone no longer on the team",
        summary: `logged ${interval.fromM}–${interval.toM} m on ${hole.holeId}`,
      });
    }
    for (const run of hole.runs) {
      feedEntries.push({
        at: run.createdAt,
        byName: nameById.get(run.createdBy) ?? "Someone no longer on the team",
        summary: `recorded run ${run.fromM}–${run.toM} m on ${hole.holeId}`,
      });
    }
    for (const sample of hole.samples) {
      feedEntries.push({
        at: sample.createdAt,
        byName: nameById.get(sample.createdBy) ?? "Someone no longer on the team",
        summary: `took sample ${sample.sampleNumber} on ${hole.holeId}`,
      });
    }
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

    const lastActivityAt = [
      ...hole.intervals.map((i) => i.createdAt),
      ...hole.runs.map((r) => r.createdAt),
      ...hole.samples.map((s) => s.createdAt),
    ].reduce<Date | null>((latest, at) => (!latest || at > latest ? at : latest), null);

    if (ACTIVE_STATUSES.has(hole.status)) {
      const stale = !lastActivityAt || daysSince(lastActivityAt, now) > HOLE_STALE_AFTER_DAYS;
      if (stale) {
        attentionRows.push({
          id: hole.id,
          title: hole.holeId,
          detail: lastActivityAt
            ? `No new logging since ${formatSince(daysSince(lastActivityAt, now))}`
            : "No logging recorded yet",
        });
      }
    }

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
      qaqcDecision: latestQaqcDecisionByHole.get(hole.id) ?? null,
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

  for (const device of devices) {
    const stale = !device.lastSeenAt || daysSince(device.lastSeenAt, now) > DEVICE_STALE_AFTER_DAYS;
    if (stale) {
      attentionRows.push({
        id: `device:${device.id}`,
        title: device.name,
        detail: device.lastSeenAt
          ? `Synced ${formatSince(daysSince(device.lastSeenAt, now))}`
          : "Never synced",
      });
    }
  }

  const dispatchSummary: DispatchSummary = {
    count: dispatches.length,
    pendingResultsCount: dispatches.filter((d) => !d.resultsReturnedAt).length,
  };

  feedEntries.sort((a, b) => b.at.getTime() - a.at.getTime());
  const activityRows: ActivityRow[] = feedEntries.slice(0, 6).map((entry, i) => ({
    id: `${entry.at.toISOString()}:${i}`,
    byName: entry.byName,
    summary: entry.summary,
    when: formatWhen(entry.at, now),
  }));

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1>Welcome back, {session.user.name.split(" ")[0]}</h1>
          <p>
            {organization?.name ?? "Your team"} · {holeRows.length} holes ·{" "}
            {memberRows.length} people ·{" "}
            <Link href="/team/activity" className="admin-link">
              Activity
            </Link>{" "}
            ·{" "}
            <Link href="/team/codes" className="admin-link">
              Code library
            </Link>{" "}
            ·{" "}
            <Link href="/team/tags" className="admin-link">
              Print tags
            </Link>{" "}
            ·{" "}
            <Link href="/team/samples" className="admin-link">
              Find a sample
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
        dispatches={dispatchSummary}
        qaqcDecidedCount={latestQaqcDecisionByHole.size}
        qaqcHeldOrRejectedCount={
          [...latestQaqcDecisionByHole.values()].filter((d) => d !== "accept").length
        }
        attention={attentionRows}
        activity={activityRows}
      />
    </>
  );
}
