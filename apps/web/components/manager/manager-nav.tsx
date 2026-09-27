"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

// The project manager's six places (docs/product/project-manager-mode-outline.md).
// Pages that live under a place light it up: a hole's page is under Holes, a
// sample's trace under Samples & lab, the code library under Setup.
const ITEMS: { href: string; label: string; also?: string[] }[] = [
  { href: "/team", label: "Today" },
  { href: "/team/projects", label: "Projects" },
  { href: "/team/holes", label: "Holes" },
  { href: "/team/lab", label: "Samples & lab", also: ["/team/samples"] },
  { href: "/team/people", label: "Team", also: ["/team/activity"] },
  { href: "/team/setup", label: "Setup", also: ["/team/codes", "/team/standards", "/team/tags"] },
];

function isActive(pathname: string, item: (typeof ITEMS)[number]): boolean {
  if (item.href === "/team") return pathname === "/team";
  return [item.href, ...(item.also ?? [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function ManagerNav() {
  const pathname = usePathname();
  return (
    <nav className="mg-nav" aria-label="Project manager">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href as Route}
            className={active ? "admin-nav-item is-active" : "admin-nav-item"}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** One box for a sample number or a hole name; the search page decides which. */
export function ManagerSearch() {
  return (
    <form className="mg-search" action="/team/samples" method="get" role="search">
      <input
        name="number"
        placeholder="Find a sample or hole"
        aria-label="Find a sample or hole"
        autoComplete="off"
        spellCheck={false}
      />
    </form>
  );
}
