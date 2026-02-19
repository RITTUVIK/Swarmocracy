"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Proposal {
  id: string;
  realmId: string;
  name: string;
  state: string;
  proposalType: string;
  yesVotes: number;
  noVotes: number;
  totalVotes: number;
  executionStatus: string | null;
}

const stateStyles: Record<string, string> = {
  Voting: "badge-yellow",
  Succeeded: "badge-green",
  Defeated: "badge-red",
  Completed: "badge-green",
  Draft: "badge-gray",
  Cancelled: "badge-red",
};

export function ActiveProposals() {
  const [proposals, setProposals] = useState<Proposal[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/proposals/active");
        if (res.ok) setProposals(await res.json());
      } catch {}
    }
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="panel flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
        <div className="panel-header flex items-center gap-2">
          <span className="text-sol-purple">◈</span> ACTIVE_PROPOSALS
        </div>
        <Link
          href="/realms"
          className="text-[9px] text-gray-500 hover:text-sol-cyan uppercase tracking-widest transition-colors"
        >
          [VIEW_ALL]
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {proposals.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-xs">
            No active proposals
          </div>
        ) : (
          proposals.map((p) => {
            const pct =
              p.totalVotes > 0
                ? Math.round((p.yesVotes / p.totalVotes) * 100)
                : 0;
            return (
              <Link
                key={p.id}
                href={`/realms/${p.realmId}/proposals/${p.id}`}
                className="block p-3 rounded bg-panel-light border border-panel-border hover:border-sol-purple/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] text-gray-600 tracking-wider">
                    PROP_ID: {p.id.slice(0, 6)}
                  </span>
                  <span className={stateStyles[p.state] ?? "badge-gray"}>
                    {p.state === "Voting" ? "VOTING_OPEN" : p.state.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-gray-200 font-medium mb-2 truncate">
                  {p.name}
                </div>
                <div className="h-1 bg-panel-border rounded-full overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-sol-green rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-gray-500 tracking-wider">
                  <span>{pct}% FOR</span>
                  <span>
                    CAST {p.yesVotes} YES {p.noVotes} NO
                  </span>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
