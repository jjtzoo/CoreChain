"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";

export function ProjectPicker({
  projects,
  selectedId,
}: {
  projects: { id: string; name: string }[];
  selectedId: string;
}) {
  const router = useRouter();
  return (
    <label className="field" style={{ maxWidth: 420 }}>
      <span className="field-label">Import into</span>
      <select
        value={selectedId}
        onChange={(e) =>
          router.push(`/team/codes?project=${encodeURIComponent(e.target.value)}` as Route)
        }
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
