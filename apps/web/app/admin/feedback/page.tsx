import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
  countBy,
  isFeedbackCategory,
  isFeedbackStatus,
} from "@corechain/domain";
import type { Route } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { FeedbackItem, type FeedbackRow } from "./feedback-item";

type Search = { category?: string; status?: string };

function href(search: Search): Route {
  const params = new URLSearchParams();
  if (search.category) params.set("category", search.category);
  if (search.status) params.set("status", search.status);
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

  const [rows, all] = await Promise.all([
    prisma.feedback.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.feedback.findMany({
      select: { status: true, category: true, screen: true },
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
            href={href({ status })}
          >
            All kinds
          </Link>
          {FEEDBACK_CATEGORIES.map((value) => (
            <Link
              key={value}
              className={category === value ? "fb-chip is-active" : "fb-chip"}
              href={href({ category: value, status })}
            >
              {FEEDBACK_CATEGORY_LABELS[value]}
            </Link>
          ))}
        </div>
        <div className="fb-filter-group">
          <Link
            className={!status ? "fb-chip is-active" : "fb-chip"}
            href={href({ category })}
          >
            Any status
          </Link>
          {FEEDBACK_STATUSES.map((value) => (
            <Link
              key={value}
              className={status === value ? "fb-chip is-active" : "fb-chip"}
              href={href({ category, status: value })}
            >
              {FEEDBACK_STATUS_LABELS[value]}
            </Link>
          ))}
        </div>
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
