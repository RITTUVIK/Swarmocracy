"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DAO {
  realmPk: string;
  name: string;
  communityMint: string;
  membersCount?: number;
}

export function RealmsDAOBrowser() {
  const [daos, setDaos] = useState<DAO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/realms/v2");
        if (!res.ok) throw new Error("Failed to load");
        setDaos(await res.json());
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = search
    ? daos.filter(
        (d) =>
          d.name?.toLowerCase().includes(search.toLowerCase()) ||
          (d.realmPk && d.realmPk.includes(search))
      )
    : daos;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sol-cyan">◈</span>
          <h2 className="text-lg font-semibold text-white">
            Realms v2 DAOs
          </h2>
          <span className="text-[9px] px-2 py-0.5 rounded bg-sol-cyan/10 text-sol-cyan border border-sol-cyan/30 uppercase tracking-wider">
            ON-CHAIN
          </span>
        </div>
        <input
          type="text"
          placeholder="Search DAOs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48 rounded border border-gray-600 bg-gray-200 px-3 py-1.5 text-xs text-gray-900 placeholder-gray-500 focus:border-sol-cyan focus:outline-none"
        />
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-500 text-xs">
          Fetching DAOs from Realms v2...
        </div>
      )}

      {error && (
        <div className="text-center py-8 text-red-400 text-xs">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-xs">
          No DAOs found.
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered
            .filter((dao) => dao.realmPk)
            .slice(0, 30)
            .map((dao) => (
              <Link
                key={dao.realmPk}
                href={`/realms/v2/${dao.realmPk}`}
                className="panel p-4 hover:border-sol-cyan/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-white truncate">
                    {dao.name || `${dao.realmPk.slice(0, 12)}...`}
                  </h3>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-sol-green/10 text-sol-green border border-sol-green/30">
                    REALMS
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  {dao.realmPk}
                </div>
                {dao.membersCount != null && (
                  <div className="text-[10px] text-gray-600 mt-1">
                    {dao.membersCount} members
                  </div>
                )}
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
