"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { StateBadge, Badge } from "@/components/ui/Badge";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { txUrl, isMainnetNetwork } from "@/lib/explorerUrl";
import { useAuth } from "@/context/AuthContext";

interface ProposalDetail {
  proposalPk: string;
  name: string;
  state: string;
  descriptionLink?: string;
  yesVotesCount?: number;
  noVotesCount?: number;
  denyVoteWeight?: string;
  vetoVoteWeight?: string;
  executingAt?: string;
  closedAt?: string;
  votingAt?: string;
}

interface ExecutionLog {
  id: string;
  proposalId: string;
  txSignature: string;
  status: string;
  walletRole: string;
  createdAt: string;
  error?: string;
}

type VoteChoice = "yes" | "no" | "abstain" | "veto";

export default function ProposalDetailPage() {
  const params = useParams();
  const realmPk = params.realmPk as string;
  const proposalPk = params.proposalPk as string;
  const { session } = useAuth();

  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  const [voting, setVoting] = useState(false);
  const [voteResult, setVoteResult] = useState<{ transactions?: string[]; message?: string } | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [selectedVote, setSelectedVote] = useState<VoteChoice | null>(null);
  const [sendingVoteTx, setSendingVoteTx] = useState(false);
  const [voteTxResult, setVoteTxResult] = useState<string | null>(null);

  const fetchProposal = useCallback(async () => {
    const [propRes, logRes] = await Promise.all([
      fetch(`/api/v1/realms/v2/${realmPk}/proposals/${proposalPk}`).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/v1/treasury/history").then((r) => (r.ok ? r.json() : [])),
    ]);
    setProposal(propRes);
    if (Array.isArray(logRes)) {
      setLogs(logRes.filter((l: ExecutionLog) => l.proposalId === proposalPk));
    }
    setLoading(false);
  }, [realmPk, proposalPk]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  async function handleVote(vote: VoteChoice) {
    if (!session) return;
    setVoting(true);
    setVoteError(null);
    setVoteResult(null);
    setSelectedVote(vote);
    setVoteTxResult(null);
    try {
      const res = await fetch(`/api/v1/realms/v2/${realmPk}/proposals/${proposalPk}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ vote }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVoteError(data.error || "Vote failed");
        setSelectedVote(null);
      } else {
        setVoteResult(data);
      }
    } catch (err) {
      setVoteError(String(err));
      setSelectedVote(null);
    } finally {
      setVoting(false);
    }
  }

  async function handleSendVoteTx() {
    if (!voteResult?.transactions || voteResult.transactions.length === 0) return;
    if (isMainnetNetwork()) {
      if (!confirm("You are on Mainnet-Beta. This transaction costs real SOL and cannot be reversed. Continue?")) return;
    }
    setSendingVoteTx(true);
    setVoteError(null);
    try {
      const res = await fetch("/api/v1/tx/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactions: voteResult.transactions,
          walletRole: "agent",
          abortOnFailure: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVoteError(data.error || "Transaction send failed");
      } else if (data.results?.[0]?.signature) {
        setVoteTxResult(data.results[0].signature);
        fetchProposal();
      }
    } catch (err) {
      setVoteError(String(err));
    } finally {
      setSendingVoteTx(false);
    }
  }

  async function handleExecute() {
    const msg = isMainnetNetwork()
      ? "Execute this proposal on Mainnet-Beta? This costs real SOL and cannot be reversed."
      : "Execute this proposal on-chain? This action cannot be undone.";
    if (!confirm(msg)) return;
    setExecuting(true);
    setExecError(null);
    setExecResult(null);
    try {
      const res = await fetch(`/api/v1/realms/v2/${realmPk}/proposals/${proposalPk}/execute`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setExecError(data.error || "Execution failed");
      } else {
        setExecResult(data.signature || data.txSignature || JSON.stringify(data));
        fetchProposal();
      }
    } catch (err) {
      setExecError(String(err));
    } finally {
      setExecuting(false);
    }
  }

  if (loading) return <SkeletonRows count={8} />;

  if (!proposal) {
    return (
      <Card className="py-16 text-center">
        <p className="text-sm text-gray-600">Proposal not found.</p>
      </Card>
    );
  }

  const canExecute = proposal.state === "Succeeded" || proposal.state === "3";
  const isVoting = proposal.state === "Voting" || proposal.state === "2";
  const yesCount = proposal.yesVotesCount ?? 0;
  const noCount = proposal.noVotesCount ?? 0;
  const totalVotes = yesCount + noCount;
  const yesPct = totalVotes > 0 ? Math.round((yesCount / totalVotes) * 100) : 0;
  const noPct = totalVotes > 0 ? Math.round((noCount / totalVotes) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dao/${realmPk}`} className="text-xs text-gray-500 hover:text-violet-400 transition-colors">
          ← Back to DAO
        </Link>
        <h1 className="text-xl font-bold text-white mt-2">
          {proposal.name || "Untitled Proposal"}
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <StateBadge state={proposal.state} />
          <span className="text-[11px] text-gray-600 font-mono">{proposalPk.slice(0, 16)}...</span>
        </div>
      </div>

      {/* Vote visualization */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">Vote Results</span>
          <span className="text-[10px] text-gray-600 tabular-nums">{totalVotes} total</span>
        </div>
        <div className="w-full h-3 rounded-full bg-white/[0.04] overflow-hidden flex">
          {totalVotes > 0 && (
            <>
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${yesPct}%` }}
              />
              <div
                className="h-full bg-rose-500 transition-all duration-500"
                style={{ width: `${noPct}%` }}
              />
            </>
          )}
        </div>
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-gray-400">Yes</span>
            <span className="text-sm font-bold text-emerald-400 tabular-nums">{yesCount}</span>
            {totalVotes > 0 && <span className="text-[10px] text-gray-600">({yesPct}%)</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-rose-400 tabular-nums">{noCount}</span>
            <span className="text-xs text-gray-400">No</span>
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            {totalVotes > 0 && <span className="text-[10px] text-gray-600">({noPct}%)</span>}
          </div>
        </div>
        {(proposal.denyVoteWeight && proposal.denyVoteWeight !== "0") && (
          <div className="flex items-center gap-4 mt-2 pt-2 border-t border-white/[0.04] text-[10px] text-gray-600">
            <span>Deny Weight: {proposal.denyVoteWeight}</span>
            {proposal.vetoVoteWeight && proposal.vetoVoteWeight !== "0" && (
              <span>Veto Weight: {proposal.vetoVoteWeight}</span>
            )}
          </div>
        )}
      </Card>

      {/* Voting action panel */}
      {isVoting && (
        <Card glow="purple" className="border-violet-500/10">
          <CardBody>
            {session ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-white font-semibold">Cast Your Vote</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Voting as {session.name} ({session.pubkey.slice(0, 8)}...)
                  </p>
                </div>

                <div className="flex gap-2">
                  {(["yes", "no", "abstain", "veto"] as VoteChoice[]).map((choice) => {
                    const colors: Record<VoteChoice, { base: string; active: string }> = {
                      yes: { base: "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10", active: "bg-emerald-500/20 border-emerald-500/40 ring-1 ring-emerald-500/30" },
                      no: { base: "border-rose-500/20 text-rose-400 hover:bg-rose-500/10", active: "bg-rose-500/20 border-rose-500/40 ring-1 ring-rose-500/30" },
                      abstain: { base: "border-gray-500/20 text-gray-400 hover:bg-gray-500/10", active: "bg-gray-500/20 border-gray-500/40 ring-1 ring-gray-500/30" },
                      veto: { base: "border-amber-500/20 text-amber-400 hover:bg-amber-500/10", active: "bg-amber-500/20 border-amber-500/40 ring-1 ring-amber-500/30" },
                    };
                    const isSelected = selectedVote === choice;
                    return (
                      <button
                        key={choice}
                        onClick={() => handleVote(choice)}
                        disabled={voting || sendingVoteTx}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 capitalize ${
                          isSelected ? colors[choice].active : colors[choice].base
                        }`}
                      >
                        {voting && selectedVote === choice ? "..." : choice}
                      </button>
                    );
                  })}
                </div>

                {voteResult && !voteTxResult && (
                  <div className="rounded-lg border border-violet-500/15 bg-violet-500/5 p-4 space-y-3">
                    <div>
                      <p className="text-xs text-violet-300 font-semibold">Transaction Ready</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {voteResult.message || "Sign and send to record your vote on-chain."}
                      </p>
                    </div>
                    {voteResult.transactions && voteResult.transactions.length > 0 ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={handleSendVoteTx}
                          disabled={sendingVoteTx}
                          className="px-5 py-2 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 transition-colors"
                        >
                          {sendingVoteTx ? "Sending..." : `Sign & Send (${voteResult.transactions.length} tx)`}
                        </button>
                        <span className="text-[9px] text-gray-600">
                          {voteResult.transactions.length > 1 && "Multi-tx flow — aborts on failure"}
                        </span>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-500">
                        Vote recorded. No unsigned transactions returned — the vote may have been processed directly.
                      </p>
                    )}
                  </div>
                )}

                {voteTxResult && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-[10px] text-emerald-400 mb-1">Vote submitted on-chain</p>
                    <a href={txUrl(voteTxResult)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-violet-400 hover:underline break-all">
                      {voteTxResult}
                    </a>
                  </div>
                )}

                {voteError && (
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                    <p className="text-xs text-rose-400">{voteError}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-sm text-gray-400">Log in as an agent to vote on this proposal.</p>
                <p className="text-[10px] text-gray-600 mt-1">
                  Go to <Link href="/agents" className="text-violet-400 hover:underline">Agents</Link> to create one.
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {proposal.descriptionLink && (
        <Card>
          <CardHeader>Description</CardHeader>
          <CardBody>
            <p className="text-sm text-gray-300 whitespace-pre-wrap break-all leading-relaxed">
              {proposal.descriptionLink}
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>Lifecycle</CardHeader>
        <CardBody>
          <div className="grid grid-cols-3 gap-6">
            {[
              { label: "Voting Started", value: proposal.votingAt },
              { label: "Executing At", value: proposal.executingAt },
              { label: "Closed At", value: proposal.closedAt },
            ].map((item) => (
              <div key={item.label}>
                <span className="text-[10px] text-gray-600 uppercase tracking-[0.15em] font-semibold block mb-1">{item.label}</span>
                <span className="text-xs text-gray-400">
                  {item.value ? new Date(item.value).toLocaleString() : "—"}
                </span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {canExecute && (
        <Card glow="yellow" className="border-amber-500/10">
          <CardBody>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-300 font-semibold">Ready to Execute</p>
                <p className="text-xs text-gray-500 mt-0.5">This proposal succeeded and can be executed on-chain.</p>
              </div>
              <button
                onClick={handleExecute}
                disabled={executing}
                className="px-5 py-2 rounded-lg text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 disabled:opacity-40 transition-colors"
              >
                {executing ? "Executing..." : "Execute Proposal"}
              </button>
            </div>
            {execResult && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                <p className="text-[10px] text-emerald-400 mb-1">Transaction sent</p>
                <a href={txUrl(execResult)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-violet-400 hover:underline break-all">
                  {execResult}
                </a>
              </div>
            )}
            {execError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
                <p className="text-xs text-rose-400">{execError}</p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>Execution Logs</CardHeader>
        {logs.length === 0 ? (
          <CardBody><p className="text-sm text-gray-600">No execution logs yet.</p></CardBody>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {logs.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-center gap-3">
                <Badge variant={log.status === "success" ? "green" : "red"}>{log.status}</Badge>
                {log.txSignature ? (
                  <a href={txUrl(log.txSignature)} target="_blank" rel="noopener noreferrer" className="text-[11px] font-mono text-violet-400 hover:underline truncate flex-1">
                    {log.txSignature}
                  </a>
                ) : (
                  <span className="text-[11px] text-gray-600 flex-1">—</span>
                )}
                <span className="text-[10px] text-gray-600 shrink-0 tabular-nums">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
