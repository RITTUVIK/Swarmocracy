"use client";

import { useEffect, useState } from "react";

interface DashStats {
  tvl: string;
  agents: number;
  txCount: string;
  tps: string;
}

export function StatCards() {
  const [stats, setStats] = useState<DashStats | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
          return;
        }
      } catch {}
      setStats({
        tvl: "$0",
        agents: 0,
        txCount: "0",
        tps: "0",
      });
    }
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const cards = [
    {
      icon: "◈",
      label: "TOTAL VALUE LOCKED",
      value: stats?.tvl ?? "—",
      delta: "+2.4% 24H",
      deltaUp: true,
    },
    {
      icon: "◉",
      label: "ACTIVE AGENTS",
      value: stats ? stats.agents.toLocaleString() : "—",
      delta: `+${stats?.agents ?? 0} REGISTERED`,
      deltaUp: true,
    },
    {
      icon: "◆",
      label: "ON-CHAIN TXS",
      value: stats?.txCount ?? "—",
      delta: `TPS: ${stats?.tps ?? "0"} / SOLANA`,
      deltaUp: true,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="panel p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sol-cyan text-xs">{c.icon}</span>
            <span className="panel-header">{c.label}</span>
          </div>
          <div className="stat-value">{c.value}</div>
          <div className={c.deltaUp ? "stat-delta-up mt-1" : "stat-delta-down mt-1"}>
            ▲ {c.delta}
          </div>
        </div>
      ))}
    </div>
  );
}
