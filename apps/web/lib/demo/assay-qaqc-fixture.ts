import type {
  AlbertaDemoDataset,
  AssayMatch,
  AssayRecord,
  AssayResultValue,
  QaqcControl,
  QaqcReview,
} from "@corechain/domain";
import type { TraceabilityDemo } from "@/lib/demo/traceability-fixture";

const syntheticOrigin = "Synthetic demonstration data" as const;
const publicOrigin = "Public source data" as const;

export type AssayQaqcDemo = {
  sampleId: string;
  sourceSampleId: string;
  assayMatches: readonly AssayMatch[];
  controls: readonly QaqcControl[];
  review: QaqcReview;
};

function reportedValues(record: AssayRecord): readonly AssayResultValue[] {
  return Object.entries(record.provenance.raw)
    .flatMap(([field, value]) => {
      const match = /^(.*)_(ppm|pct)$/.exec(field);

      if (!match || !value || value === "-9999") {
        return [];
      }

      return [
        {
          analyte: match[1],
          unit: match[2] as AssayResultValue["unit"],
          reportedValue: value,
        },
      ];
    })
    .sort((left, right) => left.analyte.localeCompare(right.analyte));
}

function sourceAssayMatches(
  dataset: AlbertaDemoDataset,
  traceability: TraceabilityDemo,
): readonly AssayMatch[] {
  const matches = dataset.assays
    .filter(
      (record) =>
        record.drillholeName === traceability.sample.drillholeName &&
        record.sampleId === traceability.sample.sourceSampleId,
    )
    .map((record) => {
      if (record.fromM === null || record.toM === null) {
        throw new Error(
          `Source assay ${record.id} has no interval for matching.`,
        );
      }

      return {
        id: `assay-match-${record.id}`,
        corechainSampleId: traceability.sample.projectSampleId,
        sourceSampleId: traceability.sample.sourceSampleId,
        sourceAssayId: record.provenance.sourceId,
        fromM: record.fromM,
        toM: record.toM,
        laboratory: record.laboratory,
        methodCode: record.methodCode,
        certificateDate: record.certificateDate,
        reportedValues: reportedValues(record),
        origin: publicOrigin,
      } satisfies AssayMatch;
    });

  if (matches.length !== traceability.sourceAssayRecordCount) {
    throw new Error(
      "Assay matching count does not match the traceability record.",
    );
  }

  return matches;
}

export function buildAssayQaqcDemo(
  dataset: AlbertaDemoDataset,
  traceability: TraceabilityDemo,
): AssayQaqcDemo {
  const assayMatches = sourceAssayMatches(dataset, traceability);

  const controls: readonly QaqcControl[] = [
    {
      id: "qaqc-control-cc-demo-standard-01",
      controlType: "Standard",
      insertedWithSampleId: traceability.sample.projectSampleId,
      observation: "Example control response recorded as 1.48 units.",
      demonstrationRule: "Example review range: 1.10 to 1.40 units.",
      status: "Flagged for review",
      origin: syntheticOrigin,
    },
    {
      id: "qaqc-control-cc-demo-blank-01",
      controlType: "Blank",
      insertedWithSampleId: traceability.sample.projectSampleId,
      observation:
        "Example blank recorded below its example reporting threshold.",
      demonstrationRule:
        "Example action: review only if the threshold is exceeded.",
      status: "No alert shown",
      origin: syntheticOrigin,
    },
    {
      id: "qaqc-control-cc-demo-duplicate-01",
      controlType: "Field duplicate",
      insertedWithSampleId: traceability.sample.projectSampleId,
      observation:
        "Example duplicate comparison was logged for reviewer context.",
      demonstrationRule:
        "Example action: a qualified person sets the comparison rule.",
      status: "Review recorded",
      origin: syntheticOrigin,
    },
  ];

  return {
    sampleId: traceability.sample.projectSampleId,
    sourceSampleId: traceability.sample.sourceSampleId,
    assayMatches,
    controls,
    review: {
      id: "qaqc-review-cc-demo-5739",
      sampleId: traceability.sample.projectSampleId,
      status: "Review required",
      decision:
        "Hold the demonstration control for qualified geologist review.",
      note: "This is an example workflow state, not a technical acceptance decision or a universal QA/QC limit.",
      origin: syntheticOrigin,
    },
  };
}
