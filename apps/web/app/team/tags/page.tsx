import type { Route } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireProjectManager } from "@/lib/session";
import { TagControls } from "./tag-controls";

// Printable bag tags: one label per sample, with a QR code of the sample
// number that the phone's "Scan tags" and the laboratory's "Receive by scan"
// both read. A tag carries only the number and the project, never the hole,
// depth or sample type: it travels on the bag the laboratory handles, so the
// standards and blanks among them stay blind.

const numeric = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true });

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ hole?: string; dispatch?: string }>;
}) {
  const session = await requireProjectManager();
  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? null;

  const header = (
    <div className="admin-page-header no-print">
      <div>
        <Link href={"/team" as Route} className="admin-link">
          ← Team overview
        </Link>
        <h1>Print tags</h1>
        <p>
          QR labels for sample bags. The phone&apos;s Scan tags and the
          laboratory&apos;s Receive by scan both read them. Each tag shows only
          the sample number and project, so standards and blanks stay blind to
          the laboratory.
        </p>
      </div>
    </div>
  );

  if (!organizationId) {
    return (
      <>
        {header}
        <p className="admin-hint">You aren&apos;t on a team yet. Ask an admin to add you to one.</p>
      </>
    );
  }

  const { hole: holeParam, dispatch: dispatchParam } = await searchParams;
  const [holes, dispatches] = await Promise.all([
    prisma.drillhole.findMany({
      where: { organizationId, deletedAt: null },
      select: { id: true, holeId: true, project: { select: { name: true } } },
    }),
    prisma.dispatch.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, dispatchNumber: true, laboratory: true },
    }),
  ]);
  holes.sort((a, b) => numeric(a.holeId, b.holeId));

  const hole = holes.find((h) => h.id === holeParam) ?? null;
  const dispatch = hole ? null : (dispatches.find((d) => d.id === dispatchParam) ?? null);

  const samples = hole
    ? await prisma.sample.findMany({
        where: { drillholeId: hole.id, deletedAt: null },
        select: { id: true, sampleNumber: true, project: { select: { name: true } } },
      })
    : dispatch
      ? (
          await prisma.dispatchSample.findMany({
            where: { dispatchId: dispatch.id, deletedAt: null, sample: { deletedAt: null } },
            select: {
              sample: {
                select: { id: true, sampleNumber: true, project: { select: { name: true } } },
              },
            },
          })
        ).map((line) => line.sample)
      : [];
  samples.sort((a, b) => numeric(a.sampleNumber, b.sampleNumber));

  const tags = await Promise.all(
    samples.map(async (sample) => ({
      id: sample.id,
      sampleNumber: sample.sampleNumber,
      projectName: sample.project.name,
      qr: await QRCode.toString(sample.sampleNumber, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 0,
      }),
    })),
  );

  return (
    <>
      {header}
      <TagControls
        holes={holes.map((h) => ({ id: h.id, label: `${h.holeId} · ${h.project.name}` }))}
        dispatches={dispatches.map((d) => ({
          id: d.id,
          label: `${d.dispatchNumber} · ${d.laboratory}`,
        }))}
        hole={hole?.id ?? null}
        dispatch={dispatch?.id ?? null}
        count={tags.length}
      />
      {hole || dispatch ? (
        tags.length === 0 ? (
          <p className="admin-hint no-print">
            {hole ? `${hole.holeId} has no samples yet.` : "That dispatch has no samples."}
          </p>
        ) : (
          <div className="tag-sheet" aria-label={`${tags.length} tags`}>
            {tags.map((tag) => (
              <div key={tag.id} className="tag-label">
                <div
                  className="tag-qr"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: tag.qr }}
                />
                <div className="tag-text">
                  <span className="tag-number">{tag.sampleNumber}</span>
                  <span className="tag-project">{tag.projectName}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <p className="admin-hint no-print">
          Choose a hole or a dispatch to lay out its tags, then print them on
          A4 label paper or plain paper to cut.
        </p>
      )}
    </>
  );
}
