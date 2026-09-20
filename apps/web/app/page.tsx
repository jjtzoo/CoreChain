import "./landing.css";
import Image from "next/image";
import Link from "next/link";
import { AccessRequestForm } from "@/components/landing/access-request-form";

// The public landing page. Field-first: who it is for, the chain of evidence,
// the tiers, and an honest statement of what works today. Nothing here may
// claim a capability the pilot build does not have; the status table says what
// is available, rolling out, next or later.

const chain = [
  {
    n: "01",
    title: "Hole",
    text: "Collar, planned azimuth and dip, depth and status, from GPS or entered by hand.",
    icon: (
      <>
        <path d="M17 4v20M11 18l6 8 6-8" />
        <path d="M6 30h22" />
      </>
    ),
  },
  {
    n: "02",
    title: "Core",
    text: "Boxes and runs with recovery and RQD, and warnings for gaps and overlaps.",
    icon: (
      <>
        <rect x="4" y="9" width="26" height="16" rx="2" />
        <path d="M4 15h26M12 9v16M21 9v16" />
      </>
    ),
  },
  {
    n: "03",
    title: "Log",
    text: "Depth intervals with the project’s own code lists, and photographs tied to box and depth.",
    icon: <path d="M5 8h24M5 14h24M5 20h16M5 26h10" />,
  },
  {
    n: "04",
    title: "Sample",
    text: "Sample numbers from reserved blocks, and standards, blanks and duplicates at the project’s rate.",
    icon: <path d="M13 5h8M15 5v9l-8 14h20l-8-14V5" />,
  },
  {
    n: "05",
    title: "Custody",
    text: "Every hand-over recorded and never edited, through dispatch to the laboratory.",
    tag: "In development",
    icon: <path d="M4 12h18l-4-5M30 22H12l4 5" />,
  },
] as const;

const roles = [
  {
    where: "Phone",
    title: "Field geologist",
    text: "Logs core, photographs and samples at the rig or core yard, with or without signal.",
  },
  {
    where: "Phone and web",
    title: "QA/QC",
    text: "Checks the evidence and exceptions for one stage: core and logging, sampling and custody, or the laboratory.",
  },
  {
    where: "Web",
    title: "Laboratory",
    text: "Receives dispatched samples, prepares and assays them, and returns results against the batch.",
  },
  {
    where: "Web and phone",
    title: "Resident / project manager",
    text: "Follows the team’s holes and logs, and the state of the whole chain, without chasing updates.",
  },
] as const;

const status = [
  {
    stage: "Field capture",
    what: "Holes, boxes, runs, logging, photographs, samples and QC, export to CSV",
    state: "Available in the pilot build",
    tone: "now",
  },
  {
    stage: "Accounts and backup",
    what: "Sign-in, encrypted storage, cloud backup and sync between devices",
    state: "Rolling out",
    tone: "soon",
  },
  {
    stage: "Custody and dispatch",
    what: "Recorded hand-overs, dispatch batches and sheets",
    state: "Next",
    tone: "soon",
  },
  {
    stage: "Team workspace",
    what: "Project-manager dashboard, QA/QC review, laboratory view",
    state: "After the field test",
    tone: "later",
  },
] as const;

export default function Home() {
  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-wrap lp-bar">
          <Link href="/" aria-label="CoreChain home">
            <Image
              className="lp-logo"
              src="/branding/corechain-primary-horizontal.svg"
              alt="CoreChain"
              width={150}
              height={42}
              priority
            />
          </Link>
          <nav className="lp-nav" aria-label="Main">
            <a href="#chain">How it works</a>
            <a href="#team">Team</a>
            <a href="#field">Field app</a>
            <Link href="/projects/alberta-drillhole-demo">Sample project</Link>
            <a href="#pilot">Pilot</a>
          </nav>
          <div className="lp-bar-actions">
            <Link className="lp-btn lp-btn-line" href="/login">
              Sign in
            </Link>
            <a className="lp-btn lp-btn-solid lp-hide-small" href="#pilot">
              Request access
            </a>
          </div>
        </div>
      </header>

      <main>
        <div className="lp-wrap lp-hero">
          <div>
            <p className="lp-kicker">
              Core logging and sample custody for exploration teams
            </p>
            <h1>Core logging you can defend.</h1>
            <p className="lp-lede">
              CoreChain is an offline-first field app and team workspace. Log,
              photograph and sample core at the rig, keep the chain of custody
              to the laboratory, and hold every record to its depth, its author
              and its version.
            </p>
            <div className="lp-cta">
              <a className="lp-btn lp-btn-solid" href="#pilot">
                Request pilot access
              </a>
              <a className="lp-btn lp-btn-line" href="#chain">
                See how the chain works
              </a>
            </div>
            <ul className="lp-facts">
              <li>Works with no signal</li>
              <li>Encrypted on the device</li>
              <li>Every record tied to its depth</li>
            </ul>
          </div>

          <figure className="lp-phone-figure">
            <div
              className="lp-phone"
              role="img"
              aria-label="Illustration of the field app's hole screen"
            >
              <div className="lp-screen">
                <div className="lp-s-top">
                  <span>09:41</span>
                  <span>Saved on this phone</span>
                </div>
                <div className="lp-s-hole">
                  <b>DH-014</b>
                  <span className="lp-s-pill">Drilling</span>
                </div>
                <div className="lp-s-sub">
                  Copper–gold prospect · 240 m planned
                </div>
                <div className="lp-s-card">
                  <div className="lp-s-meter-h">
                    <span>Core logged</span>
                    <span>96 of 240 m</span>
                  </div>
                  <div className="lp-s-meter">
                    <i />
                  </div>
                </div>
                <div className="lp-s-btn">＋ Log next interval</div>
                <div className="lp-s-chips-h">KNOWN DEPTHS</div>
                <div className="lp-s-chips">
                  <span>Box end · 99 m</span>
                  <span>Run end · 100.5 m</span>
                </div>
                <div className="lp-s-tiles">
                  <div>
                    <b>Core boxes</b>
                    <span>33 boxes</span>
                  </div>
                  <div>
                    <b>Core runs</b>
                    <span>32 runs · 96% rec.</span>
                  </div>
                  <div>
                    <b>Core log</b>
                    <span>41 intervals</span>
                  </div>
                  <div>
                    <b>Samples</b>
                    <span>38 · QC on rate</span>
                  </div>
                </div>
                <div className="lp-s-foot">
                  <i />
                  Last synced 14:32 · nothing waiting
                </div>
              </div>
            </div>
            <figcaption>
              Illustrative screen. The values are examples.
            </figcaption>
          </figure>
        </div>

        <section id="chain" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-head">
              <h2>One chain of evidence, from the hole to the result.</h2>
              <p>
                Each step is recorded where the work happens and stays linked to
                the depth it came from, so anyone can trace a result back to the
                core behind it.
              </p>
            </div>
            <ol className="lp-chain">
              {chain.map((step) => (
                <li className="lp-step" key={step.n}>
                  <span className="lp-step-n">{step.n}</span>
                  <svg
                    width="34"
                    height="34"
                    viewBox="0 0 34 34"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    aria-hidden="true"
                  >
                    {step.icon}
                  </svg>
                  <h3>
                    {step.title}
                    {"tag" in step ? (
                      <em className="lp-tag">{step.tag}</em>
                    ) : null}
                  </h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
            <p className="lp-note">
              Structured around the records the Philippine Mineral Reporting
              Code (PMRC 2020) asks a company to be able to demonstrate:
              recovery, logging, sampling, QA/QC and chain of custody. CoreChain
              supports your reporting; it does not replace the judgement of your
              Accredited Competent Person.
            </p>
            <p className="lp-note">
              <Link className="lp-link" href="/projects/alberta-drillhole-demo">
                See the chain in a read-only sample project
              </Link>{" "}
              built on official open data from the Alberta Geological Survey.
            </p>
          </div>
        </section>

        <section id="team" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-head">
              <h2>Built for the whole team, not only the person logging.</h2>
              <p>Each person sees their own work first.</p>
            </div>
            <div className="lp-roles">
              {roles.map((role) => (
                <article className="lp-role" key={role.title}>
                  <p className="lp-where">{role.where}</p>
                  <h3>{role.title}</h3>
                  <p>{role.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="field" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-head">
              <h2>Made for the field, not the office.</h2>
            </div>
            <div className="lp-field">
              <div>
                <h3>Offline for weeks</h3>
                <p>
                  The app keeps working with no signal for up to 30 days after
                  you last connect, and warns you before that runs out. Your
                  data stays readable on the phone.
                </p>
              </div>
              <div>
                <h3>Encrypted on the device</h3>
                <p>
                  Records are stored in an encrypted database with the key held
                  in the phone’s secure storage, so a lost phone is not a lost
                  dataset.
                </p>
              </div>
              <div>
                <h3>Built for gloves and glare</h3>
                <p>
                  Large targets, high contrast in sun and shade, light and dark
                  themes, and shortcuts so a depth already entered is never
                  typed twice.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="status" className="lp-section">
          <div className="lp-wrap">
            <div className="lp-head">
              <h2>Where the pilot stands.</h2>
              <p>
                We are building with a small group of exploration teams. This is
                what works today and what is coming.
              </p>
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
                  {status.map((row) => (
                    <tr key={row.stage}>
                      <td>{row.stage}</td>
                      <td>{row.what}</td>
                      <td className={`lp-status lp-status-${row.tone}`}>
                        {row.state}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="pilot" className="lp-section lp-section-last">
          <div className="lp-wrap">
            <div className="lp-pilot">
              <div>
                <h2>Join the pilot.</h2>
                <p>
                  The pilot is by invitation, with a small number of exploration
                  teams. Tell us about your programme and we will set up
                  accounts for your team.
                </p>
              </div>
              <div>
                <AccessRequestForm />
                <p className="lp-signin">
                  Already have an account? <Link href="/login">Sign in</Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <Image
            className="lp-logo-small"
            src="/branding/corechain-primary-horizontal.svg"
            alt="CoreChain"
            width={110}
            height={31}
          />
          <span>Traceability for exploration workflows</span>
        </div>
      </footer>
    </div>
  );
}
