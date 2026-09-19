import Link from "next/link";
import type { Route } from "next";
import {
  ArrowLeft,
  ArrowUpRight,
  Box,
  ClipboardCheck,
  FileWarning,
  PackageCheck,
  TestTubeDiagonal,
} from "lucide-react";
import type { TraceabilityDemo } from "@/lib/demo/traceability-fixture";

type TraceabilityRecordProps = {
  projectId: string;
  demo: TraceabilityDemo;
};

function sampleHref(projectId: string, sampleId: string): Route {
  return `/projects/${projectId}/samples/${sampleId}` as Route;
}

function samplesHref(projectId: string): Route {
  return `/projects/${projectId}/samples` as Route;
}

function dispatchesHref(projectId: string): Route {
  return `/projects/${projectId}/dispatches` as Route;
}

function assaysHref(projectId: string): Route {
  return `/projects/${projectId}/assays` as Route;
}

function drillholeHref(projectId: string, drillholeName: string): Route {
  const sourceIds: Record<string, string> = {
    "200134-006": "ags-drillhole-2424",
  };

  return `/projects/${projectId}/drillholes/${sourceIds[drillholeName]}` as Route;
}

function displayTimestamp(value: string) {
  const [date, time] = value.split("T");
  return `${date} ${time.slice(0, 5)}`;
}

export function SyntheticDataNotice() {
  return (
    <section
      className="synthetic-notice"
      aria-label="Synthetic demonstration data notice"
    >
      <FileWarning aria-hidden="true" size={18} strokeWidth={1.5} />
      <div>
        <strong>Synthetic demonstration data</strong>
        <p>
          Core-box, custody, and dispatch details below are examples created for
          the CoreChain workflow. The linked drillhole, interval, and original
          sample ID are public source data.
        </p>
      </div>
    </section>
  );
}

export function SampleRegister({ projectId, demo }: TraceabilityRecordProps) {
  return (
    <section
      className="traceability-register"
      aria-labelledby="sample-register-title"
    >
      <div className="register-toolbar">
        <div>
          <p className="page-kicker">Sample traceability</p>
          <h1 id="sample-register-title">
            Follow one sample through the working chain.
          </h1>
          <p>
            This pilot record connects one real source interval to a labelled
            synthetic core-box, custody, and dispatch history.
          </p>
        </div>
        <div className="register-source-label">1 demonstration record</div>
      </div>

      <SyntheticDataNotice />

      <div className="traceability-table-wrap" tabIndex={0}>
        <table className="traceability-table">
          <thead>
            <tr>
              <th scope="col">CoreChain sample</th>
              <th scope="col">Source link</th>
              <th scope="col">Core box</th>
              <th scope="col">Current state</th>
              <th scope="col">
                <span className="visually-hidden">
                  Open traceability record
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <Link
                  className="record-link"
                  href={sampleHref(projectId, demo.sample.id)}
                >
                  {demo.sample.projectSampleId}
                </Link>
                <span>Primary sample</span>
              </th>
              <td>
                <Link
                  className="trace-link"
                  href={drillholeHref(projectId, demo.sample.drillholeName)}
                >
                  {demo.sample.drillholeName}
                </Link>
                <span>
                  {demo.sample.fromM.toFixed(2)} to {demo.sample.toM.toFixed(2)}{" "}
                  m; source sample {demo.sample.sourceSampleId}
                </span>
              </td>
              <td>
                <strong>{demo.coreBox.boxNumber}</strong>
                <span>
                  {demo.coreBox.fromM.toFixed(2)} to{" "}
                  {demo.coreBox.toM.toFixed(2)} m
                </span>
              </td>
              <td>
                <span className="completeness-status">
                  {demo.sample.status}
                </span>
                <span>{demo.custodyEvents.length} custody events recorded</span>
              </td>
              <td>
                <Link
                  className="row-action"
                  href={sampleHref(projectId, demo.sample.id)}
                  aria-label={`Open sample ${demo.sample.projectSampleId}`}
                >
                  <ArrowUpRight
                    aria-hidden="true"
                    size={17}
                    strokeWidth={1.5}
                  />
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SampleTraceabilityRecord({
  projectId,
  demo,
}: TraceabilityRecordProps) {
  return (
    <div className="traceability-detail">
      <Link className="back-link" href={samplesHref(projectId)}>
        <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.5} />
        Back to samples
      </Link>

      <header className="detail-header">
        <div>
          <p className="page-kicker">Synthetic sample trace</p>
          <h1>{demo.sample.projectSampleId}</h1>
          <p>
            A workflow demonstration linked to public drillhole{" "}
            {demo.sample.drillholeName}, source sample{" "}
            {demo.sample.sourceSampleId}.
          </p>
        </div>
        <Link
          className="source-link"
          href={drillholeHref(projectId, demo.sample.drillholeName)}
        >
          View source drillhole
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </Link>
      </header>

      <SyntheticDataNotice />

      <section
        className="traceability-link-panel"
        aria-labelledby="evidence-link-title"
      >
        <div>
          <p className="page-kicker">Evidence link</p>
          <h2 id="evidence-link-title">
            Source interval and synthetic handling record
          </h2>
        </div>
        <dl>
          <div>
            <dt>Public source interval</dt>
            <dd>
              {demo.sourceInterval.fromM.toFixed(2)} to{" "}
              {demo.sourceInterval.toM.toFixed(2)} m
            </dd>
          </div>
          <div>
            <dt>Linked source interval ID</dt>
            <dd>AGS {demo.sourceInterval.provenance.sourceId}</dd>
          </div>
          <div>
            <dt>Source sample ID</dt>
            <dd>{demo.sample.sourceSampleId}</dd>
          </div>
          <div>
            <dt>Source assay records available</dt>
            <dd>{demo.sourceAssayRecordCount}</dd>
          </div>
        </dl>
      </section>

      <section className="detail-grid traceability-top-grid">
        <article className="detail-panel">
          <div className="panel-heading">
            <Box aria-hidden="true" size={18} strokeWidth={1.5} />
            <div>
              <h2>Core box</h2>
              <p>Synthetic record attached to the selected public interval.</p>
            </div>
          </div>
          <dl className="detail-facts">
            <div>
              <dt>Box number</dt>
              <dd>{demo.coreBox.boxNumber}</dd>
            </div>
            <div>
              <dt>Depth range</dt>
              <dd>
                {demo.coreBox.fromM.toFixed(2)} to {demo.coreBox.toM.toFixed(2)}{" "}
                m
              </dd>
            </div>
            <div>
              <dt>Received status</dt>
              <dd>{demo.coreBox.receivedStatus}</dd>
            </div>
            <div>
              <dt>Recorded location</dt>
              <dd>{demo.coreBox.location}</dd>
            </div>
          </dl>
        </article>

        <article className="detail-panel">
          <div className="panel-heading">
            <TestTubeDiagonal aria-hidden="true" size={18} strokeWidth={1.5} />
            <div>
              <h2>Sample identity</h2>
              <p>
                The CoreChain ID stays distinct from the original source ID.
              </p>
            </div>
          </div>
          <dl className="detail-facts">
            <div>
              <dt>CoreChain sample ID</dt>
              <dd>{demo.sample.projectSampleId}</dd>
            </div>
            <div>
              <dt>Original source sample ID</dt>
              <dd>{demo.sample.sourceSampleId}</dd>
            </div>
            <div>
              <dt>Sample interval</dt>
              <dd>
                {demo.sample.fromM.toFixed(2)} to {demo.sample.toM.toFixed(2)} m
              </dd>
            </div>
            <div>
              <dt>Current state</dt>
              <dd>{demo.sample.status}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section
        className="detail-panel custody-panel"
        aria-labelledby="custody-title"
      >
        <div className="panel-heading">
          <ClipboardCheck aria-hidden="true" size={18} strokeWidth={1.5} />
          <div>
            <h2 id="custody-title">Custody history</h2>
            <p>Append-only synthetic events in chronological order.</p>
          </div>
        </div>
        <ol className="custody-timeline">
          {demo.custodyEvents.map((event) => (
            <li key={event.id}>
              <time dateTime={event.occurredAt}>
                {displayTimestamp(event.occurredAt)}
              </time>
              <div>
                <strong>{event.eventType}</strong>
                <span>
                  {event.handledBy} at {event.location}
                </span>
                <p>{event.note}</p>
                <small>Evidence: {event.evidence}</small>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="dispatch-link-panel" aria-labelledby="dispatch-title">
        <PackageCheck aria-hidden="true" size={19} strokeWidth={1.5} />
        <div>
          <p className="page-kicker">Dispatch</p>
          <h2 id="dispatch-title">{demo.dispatch.dispatchNumber}</h2>
          <p>
            {demo.dispatch.status}. Laboratory shown from the linked source
            assay: {demo.dispatch.laboratory}
          </p>
        </div>
        <Link className="primary-action" href={dispatchesHref(projectId)}>
          View dispatch
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </Link>
      </section>

      <section
        className="drillhole-trace-link"
        aria-labelledby="assay-link-title"
      >
        <div>
          <p className="page-kicker">Assay match</p>
          <h2 id="assay-link-title">
            See the public assay rows and QA/QC example
          </h2>
          <p>
            The next step links the nine public source assay rows to this sample
            while keeping the synthetic QA/QC example visibly separate.
          </p>
        </div>
        <Link className="primary-action" href={assaysHref(projectId)}>
          View assays and QA/QC
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </Link>
      </section>
    </div>
  );
}

export function DispatchRegister({ projectId, demo }: TraceabilityRecordProps) {
  return (
    <section
      className="traceability-register"
      aria-labelledby="dispatch-register-title"
    >
      <div className="register-toolbar">
        <div>
          <p className="page-kicker">Dispatch register</p>
          <h1 id="dispatch-register-title">
            One dispatch, with its sample hand-off visible.
          </h1>
          <p>
            This is an explicitly synthetic workflow record that demonstrates
            how a dispatch will later reconcile against laboratory results.
          </p>
        </div>
        <div className="register-source-label">1 synthetic dispatch</div>
      </div>

      <SyntheticDataNotice />

      <div className="traceability-table-wrap" tabIndex={0}>
        <table className="traceability-table">
          <thead>
            <tr>
              <th scope="col">Dispatch</th>
              <th scope="col">Samples</th>
              <th scope="col">Laboratory</th>
              <th scope="col">Hand-off</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{demo.dispatch.dispatchNumber}</th>
              <td>
                <Link
                  className="trace-link"
                  href={sampleHref(projectId, demo.sample.id)}
                >
                  {demo.sample.projectSampleId}
                </Link>
              </td>
              <td>{demo.dispatch.laboratory}</td>
              <td>{displayTimestamp(demo.dispatch.handedOffAt)}</td>
              <td>
                <span className="completeness-status">
                  {demo.dispatch.status}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
