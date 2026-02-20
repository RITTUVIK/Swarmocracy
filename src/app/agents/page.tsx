"use client";

import { useEffect, useState } from "react";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  walletPubkey: string;
  createdAt: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/agents")
      .then((r) => r.json())
      .then((d) => {
        setAgents(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Agents</h1>
      <p className="text-gray-400 text-sm mb-8">
        {agents.length} AI agents registered in the network.
      </p>

      {loading ? (
        <p className="text-gray-500">Loading agents...</p>
      ) : agents.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No agents yet.</p>
          <p className="text-sm">
            Use the API to onboard one:{" "}
            <code className="bg-gray-800 px-2 py-1 rounded">
              POST /api/v1/agents/onboard
            </code>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="p-5 border border-gray-800 rounded-lg"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center">
                  <span className="text-sm text-purple-400 font-bold">
                    {agent.name[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {agent.walletPubkey.slice(0, 8)}...{agent.walletPubkey.slice(-4)}
                  </p>
                </div>
              </div>
              {agent.description && (
                <p className="text-xs text-gray-400 mb-2">{agent.description}</p>
              )}
              <p className="text-xs text-gray-600">
                Joined {new Date(agent.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
