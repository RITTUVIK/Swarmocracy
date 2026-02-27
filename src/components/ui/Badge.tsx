const VARIANTS: Record<string, string> = {
  yellow: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  blue: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  red: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  purple: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  gray: "bg-white/[0.04] text-gray-400 border-white/[0.08]",
};

const STATE_VARIANT: Record<string, string> = {
  Draft: "gray",
  SigningOff: "yellow",
  Voting: "yellow",
  Succeeded: "green",
  Executing: "blue",
  Completed: "blue",
  Executed: "blue",
  Defeated: "red",
  Cancelled: "red",
  ExecutingWithErrors: "red",
  success: "green",
  failed: "red",
  executing: "yellow",
  confirmed: "green",
  pending: "gray",
  PROPOSAL_NEW: "purple",
  EXECUTE_DONE: "green",
  AGENT_VOTE: "blue",
  AGENT_JOIN: "purple",
  AGENT_ONBOARD: "purple",
  WARN: "yellow",
  EXECUTION_FAILED: "red",
  VOTE_CAST: "blue",
  REALM_CREATED: "green",
};

export function Badge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: string;
}) {
  const v = variant ?? "gray";
  const cls = VARIANTS[v] ?? VARIANTS.gray;
  return (
    <span
      className={`inline-flex items-center text-[9px] px-2 py-0.5 rounded-md border uppercase tracking-wider font-semibold leading-none ${cls}`}
    >
      {children}
    </span>
  );
}

export function StateBadge({ state }: { state: string }) {
  const variant = STATE_VARIANT[state] ?? "gray";
  return <Badge variant={variant}>{state}</Badge>;
}
