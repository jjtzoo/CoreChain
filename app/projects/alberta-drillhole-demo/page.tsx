import { AppShell } from "@/components/corechain/app-shell";
import { WorkspaceOverview } from "@/components/corechain/workspace-overview";

export default function AlbertaDemoProjectPage() {
  return (
    <AppShell activeItem="Overview">
      <WorkspaceOverview />
    </AppShell>
  );
}
