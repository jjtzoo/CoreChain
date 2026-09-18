import type {
  AlbertaDemoDataset,
  CoreBox,
  CustodyEvent,
  Dispatch,
  GeologicalInterval,
  Sample,
} from "@/lib/domain/corechain";

const syntheticOrigin = "Synthetic demonstration data" as const;

export type TraceabilityDemo = {
  coreBox: CoreBox;
  sample: Sample;
  custodyEvents: readonly CustodyEvent[];
  dispatch: Dispatch;
  sourceInterval: GeologicalInterval;
  sourceAssayRecordCount: number;
};

function requireSourceInterval(dataset: AlbertaDemoDataset) {
  const interval = dataset.intervals.find(
    (record) =>
      record.drillholeName === "200134-006" &&
      record.fromM === 67.25 &&
      record.toM === 69.19,
  );

  if (!interval) {
    throw new Error(
      "Synthetic traceability fixture cannot find its source interval.",
    );
  }

  return interval;
}

export function buildTraceabilityDemo(
  dataset: AlbertaDemoDataset,
): TraceabilityDemo {
  const sourceInterval = requireSourceInterval(dataset);
  const sourceAssayRecordCount = dataset.assays.filter(
    (record) =>
      record.drillholeName === "200134-006" && record.sampleId === "5739",
  ).length;

  if (sourceAssayRecordCount === 0) {
    throw new Error(
      "Synthetic traceability fixture cannot find its source assay.",
    );
  }

  const coreBox: CoreBox = {
    id: "core-box-cc-demo-006-04",
    drillholeName: "200134-006",
    boxNumber: "CC-DEMO-006-04",
    fromM: 67.25,
    toM: 73,
    receivedStatus: "Received",
    condition: "Example condition recorded for demonstration",
    location: "Core yard demonstration shelf",
    origin: syntheticOrigin,
    note: "Synthetic core-box record linked to a public source interval.",
  };

  const sample: Sample = {
    id: "sample-cc-demo-5739",
    projectSampleId: "CC-DEMO-5739",
    sourceSampleId: "5739",
    drillholeName: "200134-006",
    linkedIntervalId: sourceInterval.id,
    fromM: 67.25,
    toM: 68.25,
    sampleType: "Primary",
    purpose: "Traceability workflow demonstration",
    status: "Dispatched in demonstration",
    origin: syntheticOrigin,
  };

  const custodyEvents: readonly CustodyEvent[] = [
    {
      id: "custody-cc-demo-5739-created",
      sampleId: sample.id,
      eventType: "Created",
      occurredAt: "2001-10-01T09:20:00",
      handledBy: "Core-yard demonstration user",
      location: "Core yard demonstration shelf",
      note: "Example sample wrapper created for the linked source sample ID.",
      evidence: "Synthetic sample register entry",
      origin: syntheticOrigin,
    },
    {
      id: "custody-cc-demo-5739-packed",
      sampleId: sample.id,
      eventType: "Packed",
      occurredAt: "2001-10-01T11:05:00",
      handledBy: "Core-yard demonstration user",
      location: "Core yard demonstration shelf",
      note: "Example packaging and seal check recorded for the demonstration.",
      evidence: "Synthetic packing check",
      origin: syntheticOrigin,
    },
    {
      id: "custody-cc-demo-5739-handed-over",
      sampleId: sample.id,
      eventType: "Handed over",
      occurredAt: "2001-10-02T08:35:00",
      handledBy: "Demonstration logistics hand-off",
      location: "Site dispatch point",
      note: "Example hand-off recorded before the demonstration dispatch.",
      evidence: "Synthetic hand-off acknowledgement",
      origin: syntheticOrigin,
    },
    {
      id: "custody-cc-demo-5739-dispatched",
      sampleId: sample.id,
      eventType: "Dispatched",
      occurredAt: "2001-10-03T09:20:00",
      handledBy: "Demonstration logistics hand-off",
      location: "Site dispatch point",
      note: "Example dispatch event connected to CC-DEMO-ALB-001.",
      evidence: "Synthetic dispatch record",
      origin: syntheticOrigin,
    },
  ];

  const dispatch: Dispatch = {
    id: "dispatch-cc-demo-alb-001",
    dispatchNumber: "CC-DEMO-ALB-001",
    laboratory: "Bondar-Clegg & Company Ltd. (listed by source assay)",
    preparationRequest: "Example ICP preparation request",
    createdAt: "2001-10-03T08:45:00",
    handedOffAt: "2001-10-03T09:20:00",
    receivedAt: null,
    status: "Dispatched in demonstration",
    sampleIds: [sample.id],
    origin: syntheticOrigin,
    note: "The dispatch record is synthetic. The laboratory name is visible in the linked public assay source.",
  };

  return {
    coreBox,
    sample,
    custodyEvents,
    dispatch,
    sourceInterval,
    sourceAssayRecordCount,
  };
}
