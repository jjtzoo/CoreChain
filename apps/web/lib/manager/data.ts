import "server-only";

import { QAQC_STAGE_LABELS, recoveryPercent, type QaqcStage } from "@corechain/domain";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  dispatchState,
  drilledDepthM,
  formatShortDay,
  handoverStart,
  isHeldOrRejected,
  standingDecisions,
  wholeDaysBetween,
} from "./stats";
import type {
  ActivityRow,
  AttentionRow,
  DecisionRow,
  DeviceRow,
  DispatchRow,
  HoleRow,
  MemberRow,
  ProjectCardData,
} from "./types";

// What the project manager's pages load. Everything is limited to the
// manager's own team (organization); a manager with no team sees nothing.

// Same thresholds as the Activity page (app/team/activity/page.tsx): a hole
// still being worked with no new evidence in a week is worth a look, while a
// quiet phone alone is normal for weeks in this offline-first app.
export const HOLE_STALE_AFTER_DAYS = 7;
export const DEVICE_STALE_AFTER_DAYS = 21;
const ACTIVE_STATUSES = new Set(["planned", "drilling"]);
const NO_LONGER_ON_TEAM = "Someone no longer on the team";

export type ManagerTeam = { organizationId: string; name: string };

/** The manager's team, or null when they haven't been put on one. */
export async function managerTeam(userId: string): Promise<ManagerTeam | null> {
  const self = await prisma.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, organization: { select: { name: true } } },
  });
  if (!self?.organizationId) return null;
  return { organizationId: self.organizationId, name: self.organization?.name ?? "Your team" };
}

export async function loadMembers(organizationId: string): Promise<MemberRow[]> {
  return prisma.user.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, title: true },
  });
}

export async function loadDevices(
  organizationId: string,
  members: readonly MemberRow[],
): Promise<DeviceRow[]> {
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const devices = await prisma.device.findMany({
    where: { organizationId, revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, name: true, userId: true, lastSeenAt: true },
  });
  return devices.map((d) => ({
    id: d.id,
    name: d.name,
    userId: d.userId,
    ownerName: nameById.get(d.userId) ?? NO_LONGER_ON_TEAM,
    lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
  }));
}

/** Every hole in the team (or one project) with what was recorded on it. */
export async function loadHoles(organizationId: string, projectId?: string) {
  return prisma.drillhole.findMany({
    where: { organizationId, deletedAt: null, ...(projectId ? { projectId } : {}) },
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
        select: {
          id: true,
          sampleNumber: true,
          sampleType: true,
          status: true,
          createdBy: true,
          createdAt: true,
        },
      },
    },
  });
}

export type LoadedHole = Awaited<ReturnType<typeof loadHoles>>[number];

/** Primary and control sample ids that have at least one laboratory result. */
export async function loadSampleIdsWithResults(
  organizationId: string,
  projectId?: string,
): Promise<Set<string>> {
  const rows = await prisma.assayResult.findMany({
    where: { organizationId, ...(projectId ? { sample: { projectId } } : {}) },
    distinct: ["sampleId"],
    select: { sampleId: true },
  });
  return new Set(rows.map((r) => r.sampleId));
}

/** The standing QA/QC decisions (newest per hole and stage), with names. */
export async function loadDecisionRows(
  organizationId: string,
  members: readonly MemberRow[],
  projectId?: string,
): Promise<DecisionRow[]> {
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const decisions = await prisma.qaqcReviewDecision.findMany({
    where: {
      organizationId,
      drillhole: { deletedAt: null, ...(projectId ? { projectId } : {}) },
    },
    select: {
      id: true,
      drillholeId: true,
      decision: true,
      note: true,
      decidedBy: true,
      decidedAt: true,
      stage: true,
      drillhole: {
        select: { holeId: true, projectId: true, project: { select: { name: true } } },
      },
    },
  });
  return standingDecisions(decisions).map((d) => ({
    id: d.id,
    drillholeId: d.drillholeId,
    holeId: d.drillhole.holeId,
    projectId: d.drillhole.projectId,
    projectName: d.drillhole.project.name,
    stageLabel: d.stage ? (QAQC_STAGE_LABELS[d.stage as QaqcStage] ?? d.stage) : "QA/QC",
    decision: d.decision,
    note: d.note,
    decidedBy: nameById.get(d.decidedBy) ?? NO_LONGER_ON_TEAM,
    decidedDay: formatShortDay(d.decidedAt),
    decidedAt: d.decidedAt,
  }));
}

export async function loadDispatchRows(
  organizationId: string,
  now: Date,
  projectId?: string,
): Promise<DispatchRow[]> {
  const dispatches = await prisma.dispatch.findMany({
    where: { organizationId, deletedAt: null, ...(projectId ? { projectId } : {}) },
    select: {
      id: true,
      dispatchNumber: true,
      laboratory: true,
      projectId: true,
      status: true,
      handoverAt: true,
      createdAt: true,
      resultsReturnedAt: true,
      project: { select: { name: true } },
      _count: { select: { samples: { where: { deletedAt: null } } } },
    },
  });
  return dispatches.map((d) => ({
    id: d.id,
    dispatchNumber: d.dispatchNumber,
    laboratory: d.laboratory,
    projectId: d.projectId,
    projectName: d.project.name,
    sampleCount: d._count.samples,
    handoverDay: d.handoverAt || d.status === "dispatched" ? formatShortDay(handoverStart(d)) : null,
    returnedDay: d.resultsReturnedAt ? formatShortDay(d.resultsReturnedAt) : null,
    returnedAt: d.resultsReturnedAt,
    state: dispatchState(d, now),
  }));
}

const DECISION_SEVERITY: Record<string, number> = { reject: 3, hold: 2, accept: 1 };

/** Hole rows for the hole board, plus the hole-level "Needs attention" lines. */
export function toHoleRows(
  holes: readonly LoadedHole[],
  members: readonly MemberRow[],
  decisions: readonly DecisionRow[],
  now: Date,
): HoleRow[] {
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  const worstDecision = new Map<string, string>();
  for (const d of decisions) {
    const current = worstDecision.get(d.drillholeId);
    if (!current || (DECISION_SEVERITY[d.decision] ?? 0) > (DECISION_SEVERITY[current] ?? 0)) {
      worstDecision.set(d.drillholeId, d.decision);
    }
  }

  return holes.map((hole) => {
    const loggedM = hole.intervals.reduce((max, i) => Math.max(max, i.toM), 0);
    const recoveries = hole.runs
      .map((run) => recoveryPercent(run.toM - run.fromM, run.recoveredM))
      .filter((pct): pct is number => pct !== null);
    const avgRecoveryPercent =
      recoveries.length > 0
        ? Math.round(recoveries.reduce((sum, p) => sum + p, 0) / recoveries.length)
        : null;

    const loggerIds = new Set([
      ...hole.intervals.map((i) => i.createdBy),
      ...hole.runs.map((r) => r.createdBy),
      ...hole.samples.map((s) => s.createdBy),
    ]);
    const loggedByNames = [...loggerIds].map((id) => nameById.get(id) ?? NO_LONGER_ON_TEAM).sort();

    const decision = worstDecision.get(hole.id) ?? null;
    let attention: string | null = null;
    if (decision === "reject") attention = "Rejected at QA/QC";
    else if (decision === "hold") attention = "Held at QA/QC";
    else if (ACTIVE_STATUSES.has(hole.status)) {
      const last = lastActivityAt(hole);
      if (!last) attention = hole.status === "drilling" ? "No logging recorded yet" : null;
      else if (wholeDaysBetween(last, now) > HOLE_STALE_AFTER_DAYS) {
        attention = `No new logging for ${wholeDaysBetween(last, now)} days`;
      }
    }

    return {
      id: hole.id,
      holeId: hole.holeId,
      projectId: hole.projectId,
      projectName: hole.project.name,
      status: hole.status,
      plannedDepthM: hole.plannedDepthM,
      drilledM: drilledDepthM(hole),
      loggedM,
      avgRecoveryPercent,
      waitingToBag: hole.samples.filter((s) => s.status === "created").length,
      waitingToDispatch: hole.samples.filter((s) => s.status === "bagged").length,
      sampleCount: hole.samples.length,
      loggedByNames,
      assignedToUserId: hole.assignment?.userId ?? null,
      priority: hole.priority,
      priorityNote: hole.priorityNote,
      updatedAt: hole.updatedAt.toISOString(),
      qaqcDecision: decision,
      hasCollar: hole.collarLatitude != null && hole.collarLongitude != null,
      attention,
    };
  });
}

function lastActivityAt(hole: LoadedHole): Date | null {
  return [
    ...hole.intervals.map((i) => i.createdAt),
    ...hole.runs.map((r) => r.createdAt),
    ...hole.samples.map((s) => s.createdAt),
  ].reduce<Date | null>((latest, at) => (!latest || at > latest ? at : latest), null);
}

function formatSince(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

/**
 * The team's "Needs attention" list, most serious first: QA/QC rejections and
 * holds, results overdue at the laboratory, urgent holes, quiet holes, active
 * holes with no geologist, and phones quiet longer than expected.
 */
export function teamAttention({
  holes,
  decisions,
  dispatches,
  devices,
  now,
}: {
  holes: readonly HoleRow[];
  decisions: readonly DecisionRow[];
  dispatches: readonly DispatchRow[];
  devices: readonly DeviceRow[];
  now: Date;
}): AttentionRow[] {
  const rows: AttentionRow[] = [];

  for (const d of decisions.filter(isHeldOrRejected)) {
    rows.push({
      id: `decision:${d.id}`,
      title: `${d.holeId} ${d.decision === "reject" ? "rejected" : "held"} at QA/QC (${d.stageLabel})`,
      detail: d.note?.trim() || `Decided by ${d.decidedBy} on ${d.decidedDay}.`,
      href: `/team/holes/${d.drillholeId}`,
      severity: d.decision === "reject" ? "danger" : "warn",
    });
  }

  for (const d of dispatches) {
    if (d.state.kind === "waiting" && d.state.overdue) {
      rows.push({
        id: `dispatch:${d.id}`,
        title: `Dispatch ${d.dispatchNumber} has been at the laboratory ${d.state.days} days`,
        detail: `${d.sampleCount} samples, ${d.projectName}, ${d.laboratory}.`,
        href: `/team/projects/${d.projectId}/lab`,
        severity: "warn",
      });
    }
  }

  for (const hole of holes) {
    if (hole.priority === "urgent") {
      rows.push({
        id: `urgent:${hole.id}`,
        title: `${hole.holeId} is marked urgent`,
        detail: hole.priorityNote?.trim() || `${hole.projectName}.`,
        href: `/team/holes/${hole.id}`,
        severity: "warn",
      });
    }
    if (hole.attention && hole.qaqcDecision !== "reject" && hole.qaqcDecision !== "hold") {
      rows.push({
        id: `quiet:${hole.id}`,
        title: `${hole.holeId}: ${hole.attention.toLowerCase()}`,
        detail: `${hole.projectName}, ${hole.status}.`,
        href: `/team/holes/${hole.id}`,
        severity: "warn",
      });
    }
    if (hole.status === "drilling" && !hole.assignedToUserId) {
      rows.push({
        id: `unassigned:${hole.id}`,
        title: `${hole.holeId} is drilling with no geologist assigned`,
        detail: `${hole.projectName}.`,
        href: `/team/holes?hole=${hole.id}`,
        severity: "warn",
      });
    }
  }

  for (const device of devices) {
    const days = device.lastSeenAt ? wholeDaysBetween(new Date(device.lastSeenAt), now) : null;
    if (days === null || days > DEVICE_STALE_AFTER_DAYS) {
      rows.push({
        id: `device:${device.id}`,
        title: `${device.name} (${device.ownerName})`,
        detail: days === null ? "Never synced." : `Last synced ${formatSince(days)}.`,
        href: "/team/people",
        severity: "warn",
      });
    }
  }

  return rows.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "danger" ? -1 : 1));
}

/** The latest few things recorded on the team's holes, newest first. */
export function recentActivity(
  holes: readonly LoadedHole[],
  members: readonly MemberRow[],
  now: Date,
  limit: number,
): ActivityRow[] {
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const name = (id: string) => nameById.get(id) ?? NO_LONGER_ON_TEAM;
  const entries: { at: Date; byName: string; summary: string }[] = [];
  for (const hole of holes) {
    for (const i of hole.intervals) {
      entries.push({ at: i.createdAt, byName: name(i.createdBy), summary: `logged ${i.fromM}–${i.toM} m on ${hole.holeId}` });
    }
    for (const r of hole.runs) {
      entries.push({ at: r.createdAt, byName: name(r.createdBy), summary: `recorded run ${r.fromM}–${r.toM} m on ${hole.holeId}` });
    }
    for (const s of hole.samples) {
      entries.push({ at: s.createdAt, byName: name(s.createdBy), summary: `took sample ${s.sampleNumber} on ${hole.holeId}` });
    }
  }
  entries.sort((a, b) => b.at.getTime() - a.at.getTime());
  return entries.slice(0, limit).map((e, i) => ({
    id: `${e.at.toISOString()}:${i}`,
    byName: e.byName,
    summary: e.summary,
    when: formatWhen(e.at, now),
  }));
}

function formatWhen(at: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return formatShortDay(at);
}

/** One card's figures per project, from holes already loaded for the team. */
export async function loadProjectCards(
  organizationId: string,
  holes: readonly LoadedHole[],
  withResults: ReadonlySet<string>,
): Promise<ProjectCardData[]> {
  const projects = await prisma.project.findMany({
    where: { organizationId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, commodity: true, location: true },
  });
  return projects.map((project) => {
    const own = holes.filter((h) => h.projectId === project.id);
    const statusCounts: Record<string, number> = {};
    for (const h of own) statusCounts[h.status] = (statusCounts[h.status] ?? 0) + 1;
    const primary = own.flatMap((h) => h.samples.filter((s) => s.sampleType === "primary"));
    return {
      ...project,
      holeCount: own.length,
      statusCounts,
      plannedM: own.reduce((sum, h) => sum + h.plannedDepthM, 0),
      drilledM: own.reduce((sum, h) => sum + drilledDepthM(h), 0),
      resultsBack: primary.filter((s) => withResults.has(s.id)).length,
      waitingForResults: primary.filter((s) => !withResults.has(s.id) && s.status === "dispatched").length,
      hasCollars: own.some((h) => h.collarLatitude != null && h.collarLongitude != null),
    };
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One of the manager's own team's projects, or null for anything else (another
 * team's project, a deleted one, an id that isn't a UUID). Cached per request,
 * so the project layout and its tab share one lookup.
 */
export const managedProject = cache(async (userId: string, projectId: string) => {
  if (!UUID.test(projectId)) return null;
  const team = await managerTeam(userId);
  if (!team) return null;
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: team.organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      commodity: true,
      location: true,
      coordinateSystem: true,
      samplePrefix: true,
      qcStandardEveryN: true,
      qcBlankEveryN: true,
      qcDuplicateEveryN: true,
      createdAt: true,
    },
  });
  return project ? { ...project, organizationId: team.organizationId } : null;
});
