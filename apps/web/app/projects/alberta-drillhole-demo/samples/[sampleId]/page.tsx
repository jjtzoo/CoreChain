import { notFound } from "next/navigation";
import { AppShell } from "@/components/corechain/app-shell";
import { SampleTraceabilityRecord } from "@/components/corechain/traceability/traceability-record";
import { albertaDemoProject } from "@/lib/demo/alberta-project";
import { buildTraceabilityDemo } from "@/lib/demo/traceability-fixture";
import { getAlbertaDemoDataset } from "@/lib/repositories/alberta-demo-repository";

type SampleDetailPageProps = {
  params: Promise<{ sampleId: string }>;
};

export default async function SampleDetailPage({
  params,
}: SampleDetailPageProps) {
  const { sampleId } = await params;
  const demo = buildTraceabilityDemo(await getAlbertaDemoDataset());

  if (sampleId !== demo.sample.id) {
    notFound();
  }

  return (
    <AppShell activeItem="Samples">
      <div className="workspace-content workspace-content-dense">
        <SampleTraceabilityRecord
          projectId={albertaDemoProject.id}
          demo={demo}
        />
      </div>
    </AppShell>
  );
}
