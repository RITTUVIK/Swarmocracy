interface AgentBadgeProps {
  name: string;
  pubkey: string;
}

export function AgentBadge({ name, pubkey }: AgentBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded bg-sol-purple/20 flex items-center justify-center">
        <span className="text-[9px] text-sol-purple font-bold">
          {name[0]?.toUpperCase()}
        </span>
      </div>
      <div>
        <span className="text-xs text-gray-200 font-medium">{name}</span>
        <span className="text-[9px] text-gray-600 ml-1.5">
          {pubkey.slice(0, 6)}...{pubkey.slice(-4)}
        </span>
      </div>
    </div>
  );
}
