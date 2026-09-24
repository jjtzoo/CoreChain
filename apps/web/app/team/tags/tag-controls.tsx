"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";

type Option = { id: string; label: string };

/** Choose which samples to print tags for: one hole, or one dispatch. */
export function TagControls({
  holes,
  dispatches,
  hole,
  dispatch,
  count,
}: {
  holes: Option[];
  dispatches: Option[];
  hole: string | null;
  dispatch: string | null;
  count: number;
}) {
  const router = useRouter();
  const go = (query: string) => router.push(`/team/tags${query}` as Route);

  return (
    <div className="tag-controls no-print">
      <label className="field">
        <span className="field-label">Tags for a hole</span>
        <select
          value={hole ?? ""}
          onChange={(e) => go(e.target.value ? `?hole=${encodeURIComponent(e.target.value)}` : "")}
        >
          <option value="">Choose a hole</option>
          {holes.map((h) => (
            <option key={h.id} value={h.id}>
              {h.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Or for a dispatch</span>
        <select
          value={dispatch ?? ""}
          onChange={(e) =>
            go(e.target.value ? `?dispatch=${encodeURIComponent(e.target.value)}` : "")
          }
        >
          <option value="">Choose a dispatch</option>
          {dispatches.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <div className="tag-controls-print">
        <button
          type="button"
          className="auth-submit"
          disabled={count === 0}
          onClick={() => window.print()}
        >
          Print {count > 0 ? `${count} tag${count === 1 ? "" : "s"}` : "tags"}
        </button>
      </div>
    </div>
  );
}
