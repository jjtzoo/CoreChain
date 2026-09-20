"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/feedback", label: "Feedback" },
] as const;

/** The admin area's tabs. `newFeedback` is how many messages have not been seen yet. */
export function AdminNav({ newFeedback }: { newFeedback: number }) {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Admin">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={active ? "admin-nav-item is-active" : "admin-nav-item"}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
            {item.href === "/admin/feedback" && newFeedback > 0 ? (
              <span
                className="admin-nav-count"
                aria-label={`${newFeedback} new`}
              >
                {newFeedback}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
