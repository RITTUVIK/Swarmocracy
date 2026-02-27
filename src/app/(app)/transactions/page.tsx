"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { txUrl, addressUrl } from "@/lib/explorerUrl";

// ─── Types ───────────────────────────────────────────────────────────

interface Vote {
  id: string;
  vote: string;
  voterPubkey: string;
  txSignature: string | null;
  createdAt: string;
  proposal: { name: string; realmId: string; state: string };
}

interface OmniPairExecution {
  id: string;
  daoPk: string;
  proposalPk: string;
  executionType: string;
  assetMint: string;
  collateralMint: string | null;
  amount: string;
  status: string;
  txSignature: string | null;
  errorMessage: string | null;
  createdAt: string;
  executedAt: string | null;
}

interface ExecutionLog {
  id: string;
  type: string;
  status: string;
  txSignature: string | null;
  error: string | null;
  createdAt: string;
  proposal: { name: string; realmId: string };
}

interface ProtocolEvent {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

type Tab = "omnipair" | "votes" | "executions" | "activity";

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
      <a href={addressUrl(pk)} target="_blank" rel="noopener noreferrer"
        className="text-[10px] font-mono text-violet-400 hover:underline">
        {pk.slice(0, 6)}...{pk.slice(-4)}
      </a>
      <CopyBtn text={pk} />
    </span>
  );
}

function TxLink({ sig }: { sig: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <a href={txUrl(sig)} target="_blank" rel="noopener noreferrer"
        className="text-[10px] font-mono text-violet-400 hover:underline">
        {sig.slice(0, 12)}...{sig.slice(-4)}
      </a>
      <CopyBtn text={sig} />
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const v = status === "executed" || status === "success" ? "green"
    : status === "failed" ? "red"
    : status === "pending" ? "yellow"
    : "gray";
  return <Badge variant={v}>{status}</Badge>;
}

const EXEC_TYPE_LABELS: Record<string, string> = {
  borrow: "Borrow", lend: "Lend", repay: "Repay", refinance: "Refinance",
  omnipair_borrow: "OmniPair Borrow", omnipair_lend: "OmniPair Lend",
  omnipair_repay: "OmniPair Repay", omnipair_refinance: "OmniPair Refinance",
  realms_execute: "Realms Execute", defi_instructions: "DeFi Instructions",
};

// ─── Page ────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [tab, setTab] = useState<Tab>("omnipair");
  const [votes, setVotes] = useState<Vote[]>([]);
  const [omnipairExecs, setOmnipairExecs] = useState<OmniPairExecution[]>([]);
  const [execLogs, setExecLogs] = useState<ExecutionLog[]>([]);
  const [events, setEvents] = useState<ProtocolEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/transactions");
      if (res.ok) {
        const data = await res.json();
        setVotes(data.votes || []);
        setOmnipairExecs(data.omnipairExecutions || []);
        setExecLogs(data.executionLogs || []);
        setEvents(data.events || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "omnipair", label: "OmniPair", count: omnipairExecs.length },
    { key: "votes", label: "Votes", count: votes.length },
    { key: "executions", label: "Executions", count: execLogs.length },
    { key: "activity", label: "Activity", count: events.length },
  ];

  if (loading) return <SkeletonRows count={8} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Transactions</h1>
        <p className="text-sm text-gray-500 mt-1">Governance-to-execution audit trail. Read-only.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.04] pb-px">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs font-medium rounded-t-lg transition-colors ${
              tab === t.key
                ? "bg-white/[0.06] text-white border-b-2 border-violet-500"
                : "text-gray-500 hover:text-gray-300"
            }`}>
            {t.label}
            {t.count > 0 && <span className="ml-1.5 text-[9px] tabular-nums text-gray-600">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* OmniPair Executions */}
      {tab === "omnipair" && (
        <Card>
          <CardHeader>OmniPair Executions</CardHeader>
          {omnipairExecs.length === 0 ? (
            <CardBody>
              <p className="text-sm text-gray-600">No OmniPair executions yet.</p>
              <p className="text-xs text-gray-700 mt-1">OmniPair actions are triggered when a governance proposal containing DeFi instructions passes and is executed.</p>
            </CardBody>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {omnipairExecs.map((ex) => (
                <div key={ex.id} className="px-5 py-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={ex.status} />
                    <Badge variant="purple">{EXEC_TYPE_LABELS[ex.executionType] || ex.executionType}</Badge>
                    <span className="text-xs text-white font-medium flex-1">
                      {ex.amount && ex.amount !== "0" ? `${ex.amount} ` : ""}
                      {ex.executionType}
                    </span>
                    <span className="text-[10px] text-gray-600 tabular-nums">{new Date(ex.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                    <div>
                      <span className="text-gray-600 uppercase tracking-wider">DAO</span>
                      <div className="mt-0.5"><Addr pk={ex.daoPk} /></div>
                    </div>
                    <div>
                      <span className="text-gray-600 uppercase tracking-wider">Proposal</span>
                      <div className="mt-0.5"><Addr pk={ex.proposalPk} /></div>
                    </div>
                    <div>
                      <span className="text-gray-600 uppercase tracking-wider">Asset</span>
                      <div className="mt-0.5">{ex.assetMint ? <Addr pk={ex.assetMint} /> : <span className="text-gray-700">—</span>}</div>
                    </div>
                    {ex.collateralMint && (
                      <div>
                        <span className="text-gray-600 uppercase tracking-wider">Collateral</span>
                        <div className="mt-0.5"><Addr pk={ex.collateralMint} /></div>
                      </div>
                    )}
                  </div>
                  {ex.txSignature && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-gray-600 uppercase">TX:</span>
                      <TxLink sig={ex.txSignature} />
                    </div>
                  )}
                  {ex.errorMessage && (
                    <div className="rounded bg-rose-500/5 border border-rose-500/10 px-3 py-1.5">
                      <p className="text-[10px] text-rose-400">{ex.errorMessage}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Governance Votes */}
      {tab === "votes" && (
        <Card>
          <CardHeader>Governance Votes</CardHeader>
          {votes.length === 0 ? (
            <CardBody><p className="text-sm text-gray-600">No votes recorded yet.</p></CardBody>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {votes.map((v) => (
                <div key={v.id} className="px-5 py-3 flex items-center gap-3">
                  <Badge variant={v.vote === "yes" ? "green" : v.vote === "no" ? "red" : v.vote === "veto" ? "yellow" : "gray"}>
                    {v.vote}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-white truncate">{v.proposal.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-gray-600">Voter:</span>
                      <Addr pk={v.voterPubkey} />
                      <span className="text-[9px] text-gray-600 ml-2">DAO:</span>
                      <Addr pk={v.proposal.realmId} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {v.txSignature ? <TxLink sig={v.txSignature} /> : <span className="text-[10px] text-gray-600">Local</span>}
                    <p className="text-[9px] text-gray-600 tabular-nums mt-0.5">{new Date(v.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Execution Logs */}
      {tab === "executions" && (
        <Card>
          <CardHeader>Execution History</CardHeader>
          {execLogs.length === 0 ? (
            <CardBody><p className="text-sm text-gray-600">No executions yet.</p></CardBody>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {execLogs.map((log) => (
                <div key={log.id} className="px-5 py-3 flex items-center gap-3">
                  <StatusBadge status={log.status} />
                  <span className="text-[10px] text-gray-500 uppercase font-semibold w-28 shrink-0">{log.type}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-300 truncate">{log.proposal.name}</p>
                    {log.txSignature && (
                      <div className="mt-0.5"><TxLink sig={log.txSignature} /></div>
                    )}
                    {log.error && <p className="text-[9px] text-rose-400 mt-0.5 truncate">{log.error}</p>}
                  </div>
                  <span className="text-[10px] text-gray-600 shrink-0 tabular-nums">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Activity Feed */}
      {tab === "activity" && (
        <Card>
          <CardHeader
            action={
              <button onClick={fetchData} className="text-[10px] text-gray-500 hover:text-violet-400 transition-colors">Refresh</button>
            }
          >
            Protocol Activity
          </CardHeader>
          {events.length === 0 ? (
            <CardBody><p className="text-sm text-gray-600">No activity yet.</p></CardBody>
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {events.map((e) => {
                const color = e.type.includes("DONE") || e.type.includes("success") ? "green"
                  : e.type.includes("FAIL") || e.type.includes("ERROR") ? "red"
                  : e.type.includes("START") ? "yellow"
                  : e.type.includes("VOTE") ? "blue"
                  : "gray";
                return (
                  <div key={e.id} className="px-5 py-3 flex items-center gap-3">
                    <Badge variant={color}>{e.type.replace(/_/g, " ")}</Badge>
                    <p className="text-xs text-gray-300 flex-1 truncate">{e.message}</p>
                    <span className="text-[10px] text-gray-600 shrink-0 tabular-nums">{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Safety Notice */}
      <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-4">
        <p className="text-[10px] text-gray-600 leading-relaxed">
          This page is read-only. OmniPair executions are only triggered through passed governance proposals. No manual DeFi transactions can be initiated from this interface. All signatures link to Solana mainnet explorer.
        </p>
      </div>
    </div>
  );
}
