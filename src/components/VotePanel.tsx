"use client";

import { useState } from "react";

interface VotePanelProps {
  realmId: string;
  proposalId: string;
  state: string;
}

export function VotePanel({ realmId, proposalId, state }: VotePanelProps) {
  const [voting, setVoting] = useState(false);
  const [result, setResult] = useState<{
    vote: string;
    tally: { yes: number; no: number; abstain: number };
  } | null>(null);

  if (state !== "Voting") {
    return (
      <div className="panel p-4 text-gray-600 text-xs">
        Voting is closed for this proposal.
      </div>
    );
  }

  async function castVote(vote: "yes" | "no" | "abstain") {
    setVoting(true);
    try {
      const res = await fetch(
        `/api/v1/realms/${realmId}/proposals/${proposalId}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vote }),
        }
      );
      const data = await res.json();
      if (res.ok) setResult(data);
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="panel p-4">
      <div className="panel-header mb-3">CAST_VOTE</div>
      <div className="flex gap-2">
        <button
          onClick={() => castVote("yes")}
          disabled={voting}
          className="btn-primary disabled:opacity-40"
        >
          ▲ YES
        </button>
        <button
          onClick={() => castVote("no")}
          disabled={voting}
          className="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 text-xs uppercase tracking-widest font-semibold transition-all rounded disabled:opacity-40"
        >
          ▼ NO
        </button>
        <button
          onClick={() => castVote("abstain")}
          disabled={voting}
          className="btn-ghost disabled:opacity-40"
        >
          — ABSTAIN
        </button>
      </div>
      {result && (
        <div className="mt-3 text-[10px] text-gray-400 space-y-1">
          <div>
            Your vote: <span className="text-white font-medium">{result.vote.toUpperCase()}</span>
          </div>
          <div>
            Tally: {result.tally.yes} yes / {result.tally.no} no /{" "}
            {result.tally.abstain} abstain
          </div>
        </div>
      )}
    </div>
  );
}
