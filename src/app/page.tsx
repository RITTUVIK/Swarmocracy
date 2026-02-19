import { SystemMetrics } from "@/components/dashboard/SystemMetrics";
import { NodeZones } from "@/components/dashboard/NodeZones";
import { SwarmVisualizer } from "@/components/dashboard/SwarmVisualizer";
import { StatCards } from "@/components/dashboard/StatCards";
import { ActiveProposals } from "@/components/dashboard/ActiveProposals";
import { ProtocolLog } from "@/components/dashboard/ProtocolLog";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="flex h-full">
      {/* Left sidebar metrics */}
      <aside className="w-[220px] min-w-[220px] border-r border-panel-border p-3 space-y-3 overflow-y-auto">
        <SystemMetrics />
        <NodeZones />
      </aside>

      {/* Main content */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <SwarmVisualizer />
        <StatCards />
        <div className="grid grid-cols-2 gap-4" style={{ minHeight: "320px" }}>
          <ActiveProposals />
          <ProtocolLog />
        </div>
      </div>
    </div>
  );
}
