"use client";

import { useState, useSyncExternalStore } from "react";

// A short "how this screen works" tip, dismissed per browser (not per
// account, not synced), same storage approach as the admin first-run
// checklist (app/admin/users/users-workspace.tsx). Used on new pages a
// tester opens for the first time with no walkthrough of their own yet.

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Private browsing or blocked storage: the hint just won't remember.
  }
}

function noSubscription() {
  return () => {};
}

function useStoredFlag(key: string): [boolean, (value: boolean) => void] {
  const stored = useSyncExternalStore(
    noSubscription,
    () => readFlag(key),
    () => false,
  );
  const [override, setOverride] = useState<boolean | null>(null);
  return [
    override ?? stored,
    (value: boolean) => {
      writeFlag(key, value);
      setOverride(value);
    },
  ];
}

export function DismissibleHint({
  storageKey,
  title,
  children,
}: {
  /** Unique per screen, e.g. "corechain-laboratory-hint-dismissed". */
  storageKey: string;
  title: string;
  children: React.ReactNode;
}) {
  const [dismissed, setDismissed] = useStoredFlag(storageKey);
  if (dismissed) {
    return (
      <button type="button" className="admin-link" onClick={() => setDismissed(false)}>
        Show how this works
      </button>
    );
  }
  return (
    <section className="admin-card" aria-label={title}>
      <div className="admin-card-head">
        <h2>{title}</h2>
        <button type="button" className="admin-link" onClick={() => setDismissed(true)}>
          Got it, hide this
        </button>
      </div>
      {children}
    </section>
  );
}
