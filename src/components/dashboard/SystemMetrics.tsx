"use client";

export function SystemMetrics() {
  return (
    <div className="panel p-4">
      <div className="panel-header mb-4 flex items-center gap-2">
        <span className="text-sol-cyan">◈</span> SYSTEM_METRICS
      </div>
      <div className="space-y-4">
        {["CPU_LOAD", "RPC_LATENCY", "AGENT_UPTIME"].map((label) => (
          <div key={label}>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-gray-500 tracking-wider">
                {label}
              </span>
              <span className="text-[11px] text-gray-500">—</span>
            </div>
            <div className="h-1 bg-panel-border rounded-full overflow-hidden">
              <div className="h-full w-0 bg-sol-cyan rounded-full" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-gray-600 mt-3">
        Metrics not connected. Use your own monitoring for CPU/RPC/uptime.
      </p>
    </div>
  );
}
