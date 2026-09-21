import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  ROLE_LABELS,
  USER_ROLES,
  countBy,
  isFeedbackCategory,
  isFeedbackStatus,
  isUserRole,
} from "@corechain/domain";
import type { Route } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { FeedbackItem, type FeedbackRow } from "./feedback-item";

type Search = {
  category?: string;
  status?: string;
  tier?: string;
  appVersion?: string;
};

function href(search: Search): Route {
  const params = new URLSearchParams();
  if (search.category) params.set("category", search.category);
  if (search.status) params.set("status", search.status);
  if (search.tier) params.set("tier", search.tier);
  if (search.appVersion) params.set("appVersion", search.appVersion);
  const query = params.toString();
  return (query ? `/admin/feedback?${query}` : "/admin/feedback") as Route;
}

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  await requireAdmin();
  const raw = await searchParams;
  const category = isFeedbackCategory(raw.category) ? raw.category : undefined;
  const status = isFeedbackStatus(raw.status) ? raw.status : undefined;
  const tier = isUserRole(raw.tier) ? raw.tier : undefined;
  const appVersion = raw.appVersion || undefined;

  const [rows, all] = await Promise.all([
    prisma.feedback.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(status ? { status } : {}),
        ...(tier ? { tier } : {}),
        ...(appVersion ? { appVersion } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.feedback.findMany({
      select: { status: true, category: true, screen: true, tier: true, appVersion: true },
    }),
  ]);

  const people = await prisma.user.findMany({
    where: { id: { in: [...new Set(rows.map((row) => row.userId))] } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(people.map((person) => [person.id, person]));

  const items: FeedbackRow[] = rows.map((row) => ({
    id: row.id,
    who: byId.get(row.userId)?.name ?? "Unknown person",
    email: byId.get(row.userId)?.email ?? "",
    tier: row.tier,
    source: row.source,
    appVersion: row.appVersion,
    device: row.device,
    screen: row.screen,
    category: row.category,
    message: row.message,
    status: row.status,
    note: row.note,
    hasScreenshot: row.storageKey !== null,
    createdAt: row.createdAt.toISOString(),
  }));

  const statusCounts = new Map(
    countBy(all, (row) => row.status).map((c) => [c.key, c.count]),
  );
  const struggles = countBy(
    all.filter((row) => row.category === "bug"),
    (row) => row.screen,
  ).slice(0, 5);
  const appVersions = [
    ...new Set(
      all
        .map((row) => row.appVersion)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1>Feedback</h1>
          <p>
            What testers send from the app. Set a status and, if you like, a
            note the tester can see later, so people know their message was
            read.
          </p>
        </div>
        <a className="admin-button" href="/admin/feedback/export" download>
          Export CSV
        </a>
      </div>

      <div className="fb-summary">
        {FEEDBACK_STATUSES.map((value) => (
          <div key={value}>
            <span className="admin-meta-label">
              {FEEDBACK_STATUS_LABELS[value]}
            </span>
            <strong>{statusCounts.get(value) ?? 0}</strong>
          </div>
        ))}
        <div className="fb-struggles">
          <span className="admin-meta-label">
            Where testers report problems
          </span>
          {struggles.length === 0 ? (
            <span className="fb-muted">Nothing reported yet.</span>
          ) : (
            <ol>
              {struggles.map((entry) => (
                <li key={entry.key}>
                  {entry.key} <span className="fb-muted">· {entry.count}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="fb-filters" aria-label="Filters">
        <div className="fb-filter-group">
          <Link
            className={!category ? "fb-chip is-active" : "fb-chip"}
            href={href({ status, tier, appVersion })}
          >
            All kinds
          </Link>
          {FEEDBACK_CATEGORIES.map((value) => (
            <Link
              key={value}
              className={category === value ? "fb-chip is-active" : "fb-chip"}
              href={href({ category: value, status, tier, appVersion })}
            >
              {FEEDBACK_CATEGORY_LABELS[value]}
            </Link>
          ))}
        </div>
        <div className="fb-filter-group">
          <Link
            className={!status ? "fb-chip is-active" : "fb-chip"}
            href={href({ category, tier, appVersion })}
          >
            Any status
          </Link>
          {FEEDBACK_STATUSES.map((value) => (
            <Link
              key={value}
              className={status === value ? "fb-chip is-active" : "fb-chip"}
              href={href({ category, status: value, tier, appVersion })}
            >
              {FEEDBACK_STATUS_LABELS[value]}
            </Link>
          ))}
        </div>
        <div className="fb-filter-group">
          <Link
            className={!tier ? "fb-chip is-active" : "fb-chip"}
            href={href({ category, status, appVersion })}
          >
            Any tier
          </Link>
          {USER_ROLES.map((value) => (
            <Link
              key={value}
              className={tier === value ? "fb-chip is-active" : "fb-chip"}
              href={href({ category, status, tier: value, appVersion })}
            >
              {ROLE_LABELS[value]}
            </Link>
          ))}
        </div>
        {appVersions.length > 0 ? (
          <div className="fb-filter-group">
            <Link
              className={!appVersion ? "fb-chip is-active" : "fb-chip"}
              href={href({ category, status, tier })}
            >
              Any version
            </Link>
            {appVersions.map((value) => (
              <Link
                key={value}
                className={appVersion === value ? "fb-chip is-active" : "fb-chip"}
                href={href({ category, status, tier, appVersion: value })}
              >
                v{value}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {items.length === 0 ? (
        <section className="admin-card fb-empty">
          <h2>No feedback here yet.</h2>
          <p className="admin-hint">
            When a tester sends a message from the phone app, it appears here
            with their tier, the app version, the phone and the screen.
          </p>
        </section>
      ) : (
        <ul className="fb-list">
          {items.map((item) => (
            <FeedbackItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </>
  );
}
