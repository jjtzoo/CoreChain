import type { Route } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { albertaDemoProject } from "@/lib/demo/alberta-project";

const base = `/projects/${albertaDemoProject.id}`;

// The sample project is read in this order: it follows one assay result back
// to the hole it came from, the way a reviewer would.
const steps = [
  {
    title: "Drillholes",
    text: "Six real holes with their collar and depth. Open one to see its geological intervals.",
    href: `${base}/drillholes`,
  },
  {
    title: "Sample",
    text: "One sample traced to its interval and its core box.",
    href: `${base}/samples`,
  },
  {
    title: "Custody and dispatch",
    text: "Each hand-over recorded in order, through to the dispatch to the laboratory.",
    href: `${base}/dispatches`,
  },
  {
    title: "Assays and QA/QC",
    text: "The results that came back, and how a QA/QC review reads them against standards and blanks.",
    href: `${base}/assays`,
  },
] as const;

export function WorkspaceOverview() {
  return (
    <div className="workspace-content">
      <header className="workspace-page-header">
        <div>
          <p className="page-kicker">Sample project · read-only</p>
          <h1>Follow one assay result back to the core.</h1>
          <p>
            This project shows how CoreChain links what happens in the field to
            what comes back from the laboratory. Open the steps in order, or
            jump to any of them.
          </p>
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

      <dl className="sample-stats">
        <div>
          <dt>Drillholes</dt>
          <dd>{albertaDemoProject.drillholeCount}</dd>
        </div>
        <div>
          <dt>Geological intervals</dt>
          <dd>{albertaDemoProject.intervalCount}</dd>
        </div>
        <div>
          <dt>Assay results</dt>
          <dd>{albertaDemoProject.assayCount}</dd>
        </div>
      </dl>

      <section className="sample-provenance" aria-labelledby="provenance-title">
        <h2 id="provenance-title">What you are looking at</h2>
        <div className="sample-provenance-grid">
          <div>
            <p className="page-kicker">Real public data</p>
            <p>
              The drillholes, geological intervals and assay results come from{" "}
              {albertaDemoProject.sourceReference}, published by the Alberta
              Geological Survey. Each record keeps its source reference.
            </p>
          </div>
          <div>
            <p className="page-kicker">Synthetic examples</p>
            <p>
              The core box, the custody events and the dispatch were created to
              show the chain. They are marked as synthetic wherever they appear.
            </p>
          </div>
        </div>
      </section>

      <section className="sample-steps" aria-labelledby="steps-title">
        <h2 id="steps-title">Follow the chain</h2>
        <ol>
          {steps.map((step, index) => (
            <li key={step.title}>
              <Link href={step.href as Route} className="sample-step">
                <span className="sample-step-number">{index + 1}</span>
                <span className="sample-step-body">
                  <strong>{step.title}</strong>
                  <span>{step.text}</span>
                </span>
                <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.5} />
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <p className="sample-footnote">
        In the pilot, the same chain is recorded on a phone at the rig, with or
        without signal. This sample project is a read-only view of it.
      </p>
    </div>
  );
}
