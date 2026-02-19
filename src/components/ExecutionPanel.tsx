"use client";

import { useState } from "react";

interface ExecutionLog {
  id: string;
  status: string;
  txSignature: string | null;
  error: string | null;
  createdAt: string;
}

interface ExecutionPanelProps {
  proposalId: string;
  realmId: string;
  state: string;
  executionStatus: string | null;
  executionTxSignature: string | null;
  logs: ExecutionLog[];
}

export function ExecutionPanel({
  proposalId,
  realmId,
  state,
  executionStatus,
  executionTxSignature,
  logs,
}: ExecutionPanelProps) {
  const [executing, setExecuting] = useState(false);
  const [status, setStatus] = useState(executionStatus);
  const [txSig, setTxSig] = useState(executionTxSignature);
  const [error, setError] = useState<string | null>(null);

  const canExecute = state === "Succeeded" && !status;

  async function triggerExecution() {
    setExecuting(true);
    setError(null);
    setStatus("executing");
    try {
      const res = await fetch(`/api/v1/proposals/${proposalId}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(data.status);
        setTxSig(data.txSignature ?? null);
      } else {
        setStatus("failed");
        setError(data.error ?? "Execution failed");
      }
    } catch (e: any) {
      setStatus("failed");
      setError(e.message);
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="panel p-4">
      <div className="panel-header mb-3 flex items-center gap-2">
        <span className="text-sol-cyan">⚡</span> OMNIPAIR_EXECUTION
      </div>

      {canExecute && (
        <button
          onClick={triggerExecution}
          disabled={executing}
          className="btn-primary mb-3 w-full text-center disabled:opacity-40"
        >
          {executing ? "EXECUTING..." : "⚡ EXECUTE OMNIPAIR BORROW"}
        </button>
      )}

      {status && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-gray-500 tracking-wider">
              STATUS:
            </span>
            <span
              className={
                status === "success"
                  ? "badge-green"
                  : status === "failed"
                    ? "badge-red"
                    : "badge-yellow"
              }
            >
              {status.toUpperCase()}
            </span>
          </div>
          {txSig && (
            <div className="mt-2">
              <span className="text-[10px] text-gray-500 tracking-wider">
                TX_SIGNATURE:
              </span>
              <a
                href={`https://solscan.io/tx/${txSig}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-sol-cyan hover:underline break-all mt-0.5"
              >
                {txSig}
              </a>
            </div>
          )}
          {error && (
            <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
              {error}
            </div>
          )}
        </div>
      )}

      {logs.length > 0 && (
        <div>
          <div className="text-[9px] text-gray-600 tracking-wider uppercase mb-2">
            EXECUTION_LOG
          </div>
          <div className="space-y-1">
            {logs.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2 text-[10px] py-1"
              >
                <span className="text-gray-600">
                  {new Date(l.createdAt).toLocaleTimeString()}
                </span>
                <span
                  className={
                    l.status === "success"
                      ? "text-sol-green"
                      : l.status === "failed"
                        ? "text-red-400"
                        : "text-yellow-400"
                  }
                >
                  {l.status.toUpperCase()}
                </span>
                {l.txSignature && (
                  <a
                    href={`https://solscan.io/tx/${l.txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sol-cyan hover:underline truncate"
                  >
                    {l.txSignature.slice(0, 20)}...
                  </a>
                )}
                {l.error && (
                  <span className="text-red-400 truncate">{l.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
