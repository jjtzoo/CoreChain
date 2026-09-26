import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { AccessRequestForm } from "./access-request-form";
import { access, finalCta, hero, integrity, SAMPLE_PROJECT_HREF, status } from "./content";

export function Integrity() {
  return (
    <section id="integrity" className="lp-section">
      <div className="lp-wrap">
        <div className="lp-head">
          <p className="lp-eyebrow">Records you can stand behind</p>
          <h2>{integrity.title}</h2>
          <p>{integrity.pmrc}</p>
        </div>
        <div className="lp-integrity">
          {integrity.points.map((point) => (
            <div key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Status() {
  return (
    <section id="status" className="lp-section">
      <div className="lp-wrap">
        <div className="lp-head">
          <h2>{status.title}</h2>
          <p>{status.intro}</p>
        </div>
        <div className="lp-table-wrap">
          <table className="lp-table">
            <thead>
              <tr>
                <th scope="col">Stage</th>
                <th scope="col">Capability</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {status.rows.map((row) => (
                <tr key={row.stage}>
                  <td>{row.stage}</td>
                  <td>{row.what}</td>
                  <td className={`lp-status lp-status-${row.tone}`}>{row.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="lp-note">
          <Link className="lp-link" href={SAMPLE_PROJECT_HREF as Route}>
            See a read-only sample project
          </Link>{" "}
          built on official open data from the Alberta Geological Survey.
        </p>
      </div>
    </section>
  );
}

export function Access() {
  return (
    <section id="access" className="lp-section lp-section-dark">
      <div className="lp-wrap lp-access">
        <div>
          <h2>{access.title}</h2>
          <p className="lp-access-intro">{access.intro}</p>
          <div className="lp-routes">
            {access.routes.map((route) => (
              <article className="lp-route" key={route.title}>
                <h3>{route.title}</h3>
                <p>{route.text}</p>
                <p className="lp-route-detail">{route.detail}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="lp-access-form">
          <h3>{access.formTitle}</h3>
          <AccessRequestForm />
          <p className="lp-signin">
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <>
      <section className="lp-section lp-final">
        <div className="lp-wrap">
          <h2>{finalCta.title}</h2>
          <p>{finalCta.text}</p>
          <div className="lp-cta lp-cta-center">
            <a className="lp-btn lp-btn-solid" href="#access">
              {hero.primary}
            </a>
            <Link className="lp-btn lp-btn-line" href={SAMPLE_PROJECT_HREF as Route}>
              {hero.secondary}
            </Link>
          </div>
        </div>
      </section>
      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <Image
            className="lp-logo-small"
            src="/branding/corechain-primary-horizontal.svg"
            alt="CoreChain"
            width={110}
            height={31}
          />
          <span>{finalCta.footer}</span>
          <span>{hero.status}</span>
          <Link href="/login">Sign in</Link>
        </div>
      </footer>
    </>
  );
}
