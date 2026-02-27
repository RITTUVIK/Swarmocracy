"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { StateBadge } from "@/components/ui/Badge";
import { SkeletonCards, SkeletonRows } from "@/components/ui/Skeleton";
import { addressUrl } from "@/lib/explorerUrl";

interface Proposal {
  proposalPk: string;
  name: string;
  state: string;
  governancePk: string;
}

interface TreasuryAsset {
  symbol: string;
  balance: string;
  tokenAccountPk: string;
}

interface Member {
  walletPk: string;
  communityVotingPower: string;
  totalVotesCount: number;
}

interface DAOInfo {
  realmPk: string;
  name: string;
  communityMint: string;
  authority?: string;
}

export default function DAODetailPage() {
  const params = useParams();
  const realmPk = params.realmPk as string;

  const [dao, setDao] = useState<DAOInfo | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [treasury, setTreasury] = useState<TreasuryAsset[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [daoRes, propRes, tresRes, memRes] = await Promise.all([
        fetch(`/api/v1/realms/v2/${realmPk}`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/v1/realms/v2/${realmPk}/proposals`).then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/v1/realms/v2/${realmPk}/treasury`).then((r) => (r.ok ? r.json() : [])),
        fetch(`/api/v1/realms/v2/${realmPk}/members`).then((r) => (r.ok ? r.json() : [])),
      ]);

      setDao(daoRes);
      setProposals(Array.isArray(propRes) ? propRes : []);
      setTreasury(Array.isArray(tresRes) ? tresRes : []);
      setMembers(Array.isArray(memRes) ? memRes : []);
      setLoading(false);
    }
    load();
  }, [realmPk]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCards count={4} />
        <SkeletonRows count={6} />
      </div>
    );
  }

  const activeVoters = members.filter((m) => m.totalVotesCount > 0).length;
  const totalSol = treasury
    .filter((a) => a.symbol === "SOL")
    .reduce((s, a) => s + parseFloat(a.balance || "0"), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/daos" className="text-xs text-gray-500 hover:text-violet-400 transition-colors">
          ← All DAOs
        </Link>
        <h1 className="text-xl font-bold text-white mt-2">
          {dao?.name || realmPk.slice(0, 12) + "..."}
        </h1>
        <p className="text-[11px] text-gray-600 font-mono mt-1">{realmPk}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5" glow="purple">
          <Stat label="Proposals" value={proposals.length} accent="purple" />
        </Card>
        <Card className="p-5" glow="green">
          <Stat label="Members" value={members.length} accent="green" />
        </Card>
        <Card className="p-5">
          <Stat label="Active Voters" value={activeVoters} />
        </Card>
        <Card className="p-5">
          <Stat label="Treasury SOL" value={totalSol > 0 ? totalSol.toFixed(4) : "0"} />
        </Card>
      </div>

      {dao?.authority && (
        <Card className="p-5">
          <div className="grid grid-cols-2 gap-6 text-xs">
            <div>
              <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">Authority</span>
              <p className="text-gray-400 font-mono text-[11px] mt-1 break-all">{dao.authority}</p>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">Community Mint</span>
              <p className="text-gray-400 font-mono text-[11px] mt-1 break-all">{dao.communityMint}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <CardHeader>Treasury</CardHeader>
          {treasury.length === 0 ? (
            <CardBody><p className="text-sm text-gray-600">No assets.</p></CardBody>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {treasury.map((a, i) => (
                <div key={a.tokenAccountPk || `t-${i}`} className="px-5 py-3 flex items-center justify-between">
                  <span className="text-xs text-white font-medium">{a.symbol}</span>
                  <span className="text-xs text-gray-400 tabular-nums font-mono">{a.balance}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>Top Members</CardHeader>
          {members.length === 0 ? (
            <CardBody><p className="text-sm text-gray-600">No members.</p></CardBody>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {[...members]
                .filter((m) => m.walletPk)
                .sort((a, b) => (b.totalVotesCount || 0) - (a.totalVotesCount || 0))
                .slice(0, 10)
                .map((m) => (
                  <div key={m.walletPk} className="px-5 py-3 flex items-center justify-between">
                    <a
                      href={addressUrl(m.walletPk)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-gray-400 font-mono hover:text-violet-400 transition-colors"
                    >
                      {m.walletPk.slice(0, 6)}...{m.walletPk.slice(-4)}
                    </a>
                    <span className="text-[11px] text-gray-600 tabular-nums">{m.totalVotesCount} votes</span>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>Proposals ({proposals.length})</CardHeader>
        {proposals.length === 0 ? (
          <CardBody><p className="text-sm text-gray-600">No proposals.</p></CardBody>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {proposals.slice(0, 50).map((p) => (
              <Link
                key={p.proposalPk}
                href={`/dao/${realmPk}/proposals/${p.proposalPk}`}
                className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors group"
              >
                <StateBadge state={p.state} />
                <span className="text-sm text-gray-300 truncate flex-1 group-hover:text-white transition-colors">
                  {p.name || p.proposalPk}
                </span>
                <svg className="w-3.5 h-3.5 text-gray-700 group-hover:text-gray-400 transition-colors shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
