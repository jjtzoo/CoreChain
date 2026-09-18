import { AppShell } from "@/components/corechain/app-shell";
import { SampleRegister } from "@/components/corechain/traceability/traceability-record";
import { albertaDemoProject } from "@/lib/demo/alberta-project";
import { buildTraceabilityDemo } from "@/lib/demo/traceability-fixture";
import { getAlbertaDemoDataset } from "@/lib/repositories/alberta-demo-repository";

export default async function SamplesPage() {
  const demo = buildTraceabilityDemo(await getAlbertaDemoDataset());

  return (
    <AppShell activeItem="Samples">
      <div className="workspace-content workspace-content-dense">
        <SampleRegister projectId={albertaDemoProject.id} demo={demo} />
      </div>
    </AppShell>
  );
}
