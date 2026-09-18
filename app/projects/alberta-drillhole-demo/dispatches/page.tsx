import { AppShell } from "@/components/corechain/app-shell";
import { DispatchRegister } from "@/components/corechain/traceability/traceability-record";
import { albertaDemoProject } from "@/lib/demo/alberta-project";
import { buildTraceabilityDemo } from "@/lib/demo/traceability-fixture";
import { getAlbertaDemoDataset } from "@/lib/repositories/alberta-demo-repository";

export default async function DispatchesPage() {
  const demo = buildTraceabilityDemo(await getAlbertaDemoDataset());

  return (
    <AppShell activeItem="Dispatches">
      <div className="workspace-content workspace-content-dense">
        <DispatchRegister projectId={albertaDemoProject.id} demo={demo} />
      </div>
    </AppShell>
  );
}
