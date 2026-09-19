import { ArrowUpRight, Database, FileCheck2, FolderKanban } from "lucide-react";
import { albertaDemoProject } from "@/lib/demo/alberta-project";

const availableRecords = [
  [
    "Drillhole register",
    `${albertaDemoProject.drillholeCount} source records`,
    "Ready for the first explorer screen.",
  ],
  [
    "Geological intervals",
    `${albertaDemoProject.intervalCount} linked intervals`,
    "Mapped to their drillhole source records.",
  ],
  [
    "Assay records",
    `${albertaDemoProject.assayCount} source results`,
    "Ready for matching and QA/QC demonstration.",
  ],
] as const;

export function WorkspaceOverview() {
  return (
    <div className="workspace-content">
      <header className="workspace-page-header">
        <div>
          <p className="page-kicker">Project overview</p>
          <h1>{albertaDemoProject.name}</h1>
          <p>{albertaDemoProject.description}</p>
        </div>
        <a
          className="source-link"
          href={albertaDemoProject.sourceUrl}
          rel="noreferrer"
          target="_blank"
        >
          View public source
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </a>
      </header>

      <section
        className="workspace-summary"
        aria-labelledby="available-records-title"
      >
        <div className="workspace-summary-title">
          <p className="page-kicker">Available now</p>
          <h2 id="available-records-title">
            Source records ready for the workflow
          </h2>
        </div>
        <div className="record-grid">
          {availableRecords.map(([label, value, note], index) => (
            <article className="record-item" key={label}>
              {index === 0 ? (
                <FolderKanban aria-hidden="true" size={20} strokeWidth={1.5} />
              ) : null}
              {index === 1 ? (
                <FileCheck2 aria-hidden="true" size={20} strokeWidth={1.5} />
              ) : null}
              {index === 2 ? (
                <Database aria-hidden="true" size={20} strokeWidth={1.5} />
              ) : null}
              <h3>{label}</h3>
              <strong>{value}</strong>
              <p>{note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="workspace-next" aria-labelledby="next-work-title">
        <div>
          <p className="page-kicker">Next workflow area</p>
          <h2 id="next-work-title">
            Inspect each drillhole before extending the chain.
          </h2>
          <p>
            The next screen will connect each source drillhole to its geological
            intervals and available assay evidence.
          </p>
        </div>
        <div className="workspace-next-detail">
          <span>Current boundary</span>
          <strong>Project to assay source record</strong>
          <span>Coming after drillhole review</span>
          <strong>Core boxes, samples, custody, and dispatch</strong>
        </div>
      </section>
    </div>
  );
}
