"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { SkeletonCards, SkeletonRows } from "@/components/ui/Skeleton";
import { txUrl, addressUrl } from "@/lib/explorerUrl";

// ─── Types ───────────────────────────────────────────────────────────

interface TreasuryDashboard {
  treasury: { walletPubkey: string; balanceSol: number; realmId: string } | null;
  allTreasuries: { realmId: string; walletPubkey: string; createdAt: string }[];
  summary: {
    totalBalanceSol: number;
    totalDeployedVolume: number;
    activePositionsCount: number;
    availableLiquidity: number;
  };
  positions: Position[];
  metrics: {
    successCount: number;
    failedCount: number;
    successRate: number;
    totalExecutedVolume: number;
    avgLatencyMs: number;
    lastExecution: string | null;
  };
  timeline: TimelineGroup[];
  executionLogs: ExecLog[];
  events: ProtocolEvt[];
  risk: {
    capitalDeployedPct: number;
    capitalIdlePct: number;
    activeBorrowCount: number;
    activeLendCount: number;
  };
}

interface Position {
  id: string;
  daoPk: string;
  proposalPk: string;
  executionType: string;
  assetMint: string;
  collateralMint: string | null;
  amount: string;
  status: string;
  txSignature: string | null;
  treasuryPk: string | null;
  executedBy: string;
  errorMessage: string | null;
  createdAt: string;
  executedAt: string | null;
}

interface ExecLog {
  id: string;
  type: string;
  status: string;
  txSignature: string | null;
  error: string | null;
  createdAt: string;
  proposalId: string;
  proposal: { name: string; realmId: string; state: string };
}

interface TimelineGroup {
  proposalId: string;
  proposalName: string;
  events: { type: string; timestamp: string; txSignature?: string | null; status?: string }[];
}

interface ProtocolEvt {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}
      className="text-gray-600 hover:text-violet-400 transition-colors" title="Copy">
      {ok ? (
        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
      )}
    </button>
  );
}

function Addr({ pk }: { pk: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <a href={addressUrl(pk)} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-violet-400 hover:underline">
        {pk.slice(0, 6)}...{pk.slice(-4)}
      </a>
      <CopyBtn text={pk} />
    </span>
  );
}

function TxLink({ sig }: { sig: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <a href={txUrl(sig)} target="_blank" rel="noopener noreferrer" className="text-[10px] font-mono text-violet-400 hover:underline">
        {sig.slice(0, 12)}...{sig.slice(-4)}
      </a>
      <CopyBtn text={sig} />
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const v = status === "executed" || status === "success" ? "green" : status === "failed" ? "red" : status === "pending" ? "yellow" : "gray";
  return <Badge variant={v}>{status}</Badge>;
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  borrow: "Borrow", lend: "Lend", repay: "Repay", refinance: "Refinance",
  omnipair_borrow: "OmniPair Borrow", omnipair_lend: "OmniPair Lend",
  omnipair_repay: "OmniPair Repay", omnipair_refinance: "OmniPair Refinance",
  realms_execute: "Realms Execute", defi_instructions: "DeFi Instructions",
};

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ─── Page ────────────────────────────────────────────────────────────

export default function TreasuryPage() {
  const [data, setData] = useState<TreasuryDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [noTreasury, setNoTreasury] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [expandedTimeline, setExpandedTimeline] = useState<Set<string>>(new Set());
  const [expandedExec, setExpandedExec] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/treasury/dashboard");
      if (res.ok) {
        const d = await res.json();
        setData(d);
        setNoTreasury(!d.treasury);
      } else if (res.status === 404) {
        setNoTreasury(true);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function handleInitialize() {
    const realmId = prompt("Enter the DAO Realm public key to initialize a treasury for:");
    if (!realmId?.trim()) return;
    setInitializing(true);
    setInitError(null);
    try {
      const res = await fetch("/api/v1/treasury/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realmId: realmId.trim() }),
      });
      const d = await res.json();
      if (!res.ok) setInitError(d.error || "Failed to initialize");
      else fetchData();
    } catch (e) { setInitError(String(e)); }
    finally { setInitializing(false); }
  }

  function toggleTimeline(id: string) {
    setExpandedTimeline((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleExec(id: string) {
    setExpandedExec((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  if (loading) return <div className="space-y-6"><SkeletonCards count={4} /><SkeletonRows count={6} /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Treasury</h1>
        <p className="text-sm text-gray-500 mt-1">Governance-Controlled Treasury Wallet — Read-Only</p>
      </div>

      {/* Failed executions warning */}
      {data && data.metrics.failedCount > 0 && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.964-.834-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-xs text-rose-400">
            <span className="font-semibold">{data.metrics.failedCount}</span> execution(s) failed.
            Review execution history below for details.
          </p>
        </div>
      )}

      {/* ─── Section A: Treasury Overview (Summary Grid) ─── */}
      {noTreasury && !data?.treasury ? (
        <Card glow="purple" className="p-8 text-center">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-400 mb-1">No treasury wallet configured</p>
          <p className="text-xs text-gray-600 mb-4">Initialize a governance-controlled treasury wallet to enable on-chain execution.</p>
          <button onClick={handleInitialize} disabled={initializing}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 transition-colors">
            {initializing ? "Initializing..." : "Initialize Treasury"}
          </button>
          {initError && <p className="text-xs text-rose-400 mt-3">{initError}</p>}
        </Card>
      ) : data && (
        <>
          {/* Wallet Identity */}
          {data.treasury && (
            <Card className="p-5" glow="purple">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">
                    Treasury Wallet (Governance Controlled)
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-white font-mono break-all">{data.treasury.walletPubkey}</p>
                    <CopyBtn text={data.treasury.walletPubkey} />
                    <a href={addressUrl(data.treasury.walletPubkey)} target="_blank" rel="noopener noreferrer"
                      className="text-gray-600 hover:text-violet-400 shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                  <p className="text-[9px] text-gray-600 mt-1">DAO: <Addr pk={data.treasury.realmId} /></p>
                </div>
                <Badge variant="purple">Governance PDA</Badge>
              </div>
            </Card>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5">
              <Stat label="SOL Balance" value={data.summary.totalBalanceSol.toFixed(4)} accent="green" sub="Idle capital" />
            </Card>
            <Card className="p-5">
              <Stat label="Deployed Volume" value={data.summary.totalDeployedVolume > 0 ? data.summary.totalDeployedVolume.toLocaleString() : "0"} accent="purple" sub="Via OmniPair" />
            </Card>
            <Card className="p-5">
              <Stat label="Available Liquidity" value={data.summary.availableLiquidity.toFixed(4)} sub="Ready to deploy" />
            </Card>
            <Card className="p-5">
              <Stat label="Active Positions" value={data.summary.activePositionsCount} accent={data.summary.activePositionsCount > 0 ? "yellow" : undefined} sub="Open on-chain" />
            </Card>
          </div>

          {/* ─── Section B: Balance Breakdown ─── */}
          <Card>
            <CardHeader>Balance Breakdown</CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs text-gray-300">SOL</span>
                </div>
                <span className="text-xs text-white font-mono tabular-nums">{data.summary.totalBalanceSol.toFixed(4)}</span>
              </div>
              <Bar pct={100} color="bg-emerald-500" />
              <p className="text-[9px] text-gray-600">100% SOL allocation. SPL token balances will appear here when treasury holds additional assets.</p>
            </CardBody>
          </Card>

          {/* ─── Section C: OmniPair Positions ─── */}
          <Card>
            <CardHeader>OmniPair Positions</CardHeader>
            {data.positions.length === 0 ? (
              <CardBody>
                <p className="text-sm text-gray-600">No active OmniPair positions.</p>
                <p className="text-xs text-gray-700 mt-1">Positions are created when governance proposals containing OmniPair instructions pass and are executed by the treasury authority.</p>
              </CardBody>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {data.positions.map((p) => (
                  <div key={p.id} className="px-5 py-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={p.status} />
                      <Badge variant="purple">{TYPE_LABELS[p.executionType] || p.executionType}</Badge>
                      <span className="text-xs text-white font-medium font-mono tabular-nums flex-1">{p.amount}</span>
                      <Badge variant="gray">{p.executedBy}</Badge>
                      <span className="text-[10px] text-gray-600 tabular-nums">{new Date(p.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                      <div>
                        <span className="text-gray-600 uppercase tracking-wider">Asset</span>
                        <div className="mt-0.5"><Addr pk={p.assetMint} /></div>
                      </div>
                      {p.collateralMint && (
                        <div>
                          <span className="text-gray-600 uppercase tracking-wider">Collateral</span>
                          <div className="mt-0.5"><Addr pk={p.collateralMint} /></div>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-600 uppercase tracking-wider">DAO</span>
                        <div className="mt-0.5"><Addr pk={p.daoPk} /></div>
                      </div>
                      <div>
                        <span className="text-gray-600 uppercase tracking-wider">Proposal</span>
                        <div className="mt-0.5"><Addr pk={p.proposalPk} /></div>
                      </div>
                    </div>
                    {p.treasuryPk && (
                      <div className="flex items-center gap-2 text-[9px]">
                        <span className="text-gray-600 uppercase">Signed by:</span>
                        <Addr pk={p.treasuryPk} />
                      </div>
                    )}
                    {p.txSignature && (
                      <div className="flex items-center gap-2 text-[9px]">
                        <span className="text-gray-600 uppercase">TX:</span>
                        <TxLink sig={p.txSignature} />
                      </div>
                    )}
                    {p.errorMessage && (
                      <div className="rounded bg-rose-500/5 border border-rose-500/10 px-3 py-1.5">
                        <p className="text-[10px] text-rose-400">{p.errorMessage}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ─── Section D: Capital Timeline ─── */}
          <Card>
            <CardHeader>Capital Timeline</CardHeader>
            {data.timeline.length === 0 ? (
              <CardBody><p className="text-sm text-gray-600">No capital events yet.</p></CardBody>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {data.timeline.map((group) => {
                  const isOpen = expandedTimeline.has(group.proposalId);
                  return (
                    <div key={group.proposalId}>
                      <button onClick={() => toggleTimeline(group.proposalId)}
                        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-white/[0.01] transition-colors text-left">
                        <svg className={`w-3 h-3 text-gray-600 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-white truncate">{group.proposalName}</p>
                          <p className="text-[9px] text-gray-600 font-mono">{group.proposalId.slice(0, 12)}...</p>
                        </div>
                        <span className="text-[10px] text-gray-600 tabular-nums">{group.events.length} event(s)</span>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 pl-11 space-y-2">
                          {group.events.map((evt, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 shrink-0" />
                              <span className="text-[10px] text-gray-500 uppercase font-semibold w-36 shrink-0">{TYPE_LABELS[evt.type] || evt.type}</span>
                              {evt.status && <StatusBadge status={evt.status} />}
                              {evt.txSignature && <TxLink sig={evt.txSignature} />}
                              <span className="text-[9px] text-gray-600 tabular-nums ml-auto">{new Date(evt.timestamp).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ─── Section E: Execution Metrics ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5">
              <Stat label="Success Rate" value={`${data.metrics.successRate}%`} accent={data.metrics.successRate >= 80 ? "green" : data.metrics.successRate >= 50 ? "yellow" : "red"} />
            </Card>
            <Card className="p-5">
              <Stat label="Executed Volume" value={data.metrics.totalExecutedVolume > 0 ? data.metrics.totalExecutedVolume.toLocaleString() : "0"} sub="Total OmniPair" />
            </Card>
            <Card className="p-5">
              <Stat label="Avg Latency" value={data.metrics.avgLatencyMs > 0 ? formatLatency(data.metrics.avgLatencyMs) : "—"} sub="Proposal → TX" />
            </Card>
            <Card className="p-5">
              <Stat label="Last Execution" value={data.metrics.lastExecution ? new Date(data.metrics.lastExecution).toLocaleDateString() : "Never"} sub={data.metrics.lastExecution ? new Date(data.metrics.lastExecution).toLocaleTimeString() : ""} />
            </Card>
          </div>

          {/* ─── Section F: Execution History (Improved) ─── */}
          <Card>
            <CardHeader>Execution History ({data.executionLogs.length})</CardHeader>
            {data.executionLogs.length === 0 ? (
              <CardBody><p className="text-sm text-gray-600">No executions yet.</p></CardBody>
            ) : (
              <div className="divide-y divide-white/[0.03]">
                {data.executionLogs.map((log) => {
                  const isOpen = expandedExec.has(log.id);
                  return (
                    <div key={log.id}>
                      <button onClick={() => toggleExec(log.id)}
                        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-white/[0.01] transition-colors text-left">
                        <svg className={`w-3 h-3 text-gray-600 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <StatusBadge status={log.status} />
                        <span className="text-[10px] text-gray-500 uppercase font-semibold w-32 shrink-0">{TYPE_LABELS[log.type] || log.type}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-300 truncate">{log.proposal.name}</p>
                        </div>
                        {log.txSignature && <TxLink sig={log.txSignature} />}
                        <span className="text-[10px] text-gray-600 shrink-0 tabular-nums">{new Date(log.createdAt).toLocaleString()}</span>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 pl-11 space-y-2">
                          <div className="grid grid-cols-2 gap-3 text-[10px]">
                            <div>
                              <span className="text-gray-600 uppercase tracking-wider">DAO</span>
                              <div className="mt-0.5"><Addr pk={log.proposal.realmId} /></div>
                            </div>
                            <div>
                              <span className="text-gray-600 uppercase tracking-wider">Proposal State</span>
                              <div className="mt-0.5"><Badge variant={log.proposal.state === "Completed" ? "green" : "gray"}>{log.proposal.state}</Badge></div>
                            </div>
                          </div>
                          {log.error && (
                            <div className="rounded bg-rose-500/5 border border-rose-500/10 px-3 py-2">
                              <span className="text-[9px] text-gray-600 uppercase font-semibold block mb-0.5">Error</span>
                              <p className="text-[10px] text-rose-400">{log.error}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* ─── Section G: Risk Indicator ─── */}
          <Card>
            <CardHeader>Risk Exposure</CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold block mb-1">Capital Deployed</span>
                  <span className={`text-lg font-bold tabular-nums ${data.risk.capitalDeployedPct > 80 ? "text-amber-400" : "text-white"}`}>
                    {data.risk.capitalDeployedPct}%
                  </span>
                  <Bar pct={data.risk.capitalDeployedPct} color={data.risk.capitalDeployedPct > 80 ? "bg-amber-500" : "bg-violet-500"} />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold block mb-1">Capital Idle</span>
                  <span className="text-lg font-bold text-white tabular-nums">{data.risk.capitalIdlePct}%</span>
                  <Bar pct={data.risk.capitalIdlePct} color="bg-emerald-500" />
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold block mb-1">Active Borrows</span>
                  <span className="text-lg font-bold text-white tabular-nums">{data.risk.activeBorrowCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold block mb-1">Active Lends</span>
                  <span className="text-lg font-bold text-white tabular-nums">{data.risk.activeLendCount}</span>
                </div>
              </div>
              {data.risk.capitalDeployedPct > 80 && (
                <div className="mt-4 rounded bg-amber-500/5 border border-amber-500/10 px-3 py-2">
                  <p className="text-[10px] text-amber-400">High deployment ratio. Over 80% of capital is in active positions. Consider reducing exposure.</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Safety notice */}
          <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-4 flex items-start gap-3">
            <svg className="w-4 h-4 text-gray-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div className="text-[10px] text-gray-600 leading-relaxed space-y-1">
              <p>This page is <span className="text-gray-400 font-semibold">read-only</span>. No execution controls are available here.</p>
              <p>Treasury transactions are only triggered through passed governance proposals. The treasury private key is encrypted at rest and never exposed to agents or the frontend.</p>
              <p>Agent wallets and treasury wallets are structurally separated. Agent keys cannot sign treasury transactions.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
