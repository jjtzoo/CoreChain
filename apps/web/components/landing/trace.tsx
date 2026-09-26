import { laboratory, qaqc, sampleStory } from "./content";

export function SampleStory() {
  return (
    <section id="sample" className="lp-section">
      <div className="lp-wrap lp-split">
        <div className="lp-head lp-split-copy">
          <p className="lp-eyebrow">Traceability</p>
          <h2>{sampleStory.title}</h2>
          <p>{sampleStory.intro}</p>
          <p className="lp-note">{sampleStory.note}</p>
        </div>
        <figure className="lp-panel-figure">
          <div className="lp-panel">
            <div className="lp-panel-head">
              <div>
                <p className="lp-panel-id">{sampleStory.number}</p>
                <p className="lp-panel-sub">{sampleStory.sub}</p>
              </div>
            </div>
            <ol className="lp-timeline">
              {sampleStory.rows.map((row) => (
                <li key={row.label}>
                  <span className="lp-timeline-label">{row.label}</span>
                  <span className="lp-timeline-value">{row.value}</span>
                </li>
              ))}
            </ol>
          </div>
          <figcaption>{sampleStory.caption}</figcaption>
        </figure>
      </div>
    </section>
  );
}

function UploadPanel({
  label,
  file,
  ready,
  problems,
}: {
  label: string;
  file: string;
  ready: string;
  problems: readonly string[];
}) {
  const clean = problems.length === 0;
  return (
    <div className="lp-panel lp-upload">
      <div className="lp-upload-head">
        <span className="lp-panel-label">{label}</span>
        <span className={`lp-badge ${clean ? "lp-badge-ok" : "lp-badge-warn"}`}>
          {clean ? "No problems" : `${problems.length} problem rows`}
        </span>
      </div>
      <p className="lp-file">{file}</p>
      <p className="lp-upload-ready">{ready}</p>
      {clean ? null : (
        <ul className="lp-upload-problems">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Laboratory() {
  return (
    <section id="laboratory" className="lp-section">
      <div className="lp-wrap lp-split">
        <div className="lp-split-copy">
          <div className="lp-head">
            <p className="lp-eyebrow">Custody and laboratory</p>
            <h2>{laboratory.title}</h2>
            <p>{laboratory.intro}</p>
          </div>
          <ol className="lp-steps">
            {laboratory.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <figure className="lp-panel-figure">
          <div className="lp-uploads">
            <UploadPanel {...laboratory.first} />
            <UploadPanel {...laboratory.second} />
          </div>
          <figcaption>{laboratory.caption}</figcaption>
        </figure>
      </div>
    </section>
  );
}

export function Qaqc() {
  return (
    <section id="qaqc" className="lp-section">
      <div className="lp-wrap">
        <div className="lp-head">
          <p className="lp-eyebrow">QA/QC</p>
          <h2>{qaqc.title}</h2>
          <p>{qaqc.intro}</p>
        </div>
        <ol className="lp-stages">
          {qaqc.stages.map((stage) => (
            <li key={stage.n}>
              <span className="lp-flow-n">{stage.n}</span>
              <h3>{stage.title}</h3>
              <p>{stage.text}</p>
            </li>
          ))}
        </ol>

        <div className="lp-qaqc">
          <figure className="lp-panel-figure">
            <div className="lp-panel">
              <div className="lp-panel-head">
                <div>
                  <p className="lp-panel-id">{qaqc.hole}</p>
                  <p className="lp-panel-sub">{qaqc.holeSub}</p>
                </div>
                <span className="lp-badge lp-badge-bad">
                  {qaqc.exceptions.length} open
                </span>
              </div>
              <p className="lp-panel-label">Open exceptions</p>
              <ul className="lp-exceptions">
                {qaqc.exceptions.map((exception) => (
                  <li key={exception.title}>
                    <b>{exception.title}</b>
                    <span>{exception.evidence}</span>
                  </li>
                ))}
              </ul>
              <div className="lp-decision" aria-hidden="true">
                <span>Record decision</span>
                <i>Accept</i>
                <i>Hold</i>
                <i>Reject</i>
              </div>
            </div>
            <figcaption>{qaqc.caption}</figcaption>
          </figure>

          <div className="lp-checks">
            {qaqc.checks.map((check) => (
              <div className="lp-check" key={check.kind}>
                <h3>{check.kind}</h3>
                <p>{check.rule}</p>
                <dl>
                  <div>
                    <dt>First file</dt>
                    <dd>
                      <span className="lp-badge lp-badge-bad">Failed</span>
                      {check.before}
                    </dd>
                  </div>
                  <div>
                    <dt>Re-assay</dt>
                    <dd>
                      <span className="lp-badge lp-badge-ok">Passed</span>
                      {check.after}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
            <p className="lp-note">{qaqc.also}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
