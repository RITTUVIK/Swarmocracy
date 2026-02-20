"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

interface VotePanelProps {
  realmId: string;
  proposalId: string;
  state: string;
}

export function VotePanel({ realmId, proposalId, state }: VotePanelProps) {
  const { session } = useAuth();
  const [voting, setVoting] = useState(false);
  const [tally, setTally] = useState<{ yes: number; no: number; abstain: number } | null>(null);
  const [myVote, setMyVote] = useState<string | null>(null);

  useEffect(() => {
    function fetchVotes() {
      fetch(`/api/v1/realms/${realmId}/proposals/${proposalId}/vote`)
        .then((res) => res.json())
        .then((data) => {
          setTally(data.tally);
          if (session) {
            const mine = data.votes?.find((v: { voter: string }) => v.voter === session.pubkey);
            if (mine) setMyVote(mine.vote);
          }
        })
        .catch(() => {});
    }
    fetchVotes();
    const interval = setInterval(fetchVotes, 3000);
    return () => clearInterval(interval);
  }, [realmId, proposalId, session]);

  async function castVote(vote: "yes" | "no" | "abstain") {
    if (!session) return;
    setVoting(true);
    try {
      const res = await fetch(
        `/api/v1/realms/${realmId}/proposals/${proposalId}/vote`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ vote }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setTally(data.tally);
        setMyVote(vote);
      }
    } finally {
      setVoting(false);
    }
  }

  const total = tally ? tally.yes + tally.no + tally.abstain : 0;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="p-4 border border-gray-800 rounded-lg">
      <h4 className="font-semibold mb-3">Votes</h4>

      {tally && (
        <div className="space-y-2 mb-4">
          <VoteBar label="Yes" count={tally.yes} pct={pct(tally.yes)} color="bg-green-500" active={myVote === "yes"} />
          <VoteBar label="No" count={tally.no} pct={pct(tally.no)} color="bg-red-500" active={myVote === "no"} />
          <VoteBar label="Abstain" count={tally.abstain} pct={pct(tally.abstain)} color="bg-gray-500" active={myVote === "abstain"} />
          <p className="text-xs text-gray-500 mt-1">{total} total vote{total !== 1 ? "s" : ""}</p>
        </div>
      )}

      {state === "Voting" && session ? (
        <div className="flex gap-3">
          <button
            onClick={() => castVote("yes")}
            disabled={voting}
            className={`px-4 py-2 rounded transition-colors disabled:opacity-50 ${myVote === "yes" ? "bg-green-600 ring-2 ring-green-400" : "bg-green-700 hover:bg-green-600"}`}
          >
            Yes
          </button>
          <button
            onClick={() => castVote("no")}
            disabled={voting}
            className={`px-4 py-2 rounded transition-colors disabled:opacity-50 ${myVote === "no" ? "bg-red-600 ring-2 ring-red-400" : "bg-red-700 hover:bg-red-600"}`}
          >
            No
          </button>
          <button
            onClick={() => castVote("abstain")}
            disabled={voting}
            className={`px-4 py-2 rounded transition-colors disabled:opacity-50 ${myVote === "abstain" ? "bg-gray-600 ring-2 ring-gray-400" : "bg-gray-700 hover:bg-gray-600"}`}
          >
            Abstain
          </button>
        </div>
      ) : state !== "Voting" ? (
        <p className="text-sm text-gray-500">Voting is closed.</p>
      ) : (
        <p className="text-sm text-gray-500">Log in as an agent to vote.</p>
      )}

      {myVote && (
        <p className="text-xs text-gray-400 mt-2">
          You voted: <span className="text-white">{myVote}</span>
        </p>
      )}
    </div>
  );
}

function VoteBar({ label, count, pct, color, active }: { label: string; count: number; pct: number; color: string; active: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className={active ? "text-white font-semibold" : "text-gray-400"}>
          {label} {active && "(you)"}
        </span>
        <span className="text-gray-400">{count} ({pct}%)</span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
