import {
  FIELD_DUPLICATE_MAX_DIFFERENCE_PCT,
  STANDARD_FAILURE_SD,
  STANDARD_WARNING_SD,
} from "@corechain/domain";
import type { Route } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { qcReferenceAccess } from "./access";
import {
  QcReferenceEditor,
  type QcReferenceRevision,
  type QcReferenceRow,
} from "./qc-reference-editor";

// E12-4: the team's standards-and-blanks list, shown to the project manager
// (/team/standards) and to QA/QC (/qaqc/standards). The laboratory checks on
// the QA/QC screen compare the control samples' results with these lines.

export async function StandardsPage({
  userId,
  back,
}: {
  userId: string;
  back: { href: Route; label: string };
}) {
  const access = await qcReferenceAccess(userId);

  const header = (
    <div className="admin-page-header">
      <div>
        <Link href={back.href} className="admin-link">
          ← {back.label}
        </Link>
        <h1>Standards and blanks</h1>
        <p>
          The certified values and limits the laboratory results are checked
          against. Each standard or blank a geologist inserts is compared with
          its line here as soon as the laboratory enters its results.
        </p>
      </div>
    </div>
  );

  if (!access.organizationId) {
    return (
      <>
        {header}
        <p className="admin-hint">You aren&apos;t on a team yet. Ask an admin to add you to one.</p>
      </>
    );
  }

  const [lines, members] = await Promise.all([
    prisma.qcReferenceValue.findMany({
      where: { organizationId: access.organizationId },
      orderBy: [{ kind: "asc" }, { reference: "asc" }, { analyte: "asc" }],
    }),
    prisma.user.findMany({
      where: { organizationId: access.organizationId },
      select: { id: true, name: true },
    }),
  ]);
  const nameOf = (userId: string | null) =>
    (userId && members.find((m) => m.id === userId)?.name) || "Someone no longer on the team";

  // Change register item 2: every revision is kept. The current lines are
  // the ones not retired; each one's earlier revisions follow supersedesId.
  type Line = (typeof lines)[number];
  const byId = new Map(lines.map((line) => [line.id, line]));
  const revision = (line: Line): QcReferenceRevision => ({
    id: line.id,
    revision: line.revision,
    unit: line.unit,
    expectedValue: line.expectedValue,
    standardDeviation: line.standardDeviation,
    maxValue: line.maxValue,
    reference: line.reference,
    analyte: line.analyte,
    changeReason: line.changeReason,
    createdByName: nameOf(line.createdBy),
    createdAt: line.createdAt.toISOString(),
  });
  const history = (line: Line): QcReferenceRevision[] => {
    const earlier: QcReferenceRevision[] = [];
    let previous = line.supersedesId ? byId.get(line.supersedesId) : undefined;
    while (previous && earlier.length < 50) {
      earlier.push(revision(previous));
      previous = previous.supersedesId ? byId.get(previous.supersedesId) : undefined;
    }
    return earlier;
  };
  const toRow = (line: Line): QcReferenceRow => ({
    ...revision(line),
    kind: line.kind,
    earlier: history(line),
    retiredAt: line.retiredAt?.toISOString() ?? null,
    retiredByName: line.retiredAt ? nameOf(line.retiredBy) : null,
    retireReason: line.retireReason,
  });
  const replaced = new Set(lines.flatMap((line) => (line.supersedesId ? [line.supersedesId] : [])));
  const rows = lines.filter((line) => !line.retiredAt).map(toRow);
  const removed = lines
    .filter((line) => line.retiredAt && !replaced.has(line.id))
    .map(toRow)
    .sort((a, b) => (b.retiredAt ?? "").localeCompare(a.retiredAt ?? ""));

  return (
    <>
      {header}
      <div className="admin-columns">
        <div className="admin-list-column">
          <QcReferenceEditor rows={rows} removed={removed} canEdit={access.canEdit} />
        </div>
        <aside className="admin-sidebar-column">
          <section className="admin-card" aria-labelledby="sop-title">
            <h2 id="sop-title">Where the numbers come from</h2>
            <ul className="qc-sop-list">
              <li>
                <strong>Standards.</strong> Copy the certified value and one
                standard deviation from the standard&apos;s certificate, for the
                element and the analytical method your laboratory uses.
              </li>
              <li>
                <strong>Blanks.</strong> Set the limit at 5 to 10 times the
                laboratory&apos;s detection limit for that element.
              </li>
              <li>
                Names are matched ignoring capitals, so &quot;OREAS 45e&quot;
                here matches &quot;oreas 45E&quot; recorded on the phone.
              </li>
              <li>
                A change is saved as a new revision with the reason, and a
                removed line is kept as no longer used. Earlier QA/QC
                decisions keep the values they were made on.
              </li>
            </ul>
          </section>
          <section className="admin-card" aria-labelledby="rules-title">
            <h2 id="rules-title">How results are checked</h2>
            <ul className="qc-sop-list">
              <li>
                A standard within {STANDARD_WARNING_SD} SD of its certified
                value passes. Between {STANDARD_WARNING_SD} and{" "}
                {STANDARD_FAILURE_SD} SD it is a warning; beyond{" "}
                {STANDARD_FAILURE_SD} SD it fails.
              </li>
              <li>
                Two warnings in a row for the same standard and element, on the
                same side, in one dispatch, also fail.
              </li>
              <li>
                A result is checked only when its unit matches the line&apos;s
                unit (capitals and spaces aside). Nothing is converted: 0.0742
                % against a ppm line shows as &quot;Units don&apos;t match&quot;
                until one of them is corrected.
              </li>
              <li>A blank above its limit fails. Below detection passes.</li>
              <li>
                A blank the phone recorded without a material uses the
                element&apos;s blank limit only when there is one. With
                several blank materials for an element, it is shown as not
                checked rather than checked against the wrong one.
              </li>
              <li>
                A field duplicate more than {FIELD_DUPLICATE_MAX_DIFFERENCE_PCT}%
                from its original sample fails.
              </li>
              <li>
                Failures appear on the QA/QC screen for the laboratory and
                assays stage, with the sample, value and limit.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
