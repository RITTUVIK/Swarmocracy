"use client";

interface MultiTxWarningProps {
  type: string;
  txCount: number;
  collateralLockRisk?: boolean;
}

export function MultiTxWarning({
  type,
  txCount,
  collateralLockRisk,
}: MultiTxWarningProps) {
  if (txCount <= 1 && !collateralLockRisk) return null;

  return (
    <div className="panel p-4 border-yellow-500/30 bg-yellow-500/5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-yellow-400 text-sm">⚠</span>
        <span className="text-[10px] text-yellow-400 uppercase tracking-widest font-semibold">
          MULTI-TRANSACTION WARNING
        </span>
      </div>
      <div className="space-y-1.5 text-[10px] text-gray-400">
        <p>
          This {type} operation requires{" "}
          <span className="text-white font-medium">{txCount} transactions</span>{" "}
          to be signed and sent in strict order.
        </p>
        {collateralLockRisk && (
          <p className="text-red-400">
            COLLATERAL LOCK RISK: If any transaction is skipped (especially the
            last one), your collateral may be PERMANENTLY LOCKED. Ensure all
            transactions complete before closing.
          </p>
        )}
        <p>
          If any transaction fails, the remaining transactions will be aborted
          to prevent partial execution.
        </p>
      </div>
    </div>
  );
}
