import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Database, FileCheck2, Route } from "lucide-react";
import { ProjectSnapshot } from "@/components/corechain/project-snapshot";

export default function Home() {
  return (
    <main className="landing-shell">
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label="CoreChain home">
          <Image
            className="brand-logo"
            src="/branding/corechain-primary-horizontal.svg"
            alt="CoreChain"
            width={150}
            height={42}
            priority
          />
        </Link>
        <nav className="landing-header-actions" aria-label="Main">
          <Link
            className="header-action"
            href="/projects/alberta-drillhole-demo"
          >
            See a sample project
            <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.5} />
          </Link>
          <Link className="header-signin" href="/login">
            Sign in
          </Link>
        </nav>
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
            See a sample project
            <ArrowUpRight aria-hidden="true" size={17} strokeWidth={1.5} />
          </Link>
        </div>
        <ProjectSnapshot compact />
      </section>

      <section className="landing-evidence" aria-labelledby="evidence-title">
        <div>
          <p className="page-kicker">About the sample project</p>
          <h2 id="evidence-title">
            Built on public source records, not invented mining data.
          </h2>
        </div>
        <div className="evidence-list">
          <article>
            <Database aria-hidden="true" size={20} strokeWidth={1.5} />
            <h3>Public provenance</h3>
            <p>
              Every hole, interval and assay result keeps its original source
              reference.
            </p>
          </article>
          <article>
            <Route aria-hidden="true" size={20} strokeWidth={1.5} />
            <h3>One connected chain</h3>
            <p>
              Follow one assay result back through its dispatch, its sample and
              its core box to the hole and interval it came from.
            </p>
          </article>
          <article>
            <FileCheck2 aria-hidden="true" size={20} strokeWidth={1.5} />
            <h3>Honest boundaries</h3>
            <p>
              Core box, custody and dispatch entries are synthetic examples,
              marked as such wherever they appear.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
