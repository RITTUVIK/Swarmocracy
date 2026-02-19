"use client";

import { useEffect, useState } from "react";

interface Metric {
  label: string;
  value: string;
  percent: number;
  color: string;
}

export function SystemMetrics() {
  const [metrics, setMetrics] = useState<Metric[]>([
    { label: "CPU_LOAD", value: "—", percent: 0, color: "bg-sol-purple" },
    { label: "RPC_LATENCY", value: "—", percent: 0, color: "bg-sol-cyan" },
    { label: "AGENT_UPTIME", value: "—", percent: 0, color: "bg-sol-green" },
  ]);

  useEffect(() => {
    function refresh() {
      setMetrics([
        {
          label: "CPU_LOAD",
          value: `${(40 + Math.random() * 40).toFixed(0)}%`,
          percent: 40 + Math.random() * 40,
          color: "bg-sol-purple",
        },
        {
          label: "RPC_LATENCY",
          value: `${(8 + Math.random() * 20).toFixed(0)}ms`,
          percent: (8 + Math.random() * 20) / 0.5,
          color: "bg-sol-cyan",
        },
        {
          label: "AGENT_UPTIME",
          value: `${(99 + Math.random() * 0.9).toFixed(1)}%`,
          percent: 99 + Math.random() * 0.9,
          color: "bg-sol-green",
        },
      ]);
    }
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="panel p-4">
      <div className="panel-header mb-4 flex items-center gap-2">
        <span className="text-sol-cyan">◈</span> SYSTEM_METRICS
      </div>
      <div className="space-y-4">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-gray-500 tracking-wider">
                {m.label}
              </span>
              <span className="text-[11px] text-white font-medium">
                {m.value}
              </span>
            </div>
            <div className="h-1 bg-panel-border rounded-full overflow-hidden">
              <div
                className={`h-full ${m.color} rounded-full transition-all duration-1000`}
                style={{ width: `${Math.min(m.percent, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
