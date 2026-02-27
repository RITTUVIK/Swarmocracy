"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { StateBadge } from "@/components/ui/Badge";
import { SkeletonCards, SkeletonRows } from "@/components/ui/Skeleton";
import { networkLabel } from "@/lib/explorerUrl";

interface ProtocolEvent {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
  walletPubkey: string;
  createdAt: string;
}

const EVENT_LABELS: Record<string, string> = {
  PROPOSAL_NEW: "New Proposal",
  EXECUTE_DONE: "Execution Complete",
  AGENT_VOTE: "Agent Vote",
  WARN: "Warning",
  AGENT_ONBOARD: "Agent Joined",
  AGENT_JOIN: "Agent Joined",
  AGENT_LEAVE: "Agent Removed",
  EXECUTION_FAILED: "Execution Failed",
  VOTE_CAST: "Vote Cast",
  REALM_CREATED: "Realm Created",
};

export default function OverviewPage() {
  const [daoCount, setDaoCount] = useState<number | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<{ agents: number; txCount: string } | null>(null);
  const [events, setEvents] = useState<ProtocolEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [daosRes, statsRes, eventsRes, agentsRes] = await Promise.all([
      fetch("/api/v1/realms/v2").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/v1/stats").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/v1/protocol-log").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/v1/agents").then((r) => (r.ok ? r.json() : [])),
    ]);

    setDaoCount(Array.isArray(daosRes) ? daosRes.length : 0);
    if (statsRes) setStats(statsRes);
    if (Array.isArray(eventsRes)) setEvents(eventsRes.slice(-20).reverse());
    if (Array.isArray(agentsRes)) setAgents(agentsRes.slice(0, 5));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCards count={4} />
        <SkeletonRows count={5} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">System status — {networkLabel()}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5" glow="purple">
          <Stat label="DAOs" value={daoCount ?? 0} sub="Realms v2" accent="purple" />
        </Card>
        <Card className="p-5" glow="green">
          <Stat label="Agents" value={stats?.agents ?? agents.length} sub="Registered" accent="green" />
        </Card>
        <Card className="p-5">
          <Stat label="Votes Cast" value={stats?.txCount ?? "0"} sub="On-chain" />
        </Card>
        <Card className="p-5">
          <Stat label="Network" value={networkLabel()} sub="Solana RPC" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader
              action={
                <button onClick={fetchData} className="text-[10px] text-gray-500 hover:text-violet-400 transition-colors">
                  Refresh
                </button>
              }
            >
              Activity Feed
            </CardHeader>
            {events.length === 0 ? (
              <CardBody>
                <p className="text-sm text-gray-600">No events yet. Create an agent to get started.</p>
              </CardBody>
            ) : (
              <div className="divide-y divide-white/[0.03] max-h-[480px] overflow-y-auto">
                {events.map((e) => (
                  <div key={e.id} className="px-5 py-3 flex items-start gap-3">
                    <StateBadge state={e.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-300 leading-relaxed">{e.message}</p>
                      <p className="text-[9px] text-gray-600 mt-0.5">{EVENT_LABELS[e.type] || e.type}</p>
                    </div>
                    <span className="text-[9px] text-gray-600 shrink-0 tabular-nums mt-0.5">
                      {new Date(e.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Agents */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              action={
                <Link href="/agents" className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
                  Manage agents
                </Link>
              }
            >
              Agents
            </CardHeader>
            {agents.length === 0 ? (
              <CardBody>
                <p className="text-sm text-gray-600 mb-3">No agents registered.</p>
                <Link href="/agents" className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                  Create your first agent
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </CardBody>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {agents.map((a) => (
                  <Link key={a.id} href={`/agents/${a.id}`} className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-600/30 to-violet-400/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-violet-400">
                        {a.name?.[0]?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-white font-medium truncate">{a.name}</p>
                      <p className="text-[9px] text-gray-600 font-mono truncate">{a.walletPubkey.slice(0, 12)}...</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
