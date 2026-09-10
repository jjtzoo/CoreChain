import Link from "next/link";
import { ArrowUpRight, Database, FileCheck2, Route } from "lucide-react";
import { ProjectSnapshot } from "@/components/corechain/project-snapshot";

export default function Home() {
  return (
    <main className="landing-shell">
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label="CoreChain home">
          CoreChain
        </Link>
        <Link className="header-action" href="/projects/alberta-drillhole-demo">
          Open demo workspace
          <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.5} />
        </Link>
      </header>

      <section className="landing-hero" aria-labelledby="page-title">
        <div className="landing-copy">
          <p className="landing-kicker">
            Traceability for exploration workflows
          </p>
          <h1 id="page-title">Evidence that holds from core to assay.</h1>
          <p className="landing-lede">
            CoreChain links drilling records, core logging, samples, and assays
            into one clear operational chain.
          </p>
          <Link
            className="primary-action"
            href="/projects/alberta-drillhole-demo"
          >
            Explore the workspace
            <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.5} />
          </Link>
        </div>
        <ProjectSnapshot compact />
      </section>

      <section className="landing-evidence" aria-labelledby="evidence-title">
        <div>
          <p className="page-kicker">Phase 1 demonstration</p>
          <h2 id="evidence-title">
            Built on source records, not placeholder mining data.
          </h2>
        </div>
        <div className="evidence-list">
          <article>
            <Database aria-hidden="true" size={20} strokeWidth={1.5} />
            <h3>Public provenance</h3>
            <p>Each demo record keeps its original source reference.</p>
          </article>
          <article>
            <Route aria-hidden="true" size={20} strokeWidth={1.5} />
            <h3>One connected chain</h3>
            <p>
              The first build starts with drillholes, intervals, and assay
              evidence.
            </p>
          </article>
          <article>
            <FileCheck2 aria-hidden="true" size={20} strokeWidth={1.5} />
            <h3>Honest boundaries</h3>
            <p>
              Synthetic workflow records will be visibly marked before the pilot
              uses real data.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
