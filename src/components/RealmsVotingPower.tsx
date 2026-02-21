"use client";

import { useEffect, useState } from "react";

interface Member {
  walletPk: string;
  communityVotingPower: string;
  councilVotingPower?: string;
  totalVotesCount: number;
  outstandingProposalsCount: number;
}

export function RealmsVotingPower({
  realmPk,
  walletPk,
}: {
  realmPk: string;
  walletPk?: string;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/realms/v2/${realmPk}/members`);
        if (res.ok) {
          const data = await res.json();
          setMembers(Array.isArray(data) ? data : []);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, [realmPk]);

  if (loading) {
    return (
      <div className="panel p-4 text-gray-600 text-xs">
        Loading voting power...
      </div>
    );
  }

  const totalDeposited = members.reduce(
    (s, m) => s + parseInt(m.communityVotingPower || "0"),
    0
  );

  const totalVotes = members.reduce(
    (s, m) => s + (m.totalVotesCount || 0),
    0
  );

  const activeMembers = members.filter((m) => m.totalVotesCount > 0);

  // Sort by vote activity (most active first)
  const sorted = [...members]
    .filter((m) => m.walletPk)
    .sort((a, b) => (b.totalVotesCount || 0) - (a.totalVotesCount || 0));

  const maxVotes = sorted.length > 0 ? (sorted[0].totalVotesCount || 1) : 1;

  return (
    <div className="panel p-4">
      <div className="panel-header mb-3 flex items-center gap-2">
        <span className="text-sol-purple">◈</span> VOTING_POWER
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <div>
          <div className="text-[9px] text-gray-600 tracking-wider uppercase">
            MEMBERS
          </div>
          <div className="text-lg text-white font-bold">{members.length}</div>
        </div>
        <div>
          <div className="text-[9px] text-gray-600 tracking-wider uppercase">
            TOKENS DEPOSITED
          </div>
          <div className="text-lg text-white font-bold">
            {totalDeposited.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-gray-600 tracking-wider uppercase">
            ACTIVE VOTERS
          </div>
          <div className="text-lg text-sol-green font-bold">
            {activeMembers.length}
          </div>
        </div>
      </div>
      {sorted.length > 0 && (
        <>
          <div className="text-[9px] text-gray-600 tracking-wider uppercase mb-1">
            TOP VOTERS (by vote count)
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {sorted.slice(0, 15).map((m) => {
              const votes = m.totalVotesCount || 0;
              const pct = maxVotes > 0 ? (votes / maxVotes) * 100 : 0;
              return (
                <div
                  key={m.walletPk}
                  className="flex items-center gap-2 text-[10px]"
                >
                  <span className="text-gray-500 w-24 truncate">
                    {m.walletPk.slice(0, 6)}...{m.walletPk.slice(-4)}
                  </span>
                  <div className="flex-1 h-1 bg-panel-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sol-purple rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-gray-400 w-16 text-right">
                    {votes} votes
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
