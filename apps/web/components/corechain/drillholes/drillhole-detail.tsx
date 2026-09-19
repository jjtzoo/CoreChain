import Link from "next/link";
import type { Route } from "next";
import {
  ArrowLeft,
  ArrowUpRight,
  Database,
  MapPinned,
  Ruler,
} from "lucide-react";
import type {
  AssayRecord,
  Drillhole,
  GeologicalInterval,
} from "@corechain/domain";
import type { TraceabilityDemo } from "@/lib/demo/traceability-fixture";

type DrillholeDetailProps = {
  projectId: string;
  drillhole: Drillhole;
  intervals: readonly GeologicalInterval[];
  assays: readonly AssayRecord[];
  traceabilityDemo?: TraceabilityDemo;
};

function recorded(value: string | number | null, suffix = "") {
  return value === null ? "Not recorded" : `${value}${suffix}`;
}

function metres(value: number | null) {
  return value === null ? "Not recorded" : `${value.toFixed(1)} m`;
}

function coordinate(value: number | null, digits: number) {
  return value === null ? "Not recorded" : value.toFixed(digits);
}

function drillholeRegisterHref(projectId: string): Route {
  return `/projects/${projectId}/drillholes` as Route;
}

function sampleTraceHref(projectId: string, sampleId: string): Route {
  return `/projects/${projectId}/samples/${sampleId}` as Route;
}

export function DrillholeDetail({
  projectId,
  drillhole,
  intervals,
  assays,
  traceabilityDemo,
}: DrillholeDetailProps) {
  const sortedIntervals = [...intervals].sort(
    (left, right) => left.fromM - right.fromM,
  );
  const uniqueSampleCount = new Set(
    assays.flatMap((assay) =>
      assay.sampleId === null ? [] : [assay.sampleId],
    ),
  ).size;
  const laboratories = [
    ...new Set(
      assays.flatMap((assay) => (assay.laboratory ? [assay.laboratory] : [])),
    ),
  ];

  return (
    <div className="drillhole-detail">
      <Link className="back-link" href={drillholeRegisterHref(projectId)}>
        <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.5} />
        Back to drillhole register
      </Link>

      <header className="detail-header">
        <div>
          <p className="page-kicker">Public source drillhole</p>
          <h1>{drillhole.name}</h1>
          <p>
            AGS source record {drillhole.provenance.sourceId} from source group{" "}
            {drillhole.provenance.sourceGroup}.
          </p>
        </div>
        <a
          className="source-link"
          href="https://ags.aer.ca/publications/all-publications/dig-2024-0022"
          rel="noreferrer"
          target="_blank"
        >
          View public source
          <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
        </a>
      </header>

      <section className="source-notice" aria-label="Source data notice">
        <Database aria-hidden="true" size={18} strokeWidth={1.5} />
        <p>
          The published dataset does not identify planned versus actual drilling
          fields. CoreChain keeps both columns as Not recorded and shows the
          source-reported values separately.
        </p>
      </section>

      <section
        className="detail-grid detail-grid-top"
        aria-label="Drillhole record"
      >
        <article className="detail-panel detail-panel-major">
          <div className="panel-heading">
            <Ruler aria-hidden="true" size={18} strokeWidth={1.5} />
            <div>
              <h2>Drilling record</h2>
              <p>Values directly available in the public source.</p>
            </div>
          </div>
          <dl className="detail-facts">
            <div>
              <dt>Drill type</dt>
              <dd>{recorded(drillhole.drillType)}</dd>
            </div>
            <div>
              <dt>Drill date</dt>
              <dd>{recorded(drillhole.drillDate)}</dd>
            </div>
            <div>
              <dt>Reported total depth</dt>
              <dd>{metres(drillhole.finalDepthM)}</dd>
            </div>
            <div>
              <dt>Reported azimuth</dt>
              <dd>{recorded(drillhole.reportedAzimuthDeg, " degrees")}</dd>
            </div>
            <div>
              <dt>Reported inclination</dt>
              <dd>{recorded(drillhole.reportedInclinationDeg, " degrees")}</dd>
            </div>
            <div>
              <dt>Contractor</dt>
              <dd>{recorded(drillhole.contractor)}</dd>
            </div>
          </dl>
        </article>

        <article className="detail-panel detail-panel-major">
          <div className="panel-heading">
            <MapPinned aria-hidden="true" size={18} strokeWidth={1.5} />
            <div>
              <h2>Location and collar details</h2>
              <p>{drillhole.location.coordinateReferenceSystem}</p>
            </div>
          </div>
          <dl className="detail-facts">
            <div>
              <dt>Longitude</dt>
              <dd>{coordinate(drillhole.location.longitude, 6)}</dd>
            </div>
            <div>
              <dt>Latitude</dt>
              <dd>{coordinate(drillhole.location.latitude, 6)}</dd>
            </div>
            <div>
              <dt>Easting</dt>
              <dd>{coordinate(drillhole.location.easting, 1)}</dd>
            </div>
            <div>
              <dt>Northing</dt>
              <dd>{coordinate(drillhole.location.northing, 1)}</dd>
            </div>
            <div>
              <dt>Ground elevation</dt>
              <dd>{metres(drillhole.location.groundElevationM)}</dd>
            </div>
            <div>
              <dt>Hole diameter</dt>
              <dd>{recorded(drillhole.diameter)}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section
        className="detail-panel comparison-panel"
        aria-labelledby="comparison-title"
      >
        <div className="panel-heading">
          <div>
            <h2 id="comparison-title">Planned and actual record</h2>
            <p>
              Separate fields are reserved rather than inferred from the source.
            </p>
          </div>
        </div>
        <div className="comparison-wrap" tabIndex={0}>
          <table className="comparison-table">
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Planned</th>
                <th scope="col">Actual</th>
                <th scope="col">Source-reported</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Collar location</th>
                <td>Not recorded</td>
                <td>Not recorded</td>
                <td>
                  E {coordinate(drillhole.location.easting, 1)}, N{" "}
                  {coordinate(drillhole.location.northing, 1)}
                </td>
              </tr>
              <tr>
                <th scope="row">Azimuth</th>
                <td>Not recorded</td>
                <td>Not recorded</td>
                <td>{recorded(drillhole.reportedAzimuthDeg, " degrees")}</td>
              </tr>
              <tr>
                <th scope="row">Inclination</th>
                <td>Not recorded</td>
                <td>Not recorded</td>
                <td>
                  {recorded(drillhole.reportedInclinationDeg, " degrees")}
                </td>
              </tr>
              <tr>
                <th scope="row">Final depth</th>
                <td>Not recorded</td>
                <td>Not recorded</td>
                <td>{metres(drillhole.finalDepthM)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="detail-grid detail-grid-evidence">
        <article
          className="detail-panel interval-panel"
          aria-labelledby="intervals-title"
        >
          <div className="panel-heading">
            <div>
              <h2 id="intervals-title">Geological intervals</h2>
              <p>
                {sortedIntervals.length} linked source intervals by downhole
                depth.
              </p>
            </div>
          </div>
          {sortedIntervals.length > 0 ? (
            <ol className="interval-list">
              {sortedIntervals.map((interval) => (
                <li key={interval.id}>
                  <div className="interval-depth">
                    {interval.fromM.toFixed(1)} to {interval.toM.toFixed(1)} m
                  </div>
                  <div>
                    <strong>{recorded(interval.rockType)}</strong>
                    <span>{recorded(interval.lithologicalUnit)}</span>
                    <p>{recorded(interval.description)}</p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="inline-empty">
              No linked interval records were imported.
            </div>
          )}
        </article>

        <article
          className="detail-panel assay-panel"
          aria-labelledby="assay-title"
        >
          <div className="panel-heading">
            <div>
              <h2 id="assay-title">Assay availability</h2>
              <p>
                Imported laboratory records are available for later matching and
                review.
              </p>
            </div>
          </div>
          <dl className="assay-summary">
            <div>
              <dt>Source assay records</dt>
              <dd>{assays.length}</dd>
            </div>
            <div>
              <dt>Unique source sample IDs</dt>
              <dd>{uniqueSampleCount}</dd>
            </div>
            <div>
              <dt>Laboratory</dt>
              <dd>
                {laboratories.length > 0
                  ? laboratories.join(", ")
                  : "Not recorded"}
              </dd>
            </div>
          </dl>
          <p className="assay-boundary">
            Sample matching, dispatch history, and QA/QC review are not included
            in this public source. They will be added only as labelled synthetic
            demonstration records.
          </p>
        </article>
      </section>

      {traceabilityDemo ? (
        <section
          className="drillhole-trace-link"
          aria-labelledby="traceability-link-title"
        >
          <div>
            <p className="page-kicker">Traceability demonstration</p>
            <h2 id="traceability-link-title">
              Follow the linked sample beyond the source record.
            </h2>
            <p>
              The core box, sample handling, custody events, and dispatch are
              synthetic demonstration data. The selected drillhole, interval,
              and source sample ID remain public-source references.
            </p>
          </div>
          <Link
            className="primary-action"
            href={sampleTraceHref(projectId, traceabilityDemo.sample.id)}
          >
            Open sample trace
            <ArrowUpRight aria-hidden="true" size={16} strokeWidth={1.5} />
          </Link>
        </section>
      ) : null}

      <section className="provenance-panel" aria-labelledby="provenance-title">
        <Database aria-hidden="true" size={18} strokeWidth={1.5} />
        <div>
          <h2 id="provenance-title">Source provenance</h2>
          <p>
            Imported from {drillhole.provenance.sourceTable}. AGS ID{" "}
            {drillhole.provenance.sourceId}; source group{" "}
            {drillhole.provenance.sourceGroup}. Original source values,
            including missing-value markers, are retained in the import record.
          </p>
        </div>
      </section>
    </div>
  );
}
