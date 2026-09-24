import {
  FIELD_DUPLICATE_MAX_DIFFERENCE_PCT,
  STANDARD_FAILURE_SD,
  STANDARD_WARNING_SD,
} from "@corechain/domain";
import type { Route } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { qcReferenceAccess } from "./access";
import { QcReferenceEditor, type QcReferenceRow } from "./qc-reference-editor";

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

  const lines = await prisma.qcReferenceValue.findMany({
    where: { organizationId: access.organizationId },
    orderBy: [{ kind: "asc" }, { reference: "asc" }, { analyte: "asc" }],
  });
  const rows: QcReferenceRow[] = lines.map((line) => ({
    id: line.id,
    kind: line.kind,
    reference: line.reference,
    analyte: line.analyte,
    unit: line.unit,
    expectedValue: line.expectedValue,
    standardDeviation: line.standardDeviation,
    maxValue: line.maxValue,
  }));

  return (
    <>
      {header}
      <div className="admin-columns">
        <div className="admin-list-column">
          <QcReferenceEditor rows={rows} canEdit={access.canEdit} />
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
              <li>A blank above its limit fails. Below detection passes.</li>
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
