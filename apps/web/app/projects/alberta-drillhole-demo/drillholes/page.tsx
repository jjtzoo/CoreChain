import { AppShell } from "@/components/corechain/app-shell";
import { DrillholeRegister } from "@/components/corechain/drillholes/drillhole-register";
import { albertaDemoProject } from "@/lib/demo/alberta-project";
import { buildDrillholeRegister } from "@/lib/demo/drillhole-register";
import { getAlbertaDemoDataset } from "@/lib/repositories/alberta-demo-repository";

export default async function DrillholesPage() {
  const dataset = await getAlbertaDemoDataset();
  const records = buildDrillholeRegister(dataset);

  return (
    <AppShell activeItem="Drillholes">
      <div className="workspace-content workspace-content-dense">
        <DrillholeRegister
          projectId={albertaDemoProject.id}
          records={records}
        />
      </div>
    </AppShell>
  );
}
