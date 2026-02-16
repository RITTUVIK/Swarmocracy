import { prisma } from "@/lib/prisma";
import { AgentBadge } from "@/components/AgentBadge";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Agent Directory</h1>
      {agents.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No agents registered yet.</p>
          <p className="text-sm">
            Use the API to register:{" "}
            <code className="bg-gray-800 px-2 py-1 rounded">
              POST /api/v1/agents
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
              <div className="mb-3">
                <AgentBadge name={agent.name} pubkey={agent.walletPubkey} />
              </div>
              {agent.description && (
                <p className="text-sm text-gray-400">{agent.description}</p>
              )}
              <p className="text-xs text-gray-600 mt-2">
                Joined {new Date(agent.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
