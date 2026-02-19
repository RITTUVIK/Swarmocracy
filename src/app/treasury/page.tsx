"use client";

import { useEffect, useState } from "react";

interface TreasuryInfo {
  walletPubkey: string;
  balanceSol: number;
  realmId: string;
}

interface ExecHistoryEntry {
  id: string;
  proposalId: string;
  type: string;
  status: string;
  txSignature: string | null;
  error: string | null;
  createdAt: string;
}

export default function TreasuryPage() {
  const [treasury, setTreasury] = useState<TreasuryInfo | null>(null);
  const [history, setHistory] = useState<ExecHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [initRealmId, setInitRealmId] = useState("");
  const [initializing, setInitializing] = useState(false);
  const [initResult, setInitResult] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [tRes, hRes] = await Promise.all([
          fetch("/api/v1/treasury"),
          fetch("/api/v1/treasury/history"),
        ]);
        if (tRes.ok) setTreasury(await tRes.json());
        if (hRes.ok) setHistory(await hRes.json());
      } catch {}
      setLoading(false);
    }
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  async function initTreasury() {
    if (!initRealmId.trim()) return;
    setInitializing(true);
    setInitResult(null);
    try {
      const res = await fetch("/api/v1/treasury/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realmId: initRealmId.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setInitResult(`Treasury initialized: ${data.walletPubkey}`);
        setTreasury(data);
      } else {
        setInitResult(`Error: ${data.error}`);
      }
    } catch (e: any) {
      setInitResult(`Error: ${e.message}`);
    }
    setInitializing(false);
  }

  return (
    <div className="p-6 space-y-5">
      <div>
        <div className="text-[9px] text-sol-cyan tracking-[0.2em] uppercase mb-1">
          FINANCIAL_OPERATIONS // TREASURY
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          DAO TREASURY
        </h1>
        <p className="text-xs text-gray-500 mt-1.5">
          Manage DAO treasury wallet. Execute Omnipair borrow transactions when
          governance proposals pass.
        </p>
      </div>

      {loading ? (
        <div className="panel p-8 text-center text-gray-600 text-xs">
          Loading treasury...
        </div>
      ) : !treasury ? (
        <div className="panel p-6 space-y-4">
          <div className="text-xs text-gray-400">
            No treasury wallet configured. Initialize one for a realm.
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Realm ID..."
              className="input-field flex-1"
              value={initRealmId}
              onChange={(e) => setInitRealmId(e.target.value)}
            />
            <button
              onClick={initTreasury}
              disabled={initializing}
              className="btn-primary disabled:opacity-40"
            >
              {initializing ? "INITIALIZING..." : "INITIALIZE TREASURY"}
            </button>
          </div>
          {initResult && (
            <div className="text-[10px] text-gray-300">{initResult}</div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="panel p-4">
              <div className="panel-header mb-2">WALLET_ADDRESS</div>
              <div className="text-xs text-sol-cyan break-all">
                {treasury.walletPubkey}
              </div>
            </div>
            <div className="panel p-4">
              <div className="panel-header mb-2">SOL_BALANCE</div>
              <div className="stat-value">{treasury.balanceSol.toFixed(4)}</div>
              <div className="text-[10px] text-gray-500 mt-1">SOL</div>
            </div>
            <div className="panel p-4">
              <div className="panel-header mb-2">REALM</div>
              <div className="text-xs text-gray-300 break-all">
                {treasury.realmId}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="px-4 py-3 border-b border-panel-border">
              <div className="panel-header flex items-center gap-2">
                <span className="text-sol-purple">◈</span> EXECUTION_HISTORY
              </div>
            </div>
            {history.length === 0 ? (
              <div className="p-6 text-center text-gray-600 text-xs">
                No executions yet.
              </div>
            ) : (
              <div className="divide-y divide-panel-border/50">
                {history.map((h) => (
                  <div
                    key={h.id}
                    className="px-4 py-3 flex items-center gap-4"
                  >
                    <span
                      className={
                        h.status === "success"
                          ? "badge-green"
                          : h.status === "failed"
                            ? "badge-red"
                            : "badge-yellow"
                      }
                    >
                      {h.status.toUpperCase()}
                    </span>
                    <span className="badge-cyan">{h.type}</span>
                    <span className="text-[10px] text-gray-500 flex-1 truncate">
                      Proposal: {h.proposalId.slice(0, 12)}...
                    </span>
                    {h.txSignature && (
                      <a
                        href={`https://solscan.io/tx/${h.txSignature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-sol-cyan hover:underline"
                      >
                        TX:{h.txSignature.slice(0, 12)}...
                      </a>
                    )}
                    {h.error && (
                      <span className="text-[10px] text-red-400 truncate max-w-[200px]">
                        {h.error}
                      </span>
                    )}
                    <span className="text-[9px] text-gray-600">
                      {new Date(h.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
