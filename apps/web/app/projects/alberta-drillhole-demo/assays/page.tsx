import { AssayQaqcWorkspace } from "@/components/corechain/assays/assay-qaqc-workspace";
import { AppShell } from "@/components/corechain/app-shell";
import { buildAssayQaqcDemo } from "@/lib/demo/assay-qaqc-fixture";
import { albertaDemoProject } from "@/lib/demo/alberta-project";
import { buildTraceabilityDemo } from "@/lib/demo/traceability-fixture";
import { getAlbertaDemoDataset } from "@/lib/repositories/alberta-demo-repository";

export default async function AssaysPage() {
  const dataset = await getAlbertaDemoDataset();
  const demo = buildAssayQaqcDemo(dataset, buildTraceabilityDemo(dataset));

  return (
    <AppShell activeItem="Assays and QA/QC">
      <div className="workspace-content workspace-content-dense">
        <AssayQaqcWorkspace projectId={albertaDemoProject.id} demo={demo} />
      </div>
    </AppShell>
  );
}
