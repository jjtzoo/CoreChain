import { notFound } from "next/navigation";
import { AppShell } from "@/components/corechain/app-shell";
import { DrillholeDetail } from "@/components/corechain/drillholes/drillhole-detail";
import { albertaDemoProject } from "@/lib/demo/alberta-project";
import { buildTraceabilityDemo } from "@/lib/demo/traceability-fixture";
import { getAlbertaDemoDataset } from "@/lib/repositories/alberta-demo-repository";

type DrillholeDetailPageProps = {
  params: Promise<{ drillholeId: string }>;
};

export default async function DrillholeDetailPage({
  params,
}: DrillholeDetailPageProps) {
  const { drillholeId } = await params;
  const dataset = await getAlbertaDemoDataset();
  const drillhole = dataset.drillholes.find(
    (record) => record.id === drillholeId,
  );

  if (!drillhole) {
    notFound();
  }

  const traceabilityDemo = buildTraceabilityDemo(dataset);

  return (
    <AppShell activeItem="Drillholes">
      <div className="workspace-content workspace-content-dense">
        <DrillholeDetail
          projectId={albertaDemoProject.id}
          drillhole={drillhole}
          intervals={dataset.intervals.filter(
            (interval) => interval.drillholeName === drillhole.name,
          )}
          assays={dataset.assays.filter(
            (assay) => assay.drillholeName === drillhole.name,
          )}
          traceabilityDemo={
            drillhole.name === traceabilityDemo.sample.drillholeName
              ? traceabilityDemo
              : undefined
          }
        />
      </div>
    </AppShell>
  );
}
