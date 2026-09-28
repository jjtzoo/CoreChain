"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  GUIDE_PARAM,
  GUIDE_TOURS,
  guidePageFor,
  guidePartFromParam,
  previousGuidePage,
  withGuideParam,
  type GuidePage,
  type GuideStep,
  type GuideTarget,
  type GuideTour,
} from "@/lib/guide/tours";
import "./guide.css";

// "Guide" in the top bar: a short tour of the page you are on. The part being
// described stays in full colour while the rest of the page fades to grey,
// and a card beside it says what it is. The part shown lives in the address
// (?guide=3), so the browser's Back and Forward follow the tour too.

type Part = { step: GuideStep; el: HTMLElement };
type Box = { top: number; left: number; width: number; height: number };
type Placement = { top?: number; left?: number; right?: number; bottom?: number; width: number };

const PAD = 6;
const GAP = 12;
const EDGE = 16;
const PAGES_KEY = "corechain-guide-pages";
const USED_KEY = "corechain-guide-used";

function findTarget(target: GuideTarget): HTMLElement | null {
  let found = [...document.querySelectorAll<HTMLElement>(target.selector)].filter(
    (el) => el.getClientRects().length > 0 && !el.closest(".guide-layer"),
  );
  if (target.heading) {
    found = found.filter((el) =>
      [...el.querySelectorAll("h2, h3")].some((h) => h.textContent?.trim() === target.heading),
    );
  }
  if (target.text) {
    const text = target.text;
    found = found
      .filter((el) => el.textContent?.includes(text))
      .sort((a, b) => a.getBoundingClientRect().height - b.getBoundingClientRect().height);
  }
  return found[0] ?? null;
}

const subscribeNever = () => () => {};
function readNeverUsed(): boolean {
  try {
    return localStorage.getItem(USED_KEY) === null;
  } catch {
    return false;
  }
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function currentHref(): string {
  return window.location.pathname + window.location.search + window.location.hash;
}

// Where each tour page was last seen, so Back can return to a page whose
// address holds an id (a project, a hole).
function rememberPage(pageId: string, href: string) {
  try {
    const seen = JSON.parse(sessionStorage.getItem(PAGES_KEY) ?? "{}") as Record<string, string>;
    seen[pageId] = href;
    sessionStorage.setItem(PAGES_KEY, JSON.stringify(seen));
  } catch {
    // Storage can be off; Back then uses the page's fixed address, if it has one.
  }
}

function rememberedPage(pageId: string): string | null {
  try {
    const seen = JSON.parse(sessionStorage.getItem(PAGES_KEY) ?? "{}") as Record<string, string>;
    return seen[pageId] ?? null;
  } catch {
    return null;
  }
}

function sameBox(a: Box | null, b: Box | null): boolean {
  return !!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

function place(box: Box, popHeight: number): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (vw < 640) return { left: EDGE, right: EDGE, bottom: EDGE, width: vw - EDGE * 2 };
  const width = Math.min(360, vw - EDGE * 2);
  const left = Math.min(Math.max(box.left, EDGE), vw - width - EDGE);
  if (vh - (box.top + box.height + GAP) >= popHeight + EDGE) return { top: box.top + box.height + GAP, left, width };
  if (box.top - GAP >= popHeight + EDGE) return { top: box.top - GAP - popHeight, left, width };
  // A tall part: beside it, on whichever side has room.
  const top = Math.min(Math.max(box.top, EDGE), vh - popHeight - EDGE);
  const right = vw - (box.left + box.width) - GAP - EDGE;
  const leftRoom = box.left - GAP - EDGE;
  if (Math.max(right, leftRoom) >= 280) {
    const side = Math.min(360, Math.max(right, leftRoom));
    return right >= leftRoom
      ? { top, left: box.left + box.width + GAP, width: side }
      : { top, left: box.left - GAP - side, width: side };
  }
  // No room anywhere: keep the card in the corner.
  return { right: EDGE, bottom: EDGE, width };
}

function GuideOverlay({
  tour,
  page,
  parts,
  part,
  onPart,
  onClose,
  opening,
}: {
  tour: GuideTour;
  page: GuidePage;
  parts: Part[];
  part: number;
  onPart: (n: number | "next" | "back") => void;
  onClose: () => void;
  /** The page being opened by Next or Back, while it loads. */
  opening: { to: "next" | "back"; name: string } | null;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const current = parts[part];
  const first = part === 0;
  const last = part === parts.length - 1;
  const before = previousGuidePage(tour, page.id);
  const after = page.next ? tour.pages.find((p) => p.id === page.next?.page) ?? null : null;

  // Bring the part into view when it changes.
  useEffect(() => {
    const rect = current.el.getBoundingClientRect();
    const tall = rect.height > window.innerHeight * 0.6;
    const top = rect.top + window.scrollY - (tall ? 96 : (window.innerHeight - rect.height) / 2 - 80);
    const outOfView = rect.top < 72 || rect.bottom > window.innerHeight - (tall ? 0 : 200);
    if (outOfView) window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? "auto" : "smooth" });
    popRef.current?.focus({ preventScroll: true });
  }, [current]);

  // Follow the part while the page scrolls, resizes or reflows.
  useEffect(() => {
    let frame = 0;
    let lastBox: Box | null = null;
    let lastPlace = "";
    const tick = () => {
      const r = current.el.getBoundingClientRect();
      const next: Box = {
        top: Math.round(r.top - PAD),
        left: Math.round(r.left - PAD),
        width: Math.round(r.width + PAD * 2),
        height: Math.round(r.height + PAD * 2),
      };
      if (!sameBox(next, lastBox)) {
        lastBox = next;
        setBox(next);
      }
      const p = place(next, popRef.current?.offsetHeight ?? 220);
      const key = JSON.stringify(p);
      if (key !== lastPlace) {
        lastPlace = key;
        setPlacement(p);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [current]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onPart("next");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPart("back");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, onPart]);

  const vw = typeof window === "undefined" ? 0 : window.innerWidth;
  const vh = typeof window === "undefined" ? 0 : window.innerHeight;
  const b = box ?? { top: 0, left: 0, width: 0, height: 0 };
  const top = Math.max(0, b.top);
  const bottom = Math.min(vh, b.top + b.height);
  const veils = [
    { top: 0, left: 0, width: vw, height: top },
    { top: bottom, left: 0, width: vw, height: Math.max(0, vh - bottom) },
    { top, left: 0, width: Math.max(0, b.left), height: Math.max(0, bottom - top) },
    { top, left: b.left + b.width, width: Math.max(0, vw - b.left - b.width), height: Math.max(0, bottom - top) },
  ];
  const nextLabel =
    opening?.to === "next" ? `Opening ${opening.name}…` : !last ? "Next" : after ? `Next: ${after.name}` : "Finish";
  const backLabel =
    opening?.to === "back" ? `Opening ${opening.name}…` : first && before ? `Back: ${before.name}` : "Back";
  const titleId = `guide-title-${page.id}`;

  return createPortal(
    <div className="guide-layer">
      {veils.map((v, i) => (
        <div key={i} className="guide-veil" style={v} />
      ))}
      <div className="guide-ring" style={b} aria-hidden="true" />
      <div
        ref={popRef}
        className="guide-pop"
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={placement ?? { visibility: "hidden" }}
      >
        <div className="guide-pop-head">
          <span className="guide-count" aria-live="polite">
            {page.name} · Part <b>{part + 1}</b> of {parts.length}
          </span>
          <button type="button" className="guide-close" onClick={onClose} aria-label="Close the guide">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="guide-bar" aria-hidden="true">
          <i style={{ width: `${((part + 1) / parts.length) * 100}%` }} />
        </div>
        <h2 id={titleId}>{current.step.title}</h2>
        <p>{current.step.body}</p>
        <div className="guide-nav">
          <button type="button" className="guide-back" onClick={() => onPart("back")} disabled={(first && !before) || opening !== null}>
            <span aria-hidden="true">←</span> {backLabel}
          </button>
          <button type="button" className="guide-next" onClick={() => onPart("next")} disabled={opening !== null}>
            {nextLabel} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function GuideInner({ tourId }: { tourId: keyof typeof GUIDE_TOURS }) {
  const tour = GUIDE_TOURS[tourId];
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const page = guidePageFor(tour, pathname);
  const raw = params.get(GUIDE_PARAM);
  const open = raw !== null && page !== null;
  // The parts found on this page, kept with the address they were found on.
  const [found, setFound] = useState<{ key: string; parts: Part[] }>({ key: "", parts: [] });
  const key = open && page ? `${page.id} ${pathname}` : "";
  const parts = found.key === key ? found.parts : [];

  // A small dot on the button until the guide is first opened in this browser.
  const neverUsed = useSyncExternalStore(subscribeNever, readNeverUsed, () => false);
  const unused = neverUsed && !open;
  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(USED_KEY, "1");
    } catch {
      // Without storage the dot comes back on the next page load.
    }
  }, [open]);

  // Find the page's parts. Some render a moment after the page (the 3D
  // view), so look again shortly after opening.
  useEffect(() => {
    if (!key || !page) return;
    const resolve = () =>
      setFound((previous) => {
        const parts = page.steps.flatMap((step) => {
          const el = findTarget(step);
          return el ? [{ step, el }] : [];
        });
        const same =
          previous.key === key &&
          parts.length === previous.parts.length &&
          parts.every((p, i) => p.el === previous.parts[i]?.el);
        return same ? previous : { key, parts };
      });
    const timers = [0, 200, 700, 1500].map((ms) => window.setTimeout(resolve, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [key, page]);

  useEffect(() => {
    if (open && page) rememberPage(page.id, withGuideParam(currentHref(), null));
  }, [open, page, pathname, params]);

  const part = open ? guidePartFromParam(raw, parts.length) : null;

  const setPart = useCallback((n: number | null) => {
    window.history.replaceState(null, "", withGuideParam(currentHref(), n));
  }, []);

  const close = useCallback(() => setPart(null), [setPart]);

  // Opening the next or previous page can take a moment; the card says so.
  const [loading, startLoading] = useTransition();
  const [opening, setOpening] = useState<{ to: "next" | "back"; name: string } | null>(null);
  const go = useCallback(
    (href: string, at: number | "last", to: "next" | "back", name: string) => {
      setOpening({ to, name });
      startLoading(() => router.push(withGuideParam(href, at) as Route));
    },
    [router],
  );

  const onPart = useCallback(
    (to: number | "next" | "back") => {
      if (!page || part === null || loading) return;
      if (typeof to === "number") return setPart(to);
      if (to === "next") {
        if (part < parts.length - 1) return setPart(part + 1);
        const next = page.next;
        const href = !next
          ? null
          : "href" in next
            ? next.href
            : document.querySelector<HTMLAnchorElement>(next.linkSelector)?.getAttribute("href") ?? null;
        const after = tour.pages.find((p) => p.id === next?.page);
        if (href && after) go(href, 0, "next", after.name);
        else close();
        return;
      }
      if (part > 0) return setPart(part - 1);
      const before = previousGuidePage(tour, page.id);
      const href = before ? rememberedPage(before.id) ?? before.href ?? null : null;
      if (href && before) go(href, "last", "back", before.name);
    },
    [close, go, loading, page, part, parts.length, setPart, tour],
  );

  const start = () => {
    if (open) return close();
    if (page) setPart(0);
    else go(tour.start, 0, "next", tour.pages[0]?.name ?? "the guide");
  };

  return (
    <>
      <button
        type="button"
        className={`guide-button${open ? " is-on" : ""}`}
        onClick={start}
        aria-pressed={open}
        title={page ? "A short tour of this page" : "Start the guide from the first page"}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6" />
          <path d="M12 17h.01" />
        </svg>
        Guide
        {unused ? <span className="guide-new" aria-hidden="true" /> : null}
      </button>
      {open && page && part !== null && parts.length > 0 ? (
        <GuideOverlay tour={tour} page={page} parts={parts} part={part} onPart={onPart} onClose={close} opening={loading ? opening : null} />
      ) : null}
    </>
  );
}

export function Guide({ tour }: { tour: keyof typeof GUIDE_TOURS }) {
  return (
    <Suspense fallback={null}>
      <GuideInner tourId={tour} />
    </Suspense>
  );
}
