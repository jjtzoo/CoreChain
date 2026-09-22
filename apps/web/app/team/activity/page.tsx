import { CUSTODY_LABELS, deviceStaleExceptions, type CustodyEventType } from "@corechain/domain";
import type { Route } from "next";
import Link from "next/link";
import { DismissibleHint } from "@/components/dismissible-hint";
import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/session";

// A device that has gone quiet this long is worth a manager's attention.
// Same generous threshold as QA/QC (app/qaqc/page.tsx): weeks offline are
// normal for this app.
const DEVICE_STALE_AFTER_DAYS = 21;
// A hole still being worked (not complete/logged) with no new evidence in
// this many days is worth flagging as needing attention. Shorter than the
// device threshold on purpose: a quiet phone is normal, a quiet *active*
// hole during a live program is more often worth a manager's nudge.
const HOLE_STALE_AFTER_DAYS = 7;
const ACTIVE_STATUSES = new Set(["planned", "drilling"]);

type FeedItem = {
  id: string;
  at: Date;
  holeId: string;
  drillholeId: string;
  summary: string;
  byName: string;
};

function formatWhen(at: Date): string {
  const minutes = Math.floor((Date.now() - at.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return at.toISOString().slice(0, 10);
}

export default async function ActivityPage() {
  const session = await requireProjectManager();

  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? null;

  if (!organizationId) {
    return (
      <div className="admin-page-header">
        <div>
          <h1>Activity</h1>
          <p>You aren&apos;t on a team yet. Ask an admin to add you to one.</p>
        </div>
      </div>
    );
  }

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const staleCutoff = new Date(now.getTime() - HOLE_STALE_AFTER_DAYS * 86_400_000);

  const [members, holes, devices, intervals, runs, samples, custodyEvents] =
    await Promise.all([
      prisma.user.findMany({
        where: { organizationId },
        select: { id: true, name: true },
      }),
      prisma.drillhole.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, holeId: true, status: true },
      }),
      prisma.device.findMany({
        where: { organizationId, revokedAt: null },
        select: { id: true, name: true, lastSeenAt: true },
      }),
      prisma.logInterval.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, drillholeId: true, createdBy: true, createdAt: true, fromM: true, toM: true },
      }),
      prisma.coreRun.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, drillholeId: true, createdBy: true, createdAt: true, fromM: true, toM: true },
      }),
      prisma.sample.findMany({
        where: { organizationId, deletedAt: null },
        select: { id: true, drillholeId: true, createdBy: true, createdAt: true, sampleNumber: true },
      }),
      prisma.custodyEvent.findMany({
        where: { organizationId, occurredAt: { gte: since } },
        select: {
          id: true,
          sampleId: true,
          eventType: true,
          createdBy: true,
          occurredAt: true,
        },
      }),
    ]);

  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const name = (id: string) => nameById.get(id) ?? "Someone no longer on the team";
  const holeById = new Map(holes.map((h) => [h.id, h]));

  // "No new logging" is judged from all three evidence types, not just one —
  // a hole with only samples taken today still counts as active today.
  const lastActivityByHole = new Map<string, Date>();
  const track = (drillholeId: string, at: Date) => {
    const current = lastActivityByHole.get(drillholeId);
    if (!current || at > current) lastActivityByHole.set(drillholeId, at);
  };
  for (const row of intervals) track(row.drillholeId, row.createdAt);
  for (const row of runs) track(row.drillholeId, row.createdAt);
  for (const row of samples) track(row.drillholeId, row.createdAt);

  const feed: FeedItem[] = [];
  for (const row of intervals) {
    if (row.createdAt < since) continue;
    const hole = holeById.get(row.drillholeId);
    feed.push({
      id: `interval:${row.id}`,
      at: row.createdAt,
      holeId: hole?.holeId ?? "",
      drillholeId: row.drillholeId,
      summary: `Logged ${row.fromM}–${row.toM} m`,
      byName: name(row.createdBy),
    });
  }
  for (const row of runs) {
    if (row.createdAt < since) continue;
    const hole = holeById.get(row.drillholeId);
    feed.push({
      id: `run:${row.id}`,
      at: row.createdAt,
      holeId: hole?.holeId ?? "",
      drillholeId: row.drillholeId,
      summary: `Recorded run ${row.fromM}–${row.toM} m`,
      byName: name(row.createdBy),
    });
  }
  for (const row of samples) {
    if (row.createdAt < since) continue;
    const hole = holeById.get(row.drillholeId);
    feed.push({
      id: `sample:${row.id}`,
      at: row.createdAt,
      holeId: hole?.holeId ?? "",
      drillholeId: row.drillholeId,
      summary: `Took sample ${row.sampleNumber}`,
      byName: name(row.createdBy),
    });
  }
  for (const row of custodyEvents) {
    // A custody event carries no drillholeId directly; the sample it belongs
    // to isn't loaded here to keep this query light, so it's shown on its
    // own rather than grouped under a hole.
    feed.push({
      id: `custody:${row.id}`,
      at: row.occurredAt,
      holeId: "",
      drillholeId: "",
      summary: `${CUSTODY_LABELS[row.eventType as CustodyEventType]} a sample`,
      byName: name(row.createdBy),
    });
  }
  feed.sort((a, b) => b.at.getTime() - a.at.getTime());

  const needsAttention = holes
    .filter((hole) => ACTIVE_STATUSES.has(hole.status))
    .map((hole) => ({
      hole,
      lastActivity: lastActivityByHole.get(hole.id) ?? null,
    }))
    .filter(
      (entry) => !entry.lastActivity || entry.lastActivity < staleCutoff,
    )
    .sort((a, b) => {
      const at = a.lastActivity?.getTime() ?? 0;
      const bt = b.lastActivity?.getTime() ?? 0;
      return at - bt;
    });

  const staleDevices = deviceStaleExceptions(
    devices.map((d) => ({
      deviceId: d.id,
      name: d.name,
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    })),
    { now: new Date(), staleAfterDays: DEVICE_STALE_AFTER_DAYS },
  );

  return (
    <>
      <div className="admin-page-header">
        <div>
          <Link href="/team" className="admin-link">
            ← Team overview
          </Link>
          <h1>Activity</h1>
          <p>What changed in the last 24 hours, and what needs a look.</p>
        </div>
      </div>

      <div className="admin-columns">
        <div className="admin-list-column">
          <DismissibleHint
            storageKey="corechain-activity-hint-dismissed"
            title="How this screen works"
          >
            <p className="admin-hint">
              The feed below is everything logged in the last 24 hours, newest
              first. &quot;Needs attention&quot; lists holes still being
              worked that have had no new evidence in over a week, and phones
              that haven&apos;t synced in a while — this app works offline for
              weeks, so a quiet phone alone isn&apos;t a problem.
            </p>
          </DismissibleHint>

          <section className="admin-card" aria-labelledby="feed-title">
            <div className="admin-card-head">
              <h2 id="feed-title">Last 24 hours</h2>
              <span className="admin-count">{feed.length}</span>
            </div>
            {feed.length === 0 ? (
              <p className="admin-hint">Nothing logged in the last 24 hours.</p>
            ) : (
              <ul className="admin-users">
                {feed.slice(0, 100).map((item) => (
                  <li className="admin-user" key={item.id}>
                    <div className="admin-user-who">
                      <span className="admin-user-name">
                        {item.byName}
                        {item.holeId ? (
                          <span className="admin-pill">{item.holeId}</span>
                        ) : null}
                      </span>
                      <span className="admin-user-email">
                        {item.summary} · {formatWhen(item.at)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="admin-card admin-add" aria-labelledby="attention-title">
          <h2 id="attention-title">Needs attention</h2>
          {needsAttention.length === 0 && staleDevices.length === 0 ? (
            <p className="admin-hint">Nothing needs attention right now.</p>
          ) : (
            <>
              {needsAttention.length > 0 ? (
                <ul className="admin-users">
                  {needsAttention.map(({ hole, lastActivity }) => (
                    <li className="admin-user" key={hole.id}>
                      <div className="admin-user-who">
                        <span className="admin-user-name">
                          <Link href={`/team/holes/${hole.id}` as Route}>{hole.holeId}</Link>
                        </span>
                        <span className="admin-user-email">
                          {lastActivity
                            ? `No new logging since ${formatWhen(lastActivity)}`
                            : "No logging recorded yet"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
              {staleDevices.length > 0 ? (
                <ul className="admin-users">
                  {staleDevices.map((exception) => (
                    <li className="admin-user" key={exception.key}>
                      <div className="admin-user-who">
                        <span className="admin-user-name">{exception.summary}</span>
                        <span className="admin-user-email">{exception.evidence}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </section>
      </div>
    </>
  );
}
