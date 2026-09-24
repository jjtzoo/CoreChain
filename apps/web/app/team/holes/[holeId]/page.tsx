import {
  CUSTODY_LABELS,
  custodyTimeline,
  recoveryPercent,
  ROLE_LABELS,
  toUserRole,
  type CustodyEventType,
  type FieldCustodyEvent,
} from "@corechain/domain";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/session";

function formatDay(iso: string): string {
  return iso.slice(0, 10);
}

export default async function HoleViewPage({
  params,
}: {
  params: Promise<{ holeId: string }>;
}) {
  const session = await requireProjectManager();
  const { holeId } = await params;

  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? null;
  if (!organizationId) notFound();

  const hole = await prisma.drillhole.findFirst({
    where: { id: holeId, organizationId, deletedAt: null },
    include: {
      project: { select: { name: true } },
      assignment: { select: { userId: true } },
      runs: { where: { deletedAt: null }, orderBy: { fromM: "asc" } },
      intervals: { where: { deletedAt: null }, orderBy: { fromM: "asc" } },
      samples: {
        where: { deletedAt: null },
        orderBy: { sampleNumber: "asc" },
        include: { custodyEvents: { orderBy: { occurredAt: "asc" } } },
      },
      photos: { where: { deletedAt: null }, orderBy: { fromM: "asc" } },
      qaqcDecisions: { orderBy: { decidedAt: "desc" } },
    },
  });
  if (!hole) notFound();

  const memberIds = new Set<string>([
    ...hole.runs.map((r) => r.createdBy),
    ...hole.intervals.map((i) => i.createdBy),
    ...hole.samples.map((s) => s.createdBy),
    ...hole.photos.map((p) => p.createdBy),
    ...hole.samples.flatMap((s) => s.custodyEvents.map((e) => e.handledBy)),
    ...hole.qaqcDecisions.map((d) => d.decidedBy),
  ]);
  if (hole.assignment) memberIds.add(hole.assignment.userId);
  const members = await prisma.user.findMany({
    where: { id: { in: [...memberIds] } },
    select: { id: true, name: true, role: true },
  });
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const name = (id: string) => nameById.get(id) ?? "Someone no longer on the team";

  const assignedToName = hole.assignment ? name(hole.assignment.userId) : null;

  return (
    <>
      <div className="admin-page-header">
        <div>
          <Link href="/team" className="admin-link">
            ← Team overview
          </Link>
          <h1>{hole.holeId}</h1>
          <p>
            {hole.project.name} · planned {hole.plannedDepthM.toFixed(1)} m
            {hole.actualFinalDepthM ? ` · final ${hole.actualFinalDepthM.toFixed(1)} m` : ""}
            {assignedToName ? ` · assigned to ${assignedToName}` : ""}
            {hole.samples.length > 0 ? (
              <>
                {" · "}
                <Link href={`/team/tags?hole=${hole.id}` as Route} className="admin-link">
                  Print tags
                </Link>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="admin-columns">
        <div className="admin-list-column">
          <section className="admin-card" aria-labelledby="runs-title">
            <div className="admin-card-head">
              <h2 id="runs-title">Core runs</h2>
              <span className="admin-count">{hole.runs.length}</span>
            </div>
            {hole.runs.length === 0 ? (
              <p className="admin-hint">No runs logged yet.</p>
            ) : (
              <ul className="admin-users">
                {hole.runs.map((run) => {
                  const pct = recoveryPercent(run.toM - run.fromM, run.recoveredM);
                  return (
                    <li className="admin-user" key={run.id}>
                      <div className="admin-user-who">
                        <span className="admin-user-name">
                          {run.fromM}–{run.toM} m
                        </span>
                        <span className="admin-user-email">
                          {run.recoveredM.toFixed(2)} m recovered
                          {pct !== null ? ` (${pct}%)` : ""} · {name(run.createdBy)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="admin-card" aria-labelledby="intervals-title">
            <div className="admin-card-head">
              <h2 id="intervals-title">Logged intervals</h2>
              <span className="admin-count">{hole.intervals.length}</span>
            </div>
            {hole.intervals.length === 0 ? (
              <p className="admin-hint">No intervals logged yet.</p>
            ) : (
              <ul className="admin-users">
                {hole.intervals.map((interval) => (
                  <li className="admin-user" key={interval.id}>
                    <div className="admin-user-who">
                      <span className="admin-user-name">
                        {interval.fromM}–{interval.toM} m
                      </span>
                      <span className="admin-user-email">
                        {[interval.lithology, interval.alterationType, interval.mineral]
                          .filter(Boolean)
                          .join(" · ") || "No description"}{" "}
                        · {name(interval.createdBy)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-card" aria-labelledby="samples-title">
            <div className="admin-card-head">
              <h2 id="samples-title">Samples and custody</h2>
              <span className="admin-count">{hole.samples.length}</span>
            </div>
            {hole.samples.length === 0 ? (
              <p className="admin-hint">No samples taken yet.</p>
            ) : (
              <ul className="admin-users">
                {hole.samples.map((sample) => {
                  const events: FieldCustodyEvent[] = sample.custodyEvents.map((e) => ({
                    id: e.id,
                    projectId: e.projectId,
                    sampleId: e.sampleId,
                    type: e.eventType as CustodyEventType,
                    occurredAt: e.occurredAt.toISOString(),
                    handledBy: e.handledBy,
                    location: e.location,
                    recipient: e.recipient,
                    note: e.note,
                    dispatchId: e.dispatchId,
                    correctsEventId: e.correctsEventId,
                    createdAt: e.createdAt.toISOString(),
                  }));
                  const timeline = custodyTimeline(events);
                  return (
                    <li className="admin-user" key={sample.id}>
                      <div className="admin-user-who">
                        <Link
                          href={`/team/samples/${sample.id}` as Route}
                          className="admin-user-name record-link"
                        >
                          {sample.sampleNumber}
                        </Link>
                        <span className="admin-user-email">
                          {sample.sampleType} · {sample.status}
                          {sample.fromM !== null ? ` · ${sample.fromM}–${sample.toM} m` : ""} ·{" "}
                          {name(sample.createdBy)}
                        </span>
                      </div>
                      {timeline.length > 0 ? (
                        <ul className="admin-users">
                          {timeline.map((line) => (
                            <li key={line.id} className="admin-status">
                              <span className="admin-meta-label">
                                {CUSTODY_LABELS[line.type]}
                                {line.voided ? " (voided)" : ""}
                              </span>
                              <span>
                                {formatDay(line.occurredAt)} · {name(line.handledBy)}
                                {line.recipient ? ` → ${line.recipient}` : ""}
                                {line.note ? ` — ${line.note}` : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="admin-hint">No custody steps recorded yet.</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <section className="admin-card admin-add" aria-labelledby="side-title">
          <h2 id="side-title">Photos and decisions</h2>
          <div className="admin-status">
            <span className="admin-meta-label">Photos</span>
            <span>{hole.photos.length} taken</span>
          </div>
          {hole.qaqcDecisions.length > 0 ? (
            <ul className="admin-users">
              {hole.qaqcDecisions.map((decision) => (
                <li className="admin-user" key={decision.id}>
                  <div className="admin-user-who">
                    <span className="admin-user-name">
                      {decision.decision[0].toUpperCase() + decision.decision.slice(1)}
                    </span>
                    <span className="admin-user-email">
                      {name(decision.decidedBy)}, {formatDay(decision.decidedAt.toISOString())}
                      {decision.note ? ` — ${decision.note}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-hint">No QA/QC decisions recorded yet.</p>
          )}
          <p className="admin-hint">
            Every person named above: {members.map((m) => `${m.name} (${ROLE_LABELS[toUserRole(m.role)]})`).join(", ") || "no one yet"}.
          </p>
        </section>
      </div>
    </>
  );
}
