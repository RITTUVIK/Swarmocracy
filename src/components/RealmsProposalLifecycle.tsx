"use client";

const LIFECYCLE_STATES = [
  "Draft",
  "SigningOff",
  "Voting",
  "Succeeded",
  "Executing",
  "Completed",
];

const STATE_STYLES: Record<string, { color: string; bgColor: string }> = {
  Draft: { color: "text-gray-400", bgColor: "bg-gray-600" },
  SigningOff: { color: "text-yellow-400", bgColor: "bg-yellow-500" },
  Voting: { color: "text-sol-cyan", bgColor: "bg-sol-cyan" },
  Succeeded: { color: "text-sol-green", bgColor: "bg-sol-green" },
  Executing: { color: "text-sol-purple", bgColor: "bg-sol-purple" },
  Completed: { color: "text-sol-green", bgColor: "bg-sol-green" },
  Defeated: { color: "text-red-400", bgColor: "bg-red-500" },
  Cancelled: { color: "text-red-400", bgColor: "bg-red-500" },
  ExecutingWithErrors: { color: "text-yellow-400", bgColor: "bg-yellow-500" },
};

export function RealmsProposalLifecycle({ state }: { state: string }) {
  const currentIdx = LIFECYCLE_STATES.indexOf(state);
  const isTerminal = ["Defeated", "Cancelled"].includes(state);

  return (
    <div className="panel p-4">
      <div className="panel-header mb-3">PROPOSAL_LIFECYCLE</div>
      <div className="flex items-center gap-1">
        {LIFECYCLE_STATES.map((s, i) => {
          const active = s === state;
          const passed = currentIdx >= 0 && i < currentIdx;
          const styles = STATE_STYLES[s] ?? STATE_STYLES.Draft;
          return (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-3 h-3 rounded-full border-2 transition-all ${
                    active
                      ? `${styles.bgColor} border-transparent`
                      : passed
                        ? "bg-sol-green/30 border-sol-green/50"
                        : "bg-panel-border border-panel-border"
                  }`}
                />
                <span
                  className={`text-[7px] mt-1 tracking-wider uppercase ${
                    active ? styles.color : "text-gray-600"
                  }`}
                >
                  {s}
                </span>
              </div>
              {i < LIFECYCLE_STATES.length - 1 && (
                <div
                  className={`h-px flex-1 ${
                    passed ? "bg-sol-green/30" : "bg-panel-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      {isTerminal && (
        <div className="mt-2 text-[10px] text-red-400">
          Terminal state: {state}
        </div>
      )}
    </div>
  );
}
