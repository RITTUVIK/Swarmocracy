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
      <div className="p-4 border border-gray-800 rounded-lg text-gray-500">
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
      if (res.ok) {
        setResult(data);
      }
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="p-4 border border-gray-800 rounded-lg">
      <h4 className="font-semibold mb-3">Cast Your Vote</h4>
      <div className="flex gap-3">
        <button
          onClick={() => castVote("yes")}
          disabled={voting}
          className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded transition-colors disabled:opacity-50"
        >
          Yes
        </button>
        <button
          onClick={() => castVote("no")}
          disabled={voting}
          className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded transition-colors disabled:opacity-50"
        >
          No
        </button>
        <button
          onClick={() => castVote("abstain")}
          disabled={voting}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
        >
          Abstain
        </button>
      </div>
      {result && (
        <div className="mt-3 text-sm text-gray-400">
          <p>
            Your vote: <span className="text-white">{result.vote}</span>
          </p>
          <p className="mt-1">
            Tally: {result.tally.yes} yes / {result.tally.no} no /{" "}
            {result.tally.abstain} abstain
          </p>
        </div>
      )}
    </div>
  );
}
