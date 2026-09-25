import {
  exceptionKindFromKey,
  openExceptions,
  QAQC_EXCEPTION_KIND_LABELS,
  QAQC_STAGE_LABELS,
  type QaqcDecision,
  type QaqcException,
  type QaqcStage,
} from "@corechain/domain";
import type { Route } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  computeDeviceExceptions,
  computeStageExceptions,
  loadStageHoles,
} from "@/lib/qaqc/stage-exceptions";
import { requireQaqc } from "@/lib/session";
import {
  QaqcWorkspace,
  type DeviceExceptionRow,
  type QaqcHoleRow,
} from "./qaqc-workspace";

/** The exception summaries saved with a decision, or null for a decision made before they were kept. */
function openAtDecision(evidence: unknown): string[] | null {
  if (!Array.isArray(evidence)) return null;
  return evidence.flatMap((item) =>
    item && typeof item === "object" && typeof (item as { summary?: unknown }).summary === "string"
      ? [(item as { summary: string }).summary]
      : [],
  );
}

export default async function QaqcPage() {
  const session = await requireQaqc();

  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true, qaqcStage: true },
  });
  const organizationId = self?.organizationId ?? null;
  const stage = self?.qaqcStage as QaqcStage | null;

  if (!organizationId) {
    return (
      <div className="admin-page-header">
        <div>
          <h1>QA/QC</h1>
          <p>You aren&apos;t on a team yet. Ask an admin to add you to one.</p>
        </div>
      </div>
    );
  }
  if (!stage) {
    return (
      <div className="admin-page-header">
        <div>
          <h1>QA/QC</h1>
          <p>
            No stage of the chain is set for your account yet. Ask an admin
            to choose one on the Users page.
          </p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const [members, holes, resolutions, decisions] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
    loadStageHoles(organizationId),
    prisma.qaqcExceptionResolution.findMany({ where: { organizationId } }),
    prisma.qaqcReviewDecision.findMany({
      where: { organizationId },
      orderBy: { decidedAt: "desc" },
    }),
  ]);
  const [rawExceptions, rawDeviceExceptions] = await Promise.all([
    computeStageExceptions(organizationId, stage, holes, now),
    computeDeviceExceptions(organizationId, now),
  ]);
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  const resolvedKeys = new Set(resolutions.map((r) => r.exceptionKey));
  const open = openExceptions(rawExceptions, { resolvedKeys });
  const deviceExceptions = openExceptions(rawDeviceExceptions, {
    resolvedKeys,
  });

  // E12-5: a resolution's evidence is looked up from the current computation
  // when the same condition still recomputes. When it no longer does (the
  // data, or a certified value, has since changed), the resolution is still
  // shown, never hidden, with the summary and evidence saved when it was
  // resolved. Resolutions made before that copy was kept show only the kind
  // of exception it was.
  const exceptionByKey = new Map<string, QaqcException>(
    [...rawExceptions, ...rawDeviceExceptions].map((e) => [e.key, e]),
  );

  type ResolvedRow = {
    key: string;
    summary: string;
    evidence: string | null;
    reason: string;
    resolvedByName: string;
    resolvedAt: string;
  };
  const resolvedByHole = new Map<string, ResolvedRow[]>();
  const resolvedOther: ResolvedRow[] = [];
  for (const resolution of resolutions) {
    const matched = exceptionByKey.get(resolution.exceptionKey);
    const row: ResolvedRow = {
      key: resolution.exceptionKey,
      summary:
        matched?.summary ??
        resolution.summary ??
        (() => {
          const kind = exceptionKindFromKey(resolution.exceptionKey);
          return kind ? QAQC_EXCEPTION_KIND_LABELS[kind] : "Exception";
        })(),
      evidence: matched?.evidence ?? resolution.evidence ?? null,
      reason: resolution.reason,
      resolvedByName:
        nameById.get(resolution.resolvedBy) ?? "Someone no longer on the team",
      resolvedAt: resolution.resolvedAt.toISOString(),
    };
    const drillholeId = matched?.drillholeId || resolution.drillholeId;
    if (drillholeId) {
      const list = resolvedByHole.get(drillholeId) ?? [];
      list.push(row);
      resolvedByHole.set(drillholeId, list);
    } else {
      resolvedOther.push(row);
    }
  }

  const exceptionsByHole = new Map<string, typeof open>();
  for (const exception of open) {
    const list = exceptionsByHole.get(exception.drillholeId) ?? [];
    list.push(exception);
    exceptionsByHole.set(exception.drillholeId, list);
  }

  const decisionsByHole = new Map<string, typeof decisions>();
  for (const decision of decisions) {
    const list = decisionsByHole.get(decision.drillholeId) ?? [];
    list.push(decision);
    decisionsByHole.set(decision.drillholeId, list);
  }

  const holeRows: QaqcHoleRow[] = holes
    .map((hole) => {
      const holeDecisions = decisionsByHole.get(hole.id) ?? [];
      return {
        id: hole.id,
        holeId: hole.holeId,
        projectName: hole.project.name,
        exceptions: (exceptionsByHole.get(hole.id) ?? []).map((e) => ({
          key: e.key,
          summary: e.summary,
          evidence: e.evidence,
        })),
        resolvedExceptions: (resolvedByHole.get(hole.id) ?? []).sort((a, b) =>
          b.resolvedAt.localeCompare(a.resolvedAt),
        ),
        decisions: holeDecisions.map((d) => ({
          decision: d.decision as QaqcDecision,
          note: d.note,
          decidedByName: nameById.get(d.decidedBy) ?? "Someone no longer on the team",
          decidedAt: d.decidedAt.toISOString(),
          openAtDecision: openAtDecision(d.evidence),
        })),
      };
    })
    .filter(
      (hole) =>
        hole.exceptions.length > 0 ||
        hole.decisions.length > 0 ||
        hole.resolvedExceptions.length > 0,
    )
    .sort((a, b) => b.exceptions.length - a.exceptions.length);

  const deviceRows: DeviceExceptionRow[] = deviceExceptions.map((e) => ({
    key: e.key,
    summary: e.summary,
    evidence: e.evidence,
  }));

  resolvedOther.sort((a, b) => b.resolvedAt.localeCompare(a.resolvedAt));

  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const resolvedThisWeekCount =
    resolutions.filter((r) => r.resolvedAt >= weekAgo).length +
    decisions.filter((d) => d.decidedAt >= weekAgo).length;

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1>QA/QC</h1>
          <p>
            {QAQC_STAGE_LABELS[stage]} · {holeRows.length} holes with
            evidence to review ·{" "}
            <Link href={"/qaqc/standards" as Route} className="admin-link">
              Standards and blanks
            </Link>
          </p>
        </div>
      </div>
      <QaqcWorkspace
        holes={holeRows}
        devices={deviceRows}
        stage={stage}
        otherResolved={resolvedOther}
        openCount={open.length}
        resolvedThisWeekCount={resolvedThisWeekCount}
      />
    </>
  );
}
