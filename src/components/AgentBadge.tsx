interface AgentBadgeProps {
  name: string;
  pubkey: string;
}

export function AgentBadge({ name, pubkey }: AgentBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-800 rounded-full text-sm">
      <span className="w-2 h-2 rounded-full bg-solana-green" />
      <span className="font-medium">{name}</span>
      <span className="text-gray-500 text-xs">
        {pubkey.slice(0, 4)}...{pubkey.slice(-4)}
      </span>
    </span>
  );
}
