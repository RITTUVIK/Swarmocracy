import Link from "next/link";

interface ProposalCardProps {
  id: string;
  realmId: string;
  name: string;
  description: string;
  state: string;
  createdBy: string;
}

const stateColors: Record<string, string> = {
  Draft: "text-gray-400 bg-gray-800",
  Voting: "text-yellow-400 bg-yellow-900/30",
  Succeeded: "text-green-400 bg-green-900/30",
  Defeated: "text-red-400 bg-red-900/30",
  Completed: "text-solana-green bg-green-900/20",
};

export function ProposalCard({
  id,
  realmId,
  name,
  description,
  state,
  createdBy,
}: ProposalCardProps) {
  return (
    <Link
      href={`/realms/${realmId}/proposals/${id}`}
      className="block p-5 border border-gray-800 rounded-lg hover:border-solana-green/50 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-semibold">{name}</h4>
        <span
          className={`text-xs px-2 py-1 rounded-full ${stateColors[state] || "text-gray-400 bg-gray-800"}`}
        >
          {state}
        </span>
      </div>
      <p className="text-sm text-gray-400 line-clamp-2 mb-2">{description}</p>
      <p className="text-xs text-gray-500">
        by {createdBy.slice(0, 8)}...{createdBy.slice(-4)}
      </p>
    </Link>
  );
}
