"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { addressUrl } from "@/lib/explorerUrl";
import { useAuth } from "@/context/AuthContext";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  walletPubkey: string;
  strategy: string;
  paused: boolean;
  autoVoteEnabled: boolean;
  executionEnabled: boolean;
  createdAt: string;
}

interface OnboardResult {
  agent: { id: string; name: string; walletPubkey: string; strategy: string };
  wallet: { publicKey: string; secretKey: string };
  token: string;
  network: string;
  funding: { note: string };
}

const STRATEGIES = [
  { value: "general", label: "General", desc: "No specific strategy bias" },
  { value: "conservative", label: "Conservative", desc: "Prefers low-risk, status-quo proposals" },
  { value: "growth", label: "Growth", desc: "Favors treasury expansion and new initiatives" },
  { value: "alignment", label: "Alignment", desc: "Prioritizes mission-aligned proposals" },
  { value: "yield", label: "Yield", desc: "Optimizes for DeFi yield and treasury returns" },
  { value: "defensive", label: "Defensive", desc: "Blocks risky proposals, protects treasury" },
];

const THRESHOLDS = [
  { value: "simple_majority", label: "Simple Majority (>50%)" },
  { value: "supermajority", label: "Supermajority (>66%)" },
  { value: "unanimous", label: "Unanimous (100%)" },
];

const FILTERS = [
  { value: "all", label: "All Proposals" },
  { value: "treasury_only", label: "Treasury Only" },
  { value: "parameter_only", label: "Parameter Changes Only" },
  { value: "defi_only", label: "DeFi Only" },
];

const STRATEGY_COLORS: Record<string, string> = {
  general: "gray", conservative: "blue", growth: "green",
  alignment: "purple", yield: "yellow", defensive: "red",
};

const inputCls = "w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition-all";
const selectCls = "w-full rounded-lg border border-white/[0.08] bg-[#0e0e16] px-3.5 py-2 text-sm text-white focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition-all";
const labelCls = "text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold block mb-1.5";

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<OnboardResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [tokenAgent, setTokenAgent] = useState<Agent | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const { session } = useAuth();

  const [form, setForm] = useState({
    name: "",
    description: "",
    strategy: "general",
    maxVotingPowerPct: 100,
    autoVoteEnabled: false,
    voteThreshold: "simple_majority",
    abstainOnLowInfo: true,
    proposalFilter: "all",
    executionEnabled: false,
    requireApproval: true,
  });

  function updateForm(patch: Partial<typeof form>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function resetForm() {
    setForm({
      name: "", description: "", strategy: "general", maxVotingPowerPct: 100,
      autoVoteEnabled: false, voteThreshold: "simple_majority", abstainOnLowInfo: true,
      proposalFilter: "all", executionEnabled: false, requireApproval: true,
    });
  }

  async function fetchAgents() {
    try {
      const res = await fetch("/api/v1/agents");
      if (res.ok) setAgents(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => { fetchAgents(); }, []);

  async function handleCreate() {
    if (!form.name.trim()) return;
    setCreating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/v1/agents/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Failed to create agent");
      else {
        setResult(data);
        resetForm();
        fetchAgents();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(deleteTarget.id);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/v1/agents/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setAgents((prev) => prev.filter((a) => a.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        const d = await res.json();
        setDeleteError(d.error || "Failed to delete agent");
      }
    } catch {
      setDeleteError("Failed to delete agent");
    } finally {
      setDeleting(null);
    }
  }

  function handleSetActive() {
    if (!tokenAgent || !tokenInput.trim()) return;
    const s = { token: tokenInput.trim(), pubkey: tokenAgent.walletPubkey, name: tokenAgent.name, agentId: tokenAgent.id };
    localStorage.setItem("swarm_session", JSON.stringify(s));
    setTokenAgent(null);
    setTokenInput("");
    window.location.reload();
  }

  function copyToClipboard(text: string) { navigator.clipboard.writeText(text); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Agents</h1>
          <p className="text-sm text-gray-500 mt-1">{agents.length} AI agent{agents.length !== 1 ? "s" : ""} registered</p>
        </div>
        <button
          onClick={() => { setShowCreate(!showCreate); setResult(null); setError(null); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Agent
        </button>
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <Card glow="red">
          <CardBody className="space-y-3">
            <p className="text-sm text-white font-semibold">Delete &ldquo;{deleteTarget.name}&rdquo;?</p>
            <p className="text-xs text-gray-400">This removes the agent and all its memberships. This cannot be undone.</p>
            {deleteError && <p className="text-xs text-rose-400">{deleteError}</p>}
            <div className="flex items-center gap-3">
              <button onClick={confirmDelete} disabled={deleting === deleteTarget.id}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-40 transition-colors">
                {deleting === deleteTarget.id ? "Deleting..." : "Confirm Delete"}
              </button>
              <button onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                className="px-4 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Cancel
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Set Active Agent Token Modal ── */}
      {tokenAgent && (
        <Card glow="purple">
          <CardBody className="space-y-3">
            <p className="text-sm text-white font-semibold">Set &ldquo;{tokenAgent.name}&rdquo; as Active Agent</p>
            <p className="text-xs text-gray-400">Paste the JWT token for this agent below.</p>
            <input type="text" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste JWT token here" className={inputCls} autoFocus />
            <div className="flex items-center gap-3">
              <button onClick={handleSetActive} disabled={!tokenInput.trim()}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 transition-colors">
                Activate
              </button>
              <button onClick={() => { setTokenAgent(null); setTokenInput(""); }}
                className="px-4 py-2 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Cancel
              </button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Create Form ── */}
      {showCreate && (
        <Card glow="purple">
          <CardHeader>New Agent</CardHeader>
          <CardBody className="space-y-6">

            {/* Section: Identity */}
            <div>
              <h3 className="text-xs text-white font-semibold mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-violet-500/10 flex items-center justify-center text-violet-400 text-[9px] font-bold">1</span>
                Identity
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Name *</label>
                  <input type="text" value={form.name} onChange={(e) => updateForm({ name: e.target.value })}
                    placeholder="e.g. Treasury Guardian" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Description</label>
                  <input type="text" value={form.description} onChange={(e) => updateForm({ description: e.target.value })}
                    placeholder="What does this agent do?" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Strategy</label>
                  <select value={form.strategy} onChange={(e) => updateForm({ strategy: e.target.value })} className={selectCls}>
                    {STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <p className="text-[9px] text-gray-600 mt-1">
                    {STRATEGIES.find((s) => s.value === form.strategy)?.desc}
                  </p>
                </div>
              </div>
            </div>

            {/* Section: Governance Scope */}
            <div>
              <h3 className="text-xs text-white font-semibold mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-violet-500/10 flex items-center justify-center text-violet-400 text-[9px] font-bold">2</span>
                Governance Scope
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Max Voting Power (%)</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={1} max={100} value={form.maxVotingPowerPct}
                      onChange={(e) => updateForm({ maxVotingPowerPct: Number(e.target.value) })}
                      className="flex-1 accent-violet-500" />
                    <span className="text-sm text-white font-mono w-10 text-right tabular-nums">{form.maxVotingPowerPct}%</span>
                  </div>
                  <p className="text-[9px] text-gray-600 mt-1">Caps the % of available voting power this agent uses per DAO.</p>
                </div>
                <div>
                  <label className={labelCls}>Proposal Filter</label>
                  <select value={form.proposalFilter} onChange={(e) => updateForm({ proposalFilter: e.target.value })} className={selectCls}>
                    {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <p className="text-[9px] text-gray-600 mt-1">Restrict which proposal types this agent considers.</p>
                </div>
              </div>
            </div>

            {/* Section: Voting Behavior */}
            <div>
              <h3 className="text-xs text-white font-semibold mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-violet-500/10 flex items-center justify-center text-violet-400 text-[9px] font-bold">3</span>
                Voting Behavior
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Vote Threshold</label>
                  <select value={form.voteThreshold} onChange={(e) => updateForm({ voteThreshold: e.target.value })} className={selectCls}>
                    {THRESHOLDS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <ToggleField label="Auto-Vote" value={form.autoVoteEnabled}
                  onChange={(v) => updateForm({ autoVoteEnabled: v })}
                  desc="Agent votes automatically without manual trigger" />
                <ToggleField label="Abstain on Low Info" value={form.abstainOnLowInfo}
                  onChange={(v) => updateForm({ abstainOnLowInfo: v })}
                  desc="Abstain when proposal lacks sufficient detail" />
              </div>
            </div>

            {/* Section: Risk Controls */}
            <div>
              <h3 className="text-xs text-white font-semibold mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-violet-500/10 flex items-center justify-center text-violet-400 text-[9px] font-bold">4</span>
                Risk Controls
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ToggleField label="Execution Authority" value={form.executionEnabled}
                  onChange={(v) => updateForm({ executionEnabled: v })}
                  desc="Allow this agent to execute proposals on-chain"
                  warn={form.executionEnabled} warnText="Agent can execute transactions" />
                <ToggleField label="Require Manual Approval" value={form.requireApproval}
                  onChange={(v) => updateForm({ requireApproval: v })}
                  desc="Require human approval before any execution" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
              <button onClick={handleCreate} disabled={creating || !form.name.trim()}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 transition-colors">
                {creating ? "Creating..." : "Create Agent"}
              </button>
              <button onClick={() => { setShowCreate(false); resetForm(); }}
                className="px-4 py-2.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Cancel
              </button>
              <p className="text-[10px] text-amber-500/80 ml-auto">Wallet auto-generated. Fund with SOL for tx fees.</p>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                <p className="text-xs text-rose-400">{error}</p>
              </div>
            )}

            {result && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="green">Created</Badge>
                  <span className="text-xs text-white font-medium">{result.agent.name}</span>
                  <Badge variant={STRATEGY_COLORS[result.agent.strategy] || "gray"}>{result.agent.strategy}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-gray-500 text-[10px]">Public Key</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-gray-300 font-mono text-[10px] truncate">{result.wallet.publicKey}</p>
                      <button onClick={() => copyToClipboard(result.wallet.publicKey)}
                        className="text-gray-600 hover:text-violet-400 shrink-0">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-amber-400 text-[10px]">Secret Key (save this!)</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-amber-300 font-mono text-[10px] truncate">{result.wallet.secretKey}</p>
                      <button onClick={() => copyToClipboard(result.wallet.secretKey)}
                        className="text-gray-600 hover:text-amber-400 shrink-0">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                      </button>
                    </div>
                    <p className="text-[9px] text-amber-500/60 mt-1">This will not be shown again.</p>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 md:col-span-2">
                  <p className="text-[10px] text-amber-400 font-semibold">Fund This Wallet</p>
                  <p className="text-[9px] text-gray-500 mt-0.5">{result.funding?.note || "Send SOL to this address to cover transaction fees."}</p>
                </div>
                <button
                  onClick={() => {
                    const s = { token: result.token, pubkey: result.wallet.publicKey, name: result.agent.name, agentId: result.agent.id };
                    localStorage.setItem("swarm_session", JSON.stringify(s));
                    window.location.reload();
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500 transition-colors"
                >
                  Set as Active Agent
                </button>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* ── Agent Grid ── */}
      {loading ? (
        <SkeletonRows count={5} />
      ) : agents.length === 0 ? (
        <Card className="py-16 text-center">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm text-gray-500 mb-1">No agents yet</p>
          <p className="text-xs text-gray-600">Click &quot;Create Agent&quot; above to onboard your first AI agent.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.id} className={`p-0 hover:border-white/10 transition-colors group overflow-hidden ${agent.paused ? "opacity-60" : ""}`}>
              <div className="p-5 cursor-pointer" onClick={() => window.location.href = `/agents/${agent.id}`}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600/30 to-violet-400/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-violet-400">{agent.name?.[0]?.toUpperCase() ?? "?"}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white group-hover:text-violet-400 transition-colors truncate">{agent.name}</h3>
                      {agent.paused && <Badge variant="red">Paused</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant={STRATEGY_COLORS[agent.strategy] || "gray"}>{agent.strategy}</Badge>
                      {agent.autoVoteEnabled && <Badge variant="purple">Auto-vote</Badge>}
                      {agent.executionEnabled && <Badge variant="yellow">Executor</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <p className="text-[10px] text-gray-500 font-mono truncate">{agent.walletPubkey.slice(0, 12)}...{agent.walletPubkey.slice(-4)}</p>
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); window.open(addressUrl(agent.walletPubkey), "_blank", "noopener,noreferrer"); }}
                        className="text-gray-600 hover:text-violet-400 shrink-0 p-0.5" title="View on Solscan">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-5 py-2.5 border-t border-white/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link href={`/agents/${agent.id}`} className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
                    Configure
                  </Link>
                  {session?.agentId === agent.id ? (
                    <span className="text-[9px] text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Active
                    </span>
                  ) : (
                    <button onClick={(e) => { e.stopPropagation(); setTokenAgent(agent); setTokenInput(""); }}
                      className="text-[10px] text-gray-600 hover:text-violet-400 transition-colors">
                      Set active
                    </button>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(agent); setDeleteError(null); }}
                  disabled={deleting === agent.id}
                  className="text-[10px] text-gray-600 hover:text-rose-400 disabled:opacity-40 transition-colors">
                  {deleting === agent.id ? "..." : "Delete"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleField({
  label, value, onChange, desc, warn, warnText,
}: {
  label: string; value: boolean; onChange: (v: boolean) => void;
  desc: string; warn?: boolean; warnText?: string;
}) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold block mb-1.5">{label}</label>
      <button type="button" onClick={() => onChange(!value)}
        className={`relative w-10 h-5 rounded-full transition-colors ${value ? "bg-violet-600" : "bg-white/[0.08]"}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : ""}`} />
      </button>
      <p className="text-[9px] text-gray-600 mt-1">{desc}</p>
      {warn && warnText && (
        <p className="text-[9px] text-amber-400 mt-0.5">{warnText}</p>
      )}
    </div>
  );
}
