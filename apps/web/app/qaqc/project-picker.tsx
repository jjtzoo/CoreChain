"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { QAQC_PROJECT_COOKIE } from "./project-cookie";

export function QaqcProjectPicker({
  projects,
  selectedId,
}: {
  projects: { id: string; name: string }[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const choose = (id: string) => {
    document.cookie = id
      ? `${QAQC_PROJECT_COOKIE}=${encodeURIComponent(id)}; path=/qaqc; max-age=31536000; samesite=lax`
      : `${QAQC_PROJECT_COOKIE}=; path=/qaqc; max-age=0; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <label className="field qaqc-project-picker">
      <span className="field-label">Project</span>
      <select
        value={selectedId ?? ""}
        onChange={(e) => choose(e.target.value)}
        disabled={pending}
      >
        <option value="">All projects</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
    </label>
  );
}
