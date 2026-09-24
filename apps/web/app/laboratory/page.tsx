import {
  missingSampleIds,
  preparationQueue,
  receiptStatus,
  resultsStatus,
} from "@corechain/domain";
import { prisma } from "@/lib/prisma";
import { requireLaboratory } from "@/lib/session";
import {
  LaboratoryWorkspace,
  type AssayResultRow,
  type DispatchRow,
  type QueueRow,
  type SampleRow,
} from "./laboratory-workspace";

export default async function LaboratoryPage() {
  const session = await requireLaboratory();

  const self = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });
  const organizationId = self?.organizationId ?? null;

  if (!organizationId) {
    return (
      <div className="admin-page-header">
        <div>
          <h1>Laboratory</h1>
          <p>You aren&apos;t on a team yet. Ask an admin to add you to one.</p>
        </div>
      </div>
    );
  }

  const [members, dispatches] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
    prisma.dispatch.findMany({
      where: { organizationId, deletedAt: null, status: "dispatched" },
      orderBy: [{ handoverAt: "desc" }, { createdAt: "desc" }],
      include: {
        project: { select: { name: true } },
        samples: {
          where: { deletedAt: null },
          include: {
            sample: {
              select: {
                id: true,
                sampleNumber: true,
                sampleType: true,
                drillhole: { select: { holeId: true, priority: true, priorityNote: true } },
              },
            },
          },
        },
        assayResults: true,
      },
    }),
  ]);

  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const dispatchIds = dispatches.map((d) => d.id);

  const receivedEvents = dispatchIds.length
    ? await prisma.custodyEvent.findMany({
        where: { dispatchId: { in: dispatchIds }, eventType: "received" },
        select: {
          dispatchId: true,
          sampleId: true,
          occurredAt: true,
          handledBy: true,
        },
      })
    : [];
  const receivedByDispatch = new Map<string, typeof receivedEvents>();
  for (const event of receivedEvents) {
    const list = receivedByDispatch.get(event.dispatchId!) ?? [];
    list.push(event);
    receivedByDispatch.set(event.dispatchId!, list);
  }

  const dispatchRows: DispatchRow[] = dispatches.map((dispatch) => {
    const dispatchedSampleIds = dispatch.samples.map((s) => s.sampleId);
    const received = receivedByDispatch.get(dispatch.id) ?? [];
    const receivedIds = received.map((e) => e.sampleId);
    const receivedAtBySample = new Map(
      received.map((e) => [e.sampleId, e.occurredAt.toISOString()]),
    );

    const samples: SampleRow[] = dispatch.samples.map((ds) => ({
      id: ds.sample.id,
      sampleNumber: ds.sample.sampleNumber,
      sampleType: ds.sample.sampleType,
      receivedAt: receivedAtBySample.get(ds.sample.id) ?? null,
    }));

    const resultsBySample = new Map<string, AssayResultRow[]>();
    for (const result of dispatch.assayResults) {
      const list = resultsBySample.get(result.sampleId) ?? [];
      list.push({
        id: result.id,
        analyte: result.analyte,
        value: result.value,
        unit: result.unit,
        belowDetection: result.belowDetection,
        enteredByName: nameById.get(result.enteredBy) ?? "Someone no longer on the team",
        createdAt: result.createdAt.toISOString(),
      });
      resultsBySample.set(result.sampleId, list);
    }

    return {
      id: dispatch.id,
      dispatchNumber: dispatch.dispatchNumber,
      projectName: dispatch.project.name,
      laboratory: dispatch.laboratory,
      handoverAt: dispatch.handoverAt,
      note: dispatch.note,
      samples,
      receiptStatus: receiptStatus(dispatchedSampleIds, receivedIds),
      missingSampleIds: missingSampleIds(dispatchedSampleIds, receivedIds),
      resultsBySample: Object.fromEntries(resultsBySample),
      resultsStatus: resultsStatus(
        dispatch.assayResults.map((r) => r.sampleId),
        dispatch.resultsReturnedAt?.toISOString() ?? null,
      ),
      resultsReturnedAt: dispatch.resultsReturnedAt?.toISOString() ?? null,
    };
  });

  // Receive by scan: received samples still waiting for results, urgent
  // holes first (the project manager's flag on the hole).
  const queue: QueueRow[] = preparationQueue(
    dispatches.flatMap((dispatch) => {
      const received = new Map(
        (receivedByDispatch.get(dispatch.id) ?? []).map((e) => [
          e.sampleId,
          e.occurredAt.toISOString(),
        ]),
      );
      const withResults = new Set(dispatch.assayResults.map((r) => r.sampleId));
      return dispatch.samples.map((ds) => ({
        sampleId: ds.sample.id,
        sampleNumber: ds.sample.sampleNumber,
        dispatchNumber: dispatch.dispatchNumber,
        holeId: ds.sample.drillhole.holeId,
        projectName: dispatch.project.name,
        receivedAt: received.get(ds.sample.id) ?? null,
        priority: ds.sample.drillhole.priority,
        priorityNote: ds.sample.drillhole.priorityNote,
        hasResults: withResults.has(ds.sample.id),
        resultsComplete: dispatch.resultsReturnedAt !== null,
      }));
    }),
  );

  return (
    <>
      <div className="admin-page-header">
        <div>
          <h1>Laboratory</h1>
          <p>{dispatchRows.length} batches dispatched to your team</p>
        </div>
      </div>
      <LaboratoryWorkspace dispatches={dispatchRows} queue={queue} />
    </>
  );
}
