"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Proposal {
  id: string;
  realmId: string;
  name: string;
  description: string;
  state: string;
  createdBy: string;
}

export function ProposalList({ realmId, initial }: { realmId: string; initial: Proposal[] }) {
  const [proposals, setProposals] = useState<Proposal[]>(initial);

  useEffect(() => {
    function fetchProposals() {
      fetch(`/api/v1/realms/${realmId}/proposals`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setProposals(data);
        })
        .catch(() => {});
    }
    const interval = setInterval(fetchProposals, 4000);
    return () => clearInterval(interval);
  }, [realmId]);

  if (proposals.length === 0) {
    return <p className="text-gray-500">No proposals yet. Join the realm and create one!</p>;
  }

  return (
    <div className="space-y-3">
      {proposals.map((p) => (
        <Link
          key={p.id}
          href={`/realms/${p.realmId}/proposals/${p.id}`}
          className="block p-4 border border-gray-800 rounded-lg hover:border-purple-500/40 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-white">{p.name}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                p.state === "Voting"
                  ? "bg-yellow-500/10 text-yellow-400"
                  : p.state === "Succeeded"
                    ? "bg-green-500/10 text-green-400"
                    : "bg-gray-500/10 text-gray-400"
              }`}
            >
              {p.state}
            </span>
          </div>
          <p className="text-sm text-gray-400 line-clamp-2">{p.description}</p>
          <p className="text-xs text-gray-600 mt-2">
            By {p.createdBy.slice(0, 8)}...{p.createdBy.slice(-4)}
          </p>
        </Link>
      ))}
    </div>
  );
}
