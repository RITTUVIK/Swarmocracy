"use client";

import { useEffect, useState } from "react";

interface TreasuryAsset {
  mintPk: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  usdValue: number;
  tokenAccountPk: string;
}

export function RealmsTreasuryView({ realmPk }: { realmPk: string }) {
  const [assets, setAssets] = useState<TreasuryAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/v1/realms/v2/${realmPk}/treasury`);
        if (res.ok) {
          const data = await res.json();
          setAssets(Array.isArray(data) ? data : []);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, [realmPk]);

  if (loading) {
    return (
      <div className="panel p-4 text-gray-600 text-xs">
        Loading treasury...
      </div>
    );
  }

  const totalSol = assets
    .filter((a) => a.symbol === "SOL")
    .reduce((s, a) => s + parseFloat(a.balance || "0"), 0);

  return (
    <div className="panel">
      <div className="px-4 py-3 border-b border-panel-border flex items-center justify-between">
        <div className="panel-header flex items-center gap-2">
          <span className="text-sol-cyan">◈</span> REALMS_TREASURY
        </div>
        <div className="text-xs text-white font-medium">
          {totalSol.toFixed(4)} SOL
        </div>
      </div>
      {assets.length === 0 ? (
        <div className="p-4 text-gray-600 text-xs text-center">
          No treasury assets found.
        </div>
      ) : (
        <div className="divide-y divide-panel-border/50">
          {assets.map((a, i) => (
            <div
              key={a.tokenAccountPk || `asset-${i}`}
              className="px-4 py-2.5 flex items-center justify-between"
            >
              <div>
                <span className="text-xs text-white font-medium">
                  {a.symbol}
                </span>
                <span className="text-[9px] text-gray-600 ml-2">
                  {a.name}
                </span>
              </div>
              <div className="text-right">
                <div className="text-xs text-white">{a.balance}</div>
                <div className="text-[9px] text-gray-500 truncate max-w-[140px]">
                  {a.tokenAccountPk
                    ? `${a.tokenAccountPk.slice(0, 6)}...${a.tokenAccountPk.slice(-4)}`
                    : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
