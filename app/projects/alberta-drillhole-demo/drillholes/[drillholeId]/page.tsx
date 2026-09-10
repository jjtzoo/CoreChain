import { notFound } from "next/navigation";
import { AppShell } from "@/components/corechain/app-shell";
import { DrillholeDetail } from "@/components/corechain/drillholes/drillhole-detail";
import { albertaDemoProject } from "@/lib/demo/alberta-project";
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
        />
      </div>
    </AppShell>
  );
}
