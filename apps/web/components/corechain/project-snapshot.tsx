import Link from "next/link";
import { ArrowUpRight, Database, FileCheck2, MapPinned } from "lucide-react";
import { albertaDemoProject } from "@/lib/demo/alberta-project";

type ProjectSnapshotProps = {
  compact?: boolean;
};

export function ProjectSnapshot({ compact = false }: ProjectSnapshotProps) {
  return (
    <section
      className={`project-snapshot${compact ? " is-compact" : ""}`}
      aria-label="Sample project summary"
    >
      <div className="project-snapshot-head">
        <div>
          <span className="project-source-label">
            {albertaDemoProject.dataOrigin}
          </span>
          <h2>{albertaDemoProject.name}</h2>
        </div>
        <MapPinned aria-hidden="true" size={22} strokeWidth={1.5} />
      </div>

      <p className="project-snapshot-location">{albertaDemoProject.location}</p>
      <p className="project-snapshot-copy">{albertaDemoProject.description}</p>

      <dl className="project-counts">
        <div>
          <dt>Drillholes</dt>
          <dd>{albertaDemoProject.drillholeCount}</dd>
        </div>
        <div>
          <dt>Intervals</dt>
          <dd>{albertaDemoProject.intervalCount}</dd>
        </div>
        <div>
          <dt>Assays</dt>
          <dd>{albertaDemoProject.assayCount}</dd>
        </div>
      </dl>

      {!compact && (
        <Link className="text-link" href={`/projects/${albertaDemoProject.id}`}>
          Enter workspace
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </Link>
      )}

      <div className="project-provenance">
        <FileCheck2 aria-hidden="true" size={16} strokeWidth={1.5} />
        <span>Source retained: {albertaDemoProject.sourceReference}</span>
      </div>
      <div className="project-provenance">
        <Database aria-hidden="true" size={16} strokeWidth={1.5} />
        <span>Custody and dispatch entries are synthetic examples</span>
      </div>
    </section>
  );
}
