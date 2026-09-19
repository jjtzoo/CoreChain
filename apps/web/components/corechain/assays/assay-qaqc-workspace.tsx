import Link from "next/link";
import type { Route } from "next";
import {
  ArrowUpRight,
  ClipboardCheck,
  FileWarning,
  FlaskConical,
  Link2,
  TestTubeDiagonal,
} from "lucide-react";
import type { AssayQaqcDemo } from "@/lib/demo/assay-qaqc-fixture";

type AssayQaqcWorkspaceProps = {
  projectId: string;
  demo: AssayQaqcDemo;
};

function sampleHref(projectId: string): Route {
  return `/projects/${projectId}/samples/sample-cc-demo-5739` as Route;
}

function sourceResultLabel(value: string, unit: string) {
  return `${value} ${unit === "pct" ? "%" : "ppm"}`;
}

export function AssayQaqcWorkspace({
  projectId,
  demo,
}: AssayQaqcWorkspaceProps) {
  const reportedValueCount = demo.assayMatches.reduce(
    (count, match) => count + match.reportedValues.length,
    0,
  );

  return (
    <section
      className="assay-workspace"
      aria-labelledby="assay-workspace-title"
    >
      <header className="register-toolbar">
        <div>
          <p className="page-kicker">Assay matching and QA/QC</p>
          <h1 id="assay-workspace-title">
            Keep laboratory results tied to the sample that left site.
          </h1>
          <p>
            Public source assay rows are matched to one synthetic CoreChain
            sample. QA/QC controls below only demonstrate how review work can be
            visible.
          </p>
        </div>
        <div className="register-source-label">
          {demo.assayMatches.length} matched source rows
        </div>
      </header>

      <section
        className="assay-boundary-notice"
        aria-label="Data boundary notice"
      >
        <FileWarning aria-hidden="true" size={18} strokeWidth={1.5} />
        <div>
          <strong>
            Results and control examples are intentionally separate.
          </strong>
          <p>
            Values in the matched-results register come directly from the public
            source. Standard, blank, duplicate, and review details are synthetic
            examples; CoreChain makes no technical interpretation of either.
          </p>
        </div>
      </section>

      <section className="assay-match-band" aria-label="Sample result match">
        <Link2 aria-hidden="true" size={21} strokeWidth={1.5} />
        <div>
          <span>Matched sample</span>
          <strong>{demo.sampleId}</strong>
        </div>
        <div>
          <span>Original source sample</span>
          <strong>{demo.sourceSampleId}</strong>
        </div>
        <div>
          <span>Reported values</span>
          <strong>{reportedValueCount}</strong>
        </div>
        <Link className="source-link" href={sampleHref(projectId)}>
          View custody record
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </Link>
      </section>

      <section
        className="assay-section"
        aria-labelledby="matched-results-title"
      >
        <div className="section-heading">
          <div>
            <p className="page-kicker">Public source data</p>
            <h2 id="matched-results-title">Matched laboratory result rows</h2>
          </div>
          <p>
            Each row is matched by original sample ID, drillhole, and interval.
            Reported values retain the source text, including less-than values.
          </p>
        </div>

        <div className="assay-table-wrap" tabIndex={0}>
          <table className="assay-table">
            <thead>
              <tr>
                <th scope="col">Match</th>
                <th scope="col">Source assay</th>
                <th scope="col">Laboratory record</th>
                <th scope="col">Reported values</th>
              </tr>
            </thead>
            <tbody>
              {demo.assayMatches.map((match) => (
                <tr key={match.id}>
                  <th scope="row">
                    <span className="match-state">Matched</span>
                    <strong>{match.corechainSampleId}</strong>
                    <span>Source sample {match.sourceSampleId}</span>
                  </th>
                  <td className="numeric-cell">
                    AGS {match.sourceAssayId}
                    <span>
                      {match.fromM.toFixed(2)} to {match.toM.toFixed(2)} m
                    </span>
                  </td>
                  <td>
                    <strong>{match.laboratory ?? "Not recorded"}</strong>
                    <span>
                      {match.methodCode ?? "Not recorded"}; certificate{" "}
                      {match.certificateDate ?? "Not recorded"}
                    </span>
                  </td>
                  <td>
                    {match.reportedValues.length > 0 ? (
                      <ul className="assay-values">
                        {match.reportedValues.map((result) => (
                          <li key={`${match.id}-${result.analyte}`}>
                            <span>{result.analyte}</span>
                            <strong>
                              {sourceResultLabel(
                                result.reportedValue,
                                result.unit,
                              )}
                            </strong>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="source-empty">
                        No result value recorded in this source row.
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className="qaqc-grid"
        aria-label="Synthetic QA QC review demonstration"
      >
        <article className="qaqc-controls-panel">
          <div className="panel-heading">
            <FlaskConical aria-hidden="true" size={18} strokeWidth={1.5} />
            <div>
              <h2>QA/QC control register</h2>
              <p>Synthetic examples only. No acceptance rule is implied.</p>
            </div>
          </div>
          <ol className="qaqc-control-list">
            {demo.controls.map((control) => (
              <li key={control.id}>
                <div>
                  <span className="synthetic-flag">Synthetic</span>
                  <strong>{control.controlType}</strong>
                  <p>{control.observation}</p>
                </div>
                <div>
                  <span>{control.demonstrationRule}</span>
                  <strong
                    className={`qaqc-status ${control.status === "Flagged for review" ? "is-flagged" : ""}`}
                  >
                    {control.status}
                  </strong>
                </div>
              </li>
            ))}
          </ol>
        </article>

        <article className="qaqc-review-panel">
          <ClipboardCheck aria-hidden="true" size={21} strokeWidth={1.5} />
          <p className="page-kicker">Synthetic review state</p>
          <h2>{demo.review.status}</h2>
          <p>{demo.review.decision}</p>
          <div className="review-note">
            <TestTubeDiagonal aria-hidden="true" size={16} strokeWidth={1.5} />
            <span>{demo.review.note}</span>
          </div>
        </article>
      </section>
    </section>
  );
}
