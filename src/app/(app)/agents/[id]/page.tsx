"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { StateBadge, Badge } from "@/components/ui/Badge";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { addressUrl, txUrl, isMainnetNetwork, networkLabel } from "@/lib/explorerUrl";

interface AgentDetail {
  id: string;
  name: string;
  description: string | null;
  walletPubkey: string;
  createdAt: string;
  strategy: string;
  allowedDaos: string[] | null;
  allowedMints: string[] | null;
  maxVotingPowerPct: number;
  autoVoteEnabled: boolean;
  voteThreshold: string;
  abstainOnLowInfo: boolean;
  proposalFilter: string;
  executionEnabled: boolean;
  requireApproval: boolean;
  paused: boolean;
  pausedAt: string | null;
  pausedReason: string | null;
  votes: {
    id: string;
    vote: string;
    txSignature: string | null;
    createdAt: string;
    proposal: { name: string; realmId: string; state: string };
  }[];
  memberships: { realmId: string }[];
  executionLogs: {
    id: string;
    type: string;
    status: string;
    txSignature: string | null;
    error: string | null;
    createdAt: string;
  }[];
}

const STRATEGIES = [
  { value: "general", label: "General" },
  { value: "conservative", label: "Conservative" },
  { value: "growth", label: "Growth" },
  { value: "alignment", label: "Alignment" },
  { value: "yield", label: "Yield" },
  { value: "defensive", label: "Defensive" },
];
const THRESHOLDS = [
  { value: "simple_majority", label: "Simple Majority" },
  { value: "supermajority", label: "Supermajority" },
  { value: "unanimous", label: "Unanimous" },
];
const FILTERS = [
  { value: "all", label: "All Proposals" },
  { value: "treasury_only", label: "Treasury Only" },
  { value: "parameter_only", label: "Parameter Changes" },
  { value: "defi_only", label: "DeFi Only" },
];

const STRATEGY_COLORS: Record<string, string> = {
  general: "gray", conservative: "blue", growth: "green",
  alignment: "purple", yield: "yellow", defensive: "red",
};

const labelCls = "text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold block mb-1.5";
const selectCls = "w-full rounded-lg border border-white/[0.08] bg-[#0e0e16] px-3 py-1.5 text-xs text-white focus:border-violet-500/40 focus:outline-none transition-all";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-gray-600 hover:text-violet-400 transition-colors shrink-0" title="Copy">
      {copied ? (
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  );
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!value)} disabled={disabled}
      className={`relative w-9 h-[18px] rounded-full transition-colors ${value ? "bg-violet-600" : "bg-white/[0.08]"} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
      <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${value ? "translate-x-[18px]" : ""}`} />
    </button>
  );
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number | null>(null);

  const fetchAgent = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/agents/${id}`);
      if (r.ok) setAgent(await r.json());
      else setAgent(null);
    } catch { setAgent(null); }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchAgent(); }, [fetchAgent]);

  useEffect(() => {
    if (!agent?.walletPubkey) return;
    fetch(`/api/v1/wallets/balance?pubkey=${agent.walletPubkey}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.balance !== undefined) setSolBalance(d.balance); })
      .catch(() => {});
  }, [agent?.walletPubkey]);

  async function patchAgent(patch: Record<string, unknown>) {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/v1/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setAgent((prev) => prev ? { ...prev, ...updated } : prev);
        setSaveMsg("Saved");
        setTimeout(() => setSaveMsg(null), 2000);
      } else {
        const d = await res.json();
        setSaveMsg(d.error || "Save failed");
      }
    } catch { setSaveMsg("Save failed"); }
    finally { setSaving(false); }
  }

  async function handlePause() {
    if (!agent) return;
    const reason = agent.paused ? null : prompt("Reason for pausing (optional):") ?? "Manually paused";
    await patchAgent({ paused: !agent.paused, pausedReason: reason });
  }

  async function handleDelete() {
    if (!agent || !confirm(`Delete "${agent.name}"? This removes the agent and all its memberships.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/agents/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/agents");
      else alert("Failed to delete agent");
    } catch { alert("Failed to delete agent"); }
    finally { setDeleting(false); }
  }

  if (loading) return <SkeletonRows count={8} />;
  if (!agent) return <Card className="py-16 text-center"><p className="text-sm text-gray-600">Agent not found.</p></Card>;

  const votesByType = { yes: 0, no: 0, abstain: 0, veto: 0 };
  agent.votes.forEach((v) => {
    const k = v.vote.toLowerCase() as keyof typeof votesByType;
    if (k in votesByType) votesByType[k]++;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/agents" className="text-xs text-gray-500 hover:text-violet-400 transition-colors">← All Agents</Link>
          <div className="flex items-center gap-3 mt-2">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600/30 to-violet-400/10 flex items-center justify-center ${agent.paused ? "opacity-50" : ""}`}>
              <span className="text-sm font-bold text-violet-400">{agent.name[0]?.toUpperCase()}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{agent.name}</h1>
                <Badge variant={STRATEGY_COLORS[agent.strategy] || "gray"}>{agent.strategy}</Badge>
                {agent.paused && <Badge variant="red">Paused</Badge>}
              </div>
              {agent.description && <p className="text-xs text-gray-500 mt-0.5">{agent.description}</p>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveMsg && (
            <span className={`text-[10px] ${saveMsg === "Saved" ? "text-emerald-400" : "text-rose-400"}`}>{saveMsg}</span>
          )}
          <button onClick={handlePause} disabled={saving}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors disabled:opacity-40 ${
              agent.paused
                ? "text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
                : "text-amber-400 border-amber-500/20 hover:bg-amber-500/10"
            }`}>
            {agent.paused ? "Resume" : "Pause"}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="px-3 py-1.5 rounded-lg text-xs text-rose-400 border border-rose-500/20 hover:bg-rose-500/10 disabled:opacity-40 transition-colors">
            {deleting ? "..." : "Delete"}
          </button>
        </div>
      </div>

      {/* Paused Warning */}
      {agent.paused && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-rose-400 font-semibold">Agent Paused</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {agent.pausedReason && <span>{agent.pausedReason} — </span>}
              {agent.pausedAt && <span>Paused {new Date(agent.pausedAt).toLocaleString()}</span>}
            </p>
          </div>
          <button onClick={handlePause} disabled={saving}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors">
            Resume Agent
          </button>
        </div>
      )}

      {/* Wallet & Stats */}
      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2">
            <span className={labelCls}>Wallet Address (Server-Controlled)</span>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-white font-mono break-all">{agent.walletPubkey}</p>
              <CopyButton text={agent.walletPubkey} />
              <a href={addressUrl(agent.walletPubkey)} target="_blank" rel="noopener noreferrer"
                className="text-gray-600 hover:text-violet-400 shrink-0" title="View on Solscan">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
            <p className="text-[10px] text-gray-600 mt-1">
              Private key stored server-side (encrypted). Never exposed to frontend. Joined {new Date(agent.createdAt).toLocaleDateString()}.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="SOL Balance" value={solBalance !== null ? solBalance.toFixed(4) : "..."} accent={solBalance !== null && solBalance < 0.01 ? "red" : undefined} />
            <Stat label="Votes" value={agent.votes.length} accent="purple" />
            <Stat label="DAOs" value={agent.memberships.length} accent="green" />
            <Stat label="Execs" value={agent.executionLogs.length} />
          </div>
        </div>
      </Card>

      {/* Low SOL Warning */}
      {solBalance !== null && solBalance < 0.01 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-400 font-semibold">Insufficient SOL for Transaction Fees</p>
          <p className="text-xs text-gray-500 mt-0.5">
            This agent has {solBalance.toFixed(6)} SOL. Send at least 0.01 SOL to{" "}
            <span className="font-mono text-gray-400">{agent.walletPubkey.slice(0, 16)}...</span> to cover {isMainnetNetwork() ? "mainnet" : "devnet"} transaction fees.
          </p>
        </div>
      )}

      {/* Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Governance Scope */}
        <Card>
          <CardHeader>Governance Scope</CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label className={labelCls}>Strategy</label>
              <select value={agent.strategy} onChange={(e) => patchAgent({ strategy: e.target.value })} className={selectCls} disabled={saving}>
                {STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Max Voting Power (%)</label>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={100} value={agent.maxVotingPowerPct}
                  onChange={(e) => patchAgent({ maxVotingPowerPct: Number(e.target.value) })}
                  className="flex-1 accent-violet-500" disabled={saving} />
                <span className="text-sm text-white font-mono w-10 text-right tabular-nums">{agent.maxVotingPowerPct}%</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>Proposal Filter</label>
              <select value={agent.proposalFilter} onChange={(e) => patchAgent({ proposalFilter: e.target.value })} className={selectCls} disabled={saving}>
                {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Allowed DAOs</label>
              <p className="text-xs text-gray-400">
                {agent.allowedDaos && agent.allowedDaos.length > 0
                  ? `${agent.allowedDaos.length} DAO(s) restricted`
                  : "All DAOs (unrestricted)"}
              </p>
              {agent.allowedDaos && agent.allowedDaos.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {agent.allowedDaos.map((pk) => (
                    <p key={pk} className="text-[10px] text-gray-500 font-mono">{pk.slice(0, 16)}...</p>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Allowed Mints</label>
              <p className="text-xs text-gray-400">
                {agent.allowedMints && agent.allowedMints.length > 0
                  ? `${agent.allowedMints.length} mint(s) restricted`
                  : "All governance tokens"}
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Voting & Risk */}
        <Card>
          <CardHeader>Voting Behavior & Risk</CardHeader>
          <CardBody className="space-y-4">
            <div>
              <label className={labelCls}>Vote Threshold</label>
              <select value={agent.voteThreshold} onChange={(e) => patchAgent({ voteThreshold: e.target.value })} className={selectCls} disabled={saving}>
                {THRESHOLDS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className={labelCls}>Auto-Vote</label>
                <p className="text-[9px] text-gray-600">Votes automatically without manual trigger</p>
              </div>
              <Toggle value={agent.autoVoteEnabled} onChange={(v) => patchAgent({ autoVoteEnabled: v })} disabled={saving} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className={labelCls}>Abstain on Low Info</label>
                <p className="text-[9px] text-gray-600">Abstain when proposal lacks detail</p>
              </div>
              <Toggle value={agent.abstainOnLowInfo} onChange={(v) => patchAgent({ abstainOnLowInfo: v })} disabled={saving} />
            </div>
            <div className="border-t border-white/[0.04] pt-4">
              <p className="text-[10px] text-gray-400 uppercase tracking-[0.15em] font-semibold mb-3">Risk Controls</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className={labelCls}>Execution Authority</label>
                <p className="text-[9px] text-gray-600">Can execute proposals on-chain</p>
                {agent.executionEnabled && (
                  <p className="text-[9px] text-amber-400 mt-0.5">Agent can send transactions</p>
                )}
              </div>
              <Toggle value={agent.executionEnabled} onChange={(v) => patchAgent({ executionEnabled: v })} disabled={saving} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className={labelCls}>Require Manual Approval</label>
                <p className="text-[9px] text-gray-600">Human approval before execution</p>
              </div>
              <Toggle value={agent.requireApproval} onChange={(v) => patchAgent({ requireApproval: v })} disabled={saving} />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Vote Summary */}
      {agent.votes.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {(["yes", "no", "abstain", "veto"] as const).map((type) => {
            const colors = { yes: "green", no: "red", abstain: "gray", veto: "yellow" } as const;
            return (
              <Card key={type} className="p-4 text-center">
                <div className="text-lg font-bold text-white tabular-nums">{votesByType[type]}</div>
                <Badge variant={colors[type]}>{type}</Badge>
              </Card>
            );
          })}
        </div>
      )}

      {/* Voting History */}
      <Card>
        <CardHeader>Voting History</CardHeader>
        {agent.votes.length === 0 ? (
          <CardBody><p className="text-sm text-gray-600">No votes recorded yet.</p></CardBody>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {agent.votes.map((v) => (
              <div key={v.id} className="px-5 py-3 flex items-center gap-3">
                <Badge variant={v.vote === "yes" ? "green" : v.vote === "no" ? "red" : v.vote === "veto" ? "yellow" : "gray"}>
                  {v.vote}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white truncate">{v.proposal.name}</p>
                  <p className="text-[9px] text-gray-600 font-mono truncate">DAO: {v.proposal.realmId.slice(0, 16)}...</p>
                </div>
                <StateBadge state={v.proposal.state} />
                <div className="shrink-0 text-right">
                  {v.txSignature ? (
                    <a href={txUrl(v.txSignature)} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] font-mono text-violet-400 hover:underline">
                      {v.txSignature.slice(0, 12)}...
                    </a>
                  ) : (
                    <span className="text-[10px] text-gray-600">Local</span>
                  )}
                  <p className="text-[9px] text-gray-600 tabular-nums">{new Date(v.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Execution History */}
      {agent.executionLogs.length > 0 && (
        <Card>
          <CardHeader>Execution History</CardHeader>
          <div className="divide-y divide-white/[0.03]">
            {agent.executionLogs.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-center gap-3">
                <Badge variant={log.status === "success" ? "green" : "red"}>{log.status}</Badge>
                <span className="text-[10px] text-gray-500 uppercase font-semibold w-20 shrink-0">{log.type}</span>
                {log.txSignature ? (
                  <a href={txUrl(log.txSignature)} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] font-mono text-violet-400 hover:underline truncate flex-1">
                    {log.txSignature}
                  </a>
                ) : (
                  <span className="text-[11px] text-gray-600 flex-1">—</span>
                )}
                {log.error && <span className="text-[9px] text-rose-400 shrink-0 max-w-32 truncate">{log.error}</span>}
                <span className="text-[10px] text-gray-600 shrink-0 tabular-nums">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
