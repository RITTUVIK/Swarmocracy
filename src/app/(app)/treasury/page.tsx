"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Stat } from "@/components/ui/Stat";
import { Badge } from "@/components/ui/Badge";
import { SkeletonCards, SkeletonRows } from "@/components/ui/Skeleton";
import { txUrl, addressUrl } from "@/lib/explorerUrl";

interface TreasuryInfo {
  publicKey: string;
  solBalance: number;
}

interface ExecutionLog {
  id: string;
  proposalId: string;
  txSignature: string;
  status: string;
  walletRole?: string;
  type: string;
  createdAt: string;
  error?: string;
}

export default function TreasuryPage() {
  const [treasury, setTreasury] = useState<TreasuryInfo | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [noTreasury, setNoTreasury] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [tRes, logRes] = await Promise.all([
        fetch("/api/v1/treasury"),
        fetch("/api/v1/treasury/history").then((r) => (r.ok ? r.json() : [])),
      ]);

      if (tRes.status === 404) {
        setNoTreasury(true);
        setTreasury(null);
      } else if (tRes.ok) {
        const data = await tRes.json();
        setTreasury(data);
        setNoTreasury(false);
      }

      setLogs(Array.isArray(logRes) ? logRes.slice(0, 30) : []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleInitialize() {
    setInitializing(true);
    setInitError(null);
    try {
      const res = await fetch("/api/v1/treasury/initialize", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setInitError(data.error || "Failed to initialize treasury");
      } else {
        loadData();
      }
    } catch (e) {
      setInitError(String(e));
    } finally {
      setInitializing(false);
    }
  }

  const successCount = logs.filter((l) => l.status === "success").length;
  const failedCount = logs.filter((l) => l.status !== "success").length;

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCards count={3} />
        <SkeletonRows count={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Treasury</h1>
        <p className="text-sm text-gray-500 mt-1">DAO treasury wallet and execution history</p>
      </div>

      {noTreasury ? (
        <Card glow="purple" className="p-8 text-center">
          <svg className="w-10 h-10 mx-auto mb-3 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-gray-400 mb-1">No treasury wallet configured</p>
          <p className="text-xs text-gray-600 mb-4">Initialize a treasury wallet to enable on-chain execution.</p>
          <button onClick={handleInitialize} disabled={initializing}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 transition-colors">
            {initializing ? "Initializing..." : "Initialize Treasury"}
          </button>
          {initError && <p className="text-xs text-rose-400 mt-3">{initError}</p>}
        </Card>
      ) : treasury && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-5 md:col-span-2" glow="purple">
            <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">Wallet Address</span>
            <div className="flex items-center gap-2 mt-1.5">
              <p className="text-sm text-white font-mono truncate">{treasury.publicKey}</p>
              <a href={addressUrl(treasury.publicKey)} target="_blank" rel="noopener noreferrer"
                className="text-gray-600 hover:text-violet-400 shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </Card>
          <Card className="p-5">
            <Stat label="SOL Balance" value={treasury.solBalance?.toFixed(4) ?? "0"} sub="App treasury" />
          </Card>
          <Card className="p-5">
            <div className="flex gap-6">
              <Stat label="Success" value={successCount} accent="green" />
              <Stat label="Failed" value={failedCount} accent={failedCount > 0 ? "red" : undefined} />
            </div>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>Execution History ({logs.length})</CardHeader>
        {logs.length === 0 ? (
          <CardBody><p className="text-sm text-gray-600">No executions yet.</p></CardBody>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {logs.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-center gap-3">
                <Badge variant={log.status === "success" ? "green" : "red"}>{log.status}</Badge>
                <span className="text-[10px] text-gray-500 uppercase font-semibold w-20 shrink-0">{log.type || "—"}</span>
                <div className="min-w-0 flex-1">
                  {log.txSignature ? (
                    <a href={txUrl(log.txSignature)} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] font-mono text-violet-400 hover:underline truncate block">
                      {log.txSignature}
                    </a>
                  ) : (
                    <span className="text-[11px] text-gray-600">No signature</span>
                  )}
                  {log.error && <p className="text-[9px] text-rose-400 mt-0.5 truncate">{log.error}</p>}
                </div>
                <span className="text-[10px] text-gray-600 shrink-0 tabular-nums">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
