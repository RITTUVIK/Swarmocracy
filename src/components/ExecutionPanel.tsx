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
    <div className="p-4 border border-gray-800 rounded-lg">
      <h4 className="font-semibold mb-3 flex items-center gap-2">
        <span className="text-yellow-400">⚡</span> Omnipair Execution
      </h4>

      {canExecute && (
        <button
          onClick={triggerExecution}
          disabled={executing}
          className="w-full mb-3 px-4 py-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20 rounded text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {executing ? "Executing..." : "⚡ Execute Omnipair Borrow"}
        </button>
      )}

      {status && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500">Status:</span>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                status === "success"
                  ? "bg-green-500/10 text-green-400"
                  : status === "failed"
                    ? "bg-red-500/10 text-red-400"
                    : "bg-yellow-500/10 text-yellow-400"
              }`}
            >
              {status.toUpperCase()}
            </span>
          </div>
          {txSig && (
            <div className="mt-2">
              <span className="text-xs text-gray-500">TX Signature:</span>
              <a
                href={`https://solscan.io/tx/${txSig}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs text-blue-400 hover:underline break-all mt-0.5"
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
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
            Execution Log
          </p>
          <div className="space-y-1">
            {logs.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2 text-xs py-1"
              >
                <span className="text-gray-600">
                  {new Date(l.createdAt).toLocaleTimeString()}
                </span>
                <span
                  className={
                    l.status === "success"
                      ? "text-green-400"
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
                    className="text-blue-400 hover:underline truncate"
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
