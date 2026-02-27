"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SkeletonCards } from "@/components/ui/Skeleton";

interface DAO {
  realmPk: string;
  name: string;
  communityMint: string;
  membersCount?: number;
}

function daoColor(pk: string): string {
  const n = pk.charCodeAt(0) + pk.charCodeAt(1) + pk.charCodeAt(2);
  const colors = [
    "from-violet-600/20 to-violet-400/5",
    "from-emerald-600/20 to-emerald-400/5",
    "from-sky-600/20 to-sky-400/5",
    "from-amber-600/20 to-amber-400/5",
    "from-rose-600/20 to-rose-400/5",
    "from-fuchsia-600/20 to-fuchsia-400/5",
  ];
  return colors[n % colors.length];
}

export default function DAOsPage() {
  const [daos, setDaos] = useState<DAO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/v1/realms/v2")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setDaos(Array.isArray(data) ? data.filter((d: DAO) => d.realmPk) : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = search
    ? daos.filter(
        (d) =>
          d.name?.toLowerCase().includes(search.toLowerCase()) ||
          (d.realmPk && d.realmPk.includes(search))
      )
    : daos;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">DAOs</h1>
          <p className="text-sm text-gray-500 mt-1">
            {daos.length} DAOs from Realms v2
          </p>
        </div>
        <input
          type="text"
          placeholder="Search by name or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-sm text-white placeholder-gray-600 focus:border-violet-500/40 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition-all"
        />
      </div>

      {loading ? (
        <SkeletonCards count={8} />
      ) : filtered.length === 0 ? (
        <Card className="py-20 text-center">
          <p className="text-sm text-gray-600">
            {search ? "No DAOs match your search." : "No DAOs found."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.slice(0, 60).map((dao) => (
            <Link key={dao.realmPk} href={`/dao/${dao.realmPk}`}>
              <Card className="p-0 hover:border-white/10 transition-all duration-200 group overflow-hidden h-full">
                <div className={`h-1.5 bg-gradient-to-r ${daoColor(dao.realmPk)}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-white group-hover:text-violet-400 transition-colors truncate">
                        {dao.name || "Unnamed DAO"}
                      </h3>
                      <p className="text-[10px] text-gray-600 font-mono mt-1 truncate">
                        {dao.realmPk}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-gray-700 group-hover:text-violet-400 transition-colors shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-white/[0.04]">
                    <div>
                      <span className="text-[9px] text-gray-600 uppercase tracking-wider">Members</span>
                      <p className="text-xs text-gray-400 font-medium tabular-nums mt-0.5">
                        {dao.membersCount ?? "—"}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] text-gray-600 uppercase tracking-wider">Mint</span>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">
                        {dao.communityMint ? dao.communityMint.slice(0, 12) + "..." : "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
