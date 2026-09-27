import { ROLE_LABELS, toUserRole } from "@corechain/domain";
import type { Route } from "next";
import Link from "next/link";
import { ActivityList, NoTeam, PageHead, Panel } from "@/components/manager/parts";
import {
  DEVICE_STALE_AFTER_DAYS,
  loadDevices,
  loadHoles,
  loadMembers,
  managerTeam,
  recentActivity,
} from "@/lib/manager/data";
import { formatShortDay, wholeDaysBetween } from "@/lib/manager/stats";
import { requireProjectManager } from "@/lib/session";

// Team: the people around this rig, what each logged this week, their phones,
// and the latest activity. Approving new phones is E17, not built.

const DAY_MS = 86_400_000;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function syncLabel(lastSeenAt: string | null, now: Date): { text: string; className: string } {
  if (!lastSeenAt) return { text: "Never synced", className: "mg-sync is-stale" };
  const days = wholeDaysBetween(new Date(lastSeenAt), now);
  if (days > DEVICE_STALE_AFTER_DAYS) return { text: `Synced ${days} days ago`, className: "mg-sync is-stale" };
  if (days === 0) return { text: "Synced today", className: "mg-sync" };
  return { text: days === 1 ? "Synced 1 day ago" : `Synced ${days} days ago`, className: "mg-sync is-quiet" };
}

export default async function TeamPeoplePage() {
  const session = await requireProjectManager();
  const team = await managerTeam(session.user.id);
  if (!team) return <NoTeam title="Team" />;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const members = await loadMembers(team.organizationId);
  const [holes, devices] = await Promise.all([
    loadHoles(team.organizationId),
    loadDevices(team.organizationId, members),
  ]);
  const activity = recentActivity(holes, members, now, 12);

  const people = members.map((member) => {
    const assigned = holes.filter((h) => h.assignment?.userId === member.id).map((h) => h.holeId);
    const loggedThisWeek = holes
      .flatMap((h) => h.intervals)
      .filter((i) => i.createdBy === member.id && i.createdAt >= weekAgo)
      .reduce((sum, i) => sum + Math.max(0, i.toM - i.fromM), 0);
    const phones = devices.filter((d) => d.userId === member.id);
    return { member, assigned, loggedThisWeek, phones };
  });

  return (
    <>
      <PageHead
        title="Team"
        intro={`${team.name}: the people around this rig, what each logged in the last 7 days, and their phones.`}
      />

      <div className="mg-grid">
        <Panel title="People" note="Metres logged are intervals entered in the last 7 days.">
          <div className="mg-table-wrap">
            <table className="mg-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Holes assigned</th>
                  <th className="is-num">Logged, 7 days</th>
                  <th>Phones</th>
                </tr>
              </thead>
              <tbody>
                {people.map(({ member, assigned, loggedThisWeek, phones }) => (
                  <tr key={member.id}>
                    <td>
                      <div className="mg-person">
                        <span className="mg-avatar" aria-hidden="true">
                          {initials(member.name)}
                        </span>
                        <div>
                          {member.name}
                          <small>{member.title || ROLE_LABELS[toUserRole(member.role)]}</small>
                        </div>
                      </div>
                    </td>
                    <td>{assigned.length > 0 ? assigned.join(", ") : <span className="is-muted">None</span>}</td>
                    <td className="is-num">{loggedThisWeek > 0 ? `${loggedThisWeek.toFixed(1)} m` : "·"}</td>
                    <td>
                      {phones.length === 0 ? (
                        <span className="is-muted">No phone</span>
                      ) : (
                        phones.map((phone) => {
                          const sync = syncLabel(phone.lastSeenAt, now);
                          return (
                            <div key={phone.id}>
                              <span className={sync.className}>
                                {phone.name}: {sync.text.toLowerCase()}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mg-note">
            A phone quiet for more than {DEVICE_STALE_AFTER_DAYS} days is marked. The app works offline
            for weeks, so a quiet phone alone is not a problem. Last checked {formatShortDay(now)}.
          </p>
        </Panel>

        <Panel
          title="Recent activity"
          action={
            <Link href={"/team/activity" as Route} className="admin-link">
              Full activity
            </Link>
          }
        >
          <ActivityList rows={activity} />
        </Panel>
      </div>
    </>
  );
}
