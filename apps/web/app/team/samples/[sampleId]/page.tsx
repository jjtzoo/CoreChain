import {
  CODE_CATEGORY_LABELS,
  CUSTODY_LABELS,
  custodyTimeline,
  sampleProgress,
  type CodeCategory,
  type CustodyEventType,
  type FieldCustodyEvent,
} from "@corechain/domain";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/session";

// The sample trace: one sample's whole chain on one page, from the hole and
// depth it came from (with the geology logged there and its core photos),
// through every custody step, to the laboratory's results. Everything is read
// from the records the phone and the laboratory already keep; nothing here is
// entered by hand.

function formatDay(iso: string): string {
  return iso.slice(0, 10);
}

function formatWhen(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const INTERVAL_FIELDS: Array<{ category: CodeCategory; key: string }> = [
  { category: "lithology", key: "lithology" },
  { category: "alteration_type", key: "alterationType" },
  { category: "alteration_intensity", key: "alterationIntensity" },
  { category: "mineral", key: "mineral" },
  { category: "mineral_style", key: "mineralStyle" },
  { category: "weathering", key: "weathering" },
  { category: "structure_type", key: "structureType" },
];

export default async function SampleTracePage({
  params,
}: {
  params: Promise<{ sampleId: string }>;
}) {
  const session = await requireProjectManager();
  const { sampleId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sampleId)) notFound();

  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? null;
  if (!organizationId) notFound();

  const sample = await prisma.sample.findFirst({
    where: { id: sampleId, organizationId, deletedAt: null },
    include: {
      project: { select: { name: true } },
      drillhole: { select: { id: true, holeId: true, actualFinalDepthM: true } },
      parent: { select: { id: true, sampleNumber: true } },
      duplicates: { where: { deletedAt: null }, select: { id: true, sampleNumber: true } },
      custodyEvents: { orderBy: { occurredAt: "asc" } },
      dispatchSamples: {
        where: { deletedAt: null },
        include: {
          dispatch: {
            select: {
              id: true,
              dispatchNumber: true,
              laboratory: true,
              handoverAt: true,
              preparationRequest: true,
              resultsReturnedAt: true,
              deletedAt: true,
            },
          },
        },
      },
      assayResults: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!sample) notFound();

  const hasDepth = sample.fromM !== null && sample.toM !== null;
  const overlap = hasDepth
    ? { drillholeId: sample.drillholeId, deletedAt: null, fromM: { lt: sample.toM! }, toM: { gt: sample.fromM! } }
    : null;
  const [intervals, boxes, photos, codes] = overlap
    ? await Promise.all([
        prisma.logInterval.findMany({ where: overlap, orderBy: { fromM: "asc" } }),
        prisma.coreBox.findMany({ where: overlap, orderBy: { fromM: "asc" } }),
        prisma.photo.findMany({ where: overlap, orderBy: { fromM: "asc" } }),
        prisma.codeLibraryEntry.findMany({
          where: { projectId: sample.projectId, deletedAt: null },
          select: { category: true, code: true, description: true },
        }),
      ])
    : [[], [], [], []];

  const personIds = new Set<string>([
    sample.createdBy,
    ...sample.custodyEvents.map((e) => e.handledBy),
    ...sample.assayResults.map((r) => r.enteredBy),
  ]);
  const people = await prisma.user.findMany({
    where: { id: { in: [...personIds] } },
    select: { id: true, name: true },
  });
  const nameById = new Map(people.map((p) => [p.id, p.name]));
  // Custody steps store who did them as a name (the phone's field) or, for
  // older rows, an account id.
  const who = (value: string) => nameById.get(value) ?? value;

  const describe = (category: CodeCategory, code: string | null) => {
    if (!code) return null;
    const entry = codes.find((c) => c.category === category && c.code === code);
    return entry ? `${code} (${entry.description})` : code;
  };

  const events: FieldCustodyEvent[] = sample.custodyEvents.map((e) => ({
    id: e.id,
    projectId: e.projectId,
    sampleId: e.sampleId,
    type: e.eventType as CustodyEventType,
    occurredAt: e.occurredAt.toISOString(),
    handledBy: e.handledBy,
    location: e.location,
    recipient: e.recipient,
    note: e.note,
    dispatchId: e.dispatchId,
    correctsEventId: e.correctsEventId,
    createdAt: e.createdAt.toISOString(),
  }));
  const timeline = custodyTimeline(events);
  const dispatchNumberById = new Map(
    sample.dispatchSamples.map((ds) => [ds.dispatch.id, ds.dispatch.dispatchNumber]),
  );

  const firstResultAt =
    sample.assayResults.length > 0
      ? sample.assayResults
          .map((r) => r.createdAt.toISOString())
          .reduce((a, b) => (a < b ? a : b))
      : null;
  const progress = sampleProgress({ createdAt: sample.createdAt.toISOString() }, events, firstResultAt);
  const lastDone = progress.reduce((last, step, i) => (step.at ? i : last), -1);

  // A later entry for the same element replaces an earlier one.
  const latestByAnalyte = new Map<string, (typeof sample.assayResults)[number]>();
  for (const result of sample.assayResults) {
    const key = result.analyte.toLowerCase();
    if (!latestByAnalyte.has(key)) latestByAnalyte.set(key, result);
  }
  const results = [...latestByAnalyte.values()].sort((a, b) => a.analyte.localeCompare(b.analyte));

  const dispatches = sample.dispatchSamples
    .map((ds) => ds.dispatch)
    .filter((d) => d.deletedAt === null);

  return (
    <>
      <div className="admin-page-header">
        <div>
          <Link href={`/team/holes/${sample.drillhole.id}` as Route} className="admin-link">
            ← {sample.drillhole.holeId}
          </Link>
          <h1 className="trace-title">
            {sample.sampleNumber}
            {sample.sampleType !== "primary" ? (
              <span className="status-pill is-copper">{capitalise(sample.sampleType)} · QC</span>
            ) : null}
          </h1>
          <p>
            {sample.project.name} · hole {sample.drillhole.holeId}
            {hasDepth ? ` · ${sample.fromM}–${sample.toM} m` : ""}
            {" · "}
            <Link
              href={`/team/tags?hole=${sample.drillhole.id}` as Route}
              className="admin-link"
            >
              Print tag
            </Link>
          </p>
        </div>
      </div>

      <section className="admin-card" aria-labelledby="progress-title">
        <h2 id="progress-title" className="sr-only">Progress</h2>
        <ol className="trace-rail">
          {progress.map((step, i) => (
            <li
              key={step.key}
              className={`trace-step${step.at ? " is-done" : i < lastDone ? " is-missing" : ""}`}
            >
              <span className="trace-dot" aria-hidden="true" />
              <span className="trace-step-label">{step.label}</span>
              <span className="trace-step-at">
                {step.at ? formatDay(step.at) : i < lastDone ? "Not recorded" : "Not yet"}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="admin-columns">
        <div className="admin-list-column">
          <section className="admin-card" aria-labelledby="origin-title">
            <div className="admin-card-head">
              <h2 id="origin-title">Where it came from</h2>
            </div>
            {!hasDepth ? (
              <p className="admin-hint" style={{ margin: 0 }}>
                {sample.sampleType === "standard"
                  ? `A standard${sample.standardRef ? `, ${sample.standardRef},` : ""} inserted into ${sample.drillhole.holeId}'s sample sequence. It has no depth of its own.`
                  : sample.sampleType === "blank"
                    ? `A blank inserted into ${sample.drillhole.holeId}'s sample sequence. It has no depth of its own.`
                    : "No depth was recorded for this sample."}
              </p>
            ) : (
              <>
                <div className="trace-facts">
                  <div>
                    <span className="kpi-strip-label">Depth</span>
                    <strong>
                      {sample.fromM}–{sample.toM} m
                    </strong>
                    <span>{((sample.toM ?? 0) - (sample.fromM ?? 0)).toFixed(2)} m long</span>
                  </div>
                  <div>
                    <span className="kpi-strip-label">Core box</span>
                    <strong>
                      {boxes.length > 0 ? boxes.map((b) => `Box ${b.boxNumber}`).join(", ") : "—"}
                    </strong>
                    <span>
                      {boxes.length > 0
                        ? boxes.map((b) => `${b.fromM}–${b.toM} m`).join(", ")
                        : "No box recorded over this depth"}
                    </span>
                  </div>
                  <div>
                    <span className="kpi-strip-label">Core photos</span>
                    <strong>{photos.length}</strong>
                    <span>over this depth</span>
                  </div>
                </div>

                {intervals.length > 0 ? (
                  <div className="queue-table-wrap" style={{ margin: "0 -20px" }}>
                    <table className="queue-table">
                      <thead>
                        <tr>
                          <th>Logged interval</th>
                          <th>Geology</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {intervals.map((interval) => {
                          const row = interval as unknown as Record<string, string | null>;
                          const parts = INTERVAL_FIELDS.map((f) => {
                            const text = describe(f.category, row[f.key]);
                            return text ? `${CODE_CATEGORY_LABELS[f.category]}: ${text}` : null;
                          }).filter(Boolean);
                          if (interval.mineralPercent !== null) {
                            parts.push(`Mineral: ${interval.mineralPercent}%`);
                          }
                          return (
                            <tr key={interval.id}>
                              <td className="queue-table-number">
                                {interval.fromM}–{interval.toM} m
                              </td>
                              <td>{parts.length > 0 ? parts.join(" · ") : "—"}</td>
                              <td style={{ color: "var(--muted)" }}>{interval.notes ?? ""}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="admin-hint" style={{ margin: 0 }}>
                    No logging recorded over this depth yet.
                  </p>
                )}

                {photos.length > 0 ? (
                  <div className="trace-photos">
                    {photos.map((photo) =>
                      photo.storageKey ? (
                        <figure key={photo.id} className="trace-photo">
                          {/* eslint-disable-next-line @next/next/no-img-element -- a private, signed-in file route, not a static asset */}
                          <img
                            src={`/api/photos/${photo.id}/file`}
                            alt={`Core photo, ${photo.boxNumber !== null ? `box ${photo.boxNumber}, ` : ""}${photo.fromM}–${photo.toM} m`}
                            loading="lazy"
                          />
                          <figcaption>
                            {photo.boxNumber !== null ? `Box ${photo.boxNumber} · ` : ""}
                            {photo.fromM}–{photo.toM} m
                          </figcaption>
                        </figure>
                      ) : (
                        <div key={photo.id} className="trace-photo is-pending">
                          <span>
                            {photo.boxNumber !== null ? `Box ${photo.boxNumber} · ` : ""}
                            {photo.fromM}–{photo.toM} m
                          </span>
                          <span>Still on the phone, not backed up yet</span>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section className="admin-card" aria-labelledby="custody-title">
            <div className="admin-card-head">
              <h2 id="custody-title">Chain of custody</h2>
              <span className="admin-count">{timeline.length}</span>
            </div>
            {timeline.length === 0 ? (
              <p className="admin-hint" style={{ margin: 0 }}>
                No custody steps recorded yet.
              </p>
            ) : (
              <ol className="trace-timeline">
                {timeline.map((line) => (
                  <li key={line.id} className={line.voided ? "is-voided" : undefined}>
                    <span className="trace-timeline-when">{formatWhen(line.occurredAt)}</span>
                    <span className="trace-timeline-what">
                      <strong>
                        {CUSTODY_LABELS[line.type]}
                        {line.voided ? " (voided by a later correction)" : ""}
                      </strong>
                      <span>
                        {who(line.handledBy)}
                        {line.recipient ? ` → ${line.recipient}` : ""}
                        {line.location ? ` · ${line.location}` : ""}
                        {line.dispatchId && dispatchNumberById.has(line.dispatchId)
                          ? ` · ${dispatchNumberById.get(line.dispatchId)}`
                          : ""}
                        {line.note ? ` — ${line.note}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <p className="admin-hint" style={{ margin: 0 }}>
              Custody steps are only ever added. A mistake stays on the record
              with the correction that voids it.
            </p>
          </section>

          <section className="admin-card" aria-labelledby="lab-title">
            <div className="admin-card-head">
              <h2 id="lab-title">Laboratory</h2>
            </div>
            {dispatches.length === 0 ? (
              <p className="admin-hint" style={{ margin: 0 }}>
                Not in a dispatch yet.
              </p>
            ) : (
              dispatches.map((dispatch) => (
                <div key={dispatch.id} className="trace-facts">
                  <div>
                    <span className="kpi-strip-label">Dispatch</span>
                    <strong>{dispatch.dispatchNumber}</strong>
                    <span>{dispatch.laboratory}</span>
                  </div>
                  <div>
                    <span className="kpi-strip-label">Handed over</span>
                    <strong>{dispatch.handoverAt ?? "—"}</strong>
                    <span>{dispatch.preparationRequest ?? "No preparation request"}</span>
                  </div>
                  <div>
                    <span className="kpi-strip-label">Results</span>
                    <strong>{dispatch.resultsReturnedAt ? "Complete" : results.length > 0 ? "In progress" : "Not yet"}</strong>
                    <span>
                      {dispatch.resultsReturnedAt
                        ? `Marked complete ${formatDay(dispatch.resultsReturnedAt.toISOString())}`
                        : "Batch still open at the laboratory"}
                    </span>
                  </div>
                </div>
              ))
            )}
            {results.length > 0 ? (
              <div className="queue-table-wrap" style={{ margin: "0 -20px -20px" }}>
                <table className="queue-table">
                  <thead>
                    <tr>
                      <th>Element</th>
                      <th>Result</th>
                      <th>Entered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result) => (
                      <tr key={result.id}>
                        <td className="queue-table-name">{result.analyte}</td>
                        <td className="queue-table-number">
                          {result.belowDetection
                            ? `< detection${result.unit ? ` ${result.unit}` : ""}`
                            : result.value === null
                              ? "—"
                              : `${result.value}${result.unit ? ` ${result.unit}` : ""}`}
                        </td>
                        <td style={{ color: "var(--muted)" }}>
                          {formatDay(result.createdAt.toISOString())} · {who(result.enteredBy)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="admin-sidebar-column">
          <section className="admin-card" aria-labelledby="facts-title">
            <h2 id="facts-title">Sample</h2>
            <div className="admin-status">
              <span className="admin-meta-label">Type</span>
              <span>
                {capitalise(sample.sampleType)}
                {sample.standardRef ? ` · ${sample.standardRef}` : ""}
              </span>
            </div>
            <div className="admin-status">
              <span className="admin-meta-label">Status</span>
              <span>{capitalise(sample.status)}</span>
            </div>
            <div className="admin-status">
              <span className="admin-meta-label">Taken by</span>
              <span>
                {who(sample.createdBy)} · {formatDay(sample.createdAt.toISOString())}
              </span>
            </div>
            {sample.parent ? (
              <div className="admin-status">
                <span className="admin-meta-label">Duplicate of</span>
                <Link href={`/team/samples/${sample.parent.id}` as Route} className="admin-link">
                  {sample.parent.sampleNumber}
                </Link>
              </div>
            ) : null}
            {sample.duplicates.length > 0 ? (
              <div className="admin-status">
                <span className="admin-meta-label">Field duplicate</span>
                <span>
                  {sample.duplicates.map((d, i) => (
                    <span key={d.id}>
                      {i > 0 ? ", " : ""}
                      <Link href={`/team/samples/${d.id}` as Route} className="admin-link">
                        {d.sampleNumber}
                      </Link>
                    </span>
                  ))}
                </span>
              </div>
            ) : null}
            {sample.note ? (
              <div className="admin-status">
                <span className="admin-meta-label">Note</span>
                <span>{sample.note}</span>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </>
  );
}
