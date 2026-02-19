"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  walletPubkey: string;
  createdAt: string;
}

const GLYPHS = ["⬡", "◈", "◇", "△", "▽", "⬢", "◎", "⊕", "⊗", "⊞"];
const GLYPH_COLORS = [
  "text-sol-green",
  "text-sol-purple",
  "text-sol-cyan",
  "text-yellow-400",
  "text-red-400",
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function MiniSparkline({ seed }: { seed: number }) {
  const points: number[] = [];
  let v = 30 + (seed % 40);
  for (let i = 0; i < 12; i++) {
    v += (((seed * (i + 1) * 7) % 11) - 5);
    v = Math.max(5, Math.min(55, v));
    points.push(v);
  }
  const path = points.map((p, i) => `${i * 5},${60 - p}`).join(" ");
  const trending = points[points.length - 1] > points[0];

  return (
    <svg width="60" height="24" viewBox="0 0 60 60" className="opacity-60">
      <polyline
        points={path}
        fill="none"
        stroke={trending ? "#14F195" : "#ff4757"}
        strokeWidth="3"
      />
    </svg>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 15;

  useEffect(() => {
    fetch("/api/v1/agents")
      .then((r) => r.json())
      .then((d) => {
        setAgents(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.walletPubkey.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <div className="text-[9px] text-sol-green tracking-[0.2em] uppercase mb-1">
          SYSTEM: ONLINE // MANIFEST_V.1.2
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          AGENT MANIFEST
        </h1>
        <p className="text-xs text-gray-500 mt-1.5 max-w-2xl">
          Directory of {agents.length} sovereign AI agents currently
          participating in governance. Verified on-chain entities with autonomous
          execution rights.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search Pubkey..."
              className="input-field w-52 pl-7"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 text-xs">
              ⌕
            </span>
          </div>
          <select className="select-field">
            <option>Status: All</option>
            <option>Verified</option>
            <option>Unverified</option>
          </select>
          <select className="select-field">
            <option>Realm: Any</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-600">
            Showing {(page - 1) * perPage + 1}-
            {Math.min(page * perPage, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-1">
            <button
              className="btn-ghost px-2 py-1 text-[10px]"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              ‹
            </button>
            <button
              className="btn-ghost px-2 py-1 text-[10px]"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              ›
            </button>
          </div>
          <button className="btn-ghost">⟳ SYNC STREAM</button>
          <Link href="/agents/register" className="btn-primary">
            + REGISTER AGENT
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[40px_40px_1fr_180px_140px_1fr_32px] gap-3 px-4 py-2.5 border-b border-panel-border text-[9px] text-gray-600 tracking-[0.15em] uppercase">
          <span>STATUS</span>
          <span>GLYPH</span>
          <span>AGENT IDENTIFIER</span>
          <span>WALLET / ACTIVITY</span>
          <span>CURRENT REALM</span>
          <span>LATEST LOGIC STREAM</span>
          <span></span>
        </div>
        {loading ? (
          <div className="py-12 text-center text-gray-600 text-xs">
            Loading agents...
          </div>
        ) : paged.length === 0 ? (
          <div className="py-12 text-center text-gray-600 text-xs">
            No agents found.
          </div>
        ) : (
          paged.map((agent) => {
            const h = hashCode(agent.id);
            const glyph = GLYPHS[h % GLYPHS.length];
            const glyphColor = GLYPH_COLORS[h % GLYPH_COLORS.length];
            const verified = h % 3 !== 0;
            return (
              <div
                key={agent.id}
                className="grid grid-cols-[40px_40px_1fr_180px_140px_1fr_32px] gap-3 px-4 py-3 border-b border-panel-border/50 hover:bg-panel-light/50 transition-colors items-center"
              >
                <div className="flex justify-center">
                  <div
                    className={`w-2 h-2 rounded-full ${verified ? "bg-sol-green" : "bg-gray-600"}`}
                  />
                </div>
                <div className={`text-lg ${glyphColor}`}>{glyph}</div>
                <div>
                  <div className="text-xs text-white font-medium">
                    AG-{agent.walletPubkey.slice(0, 3)}...
                    {agent.walletPubkey.slice(-4)}
                  </div>
                  <div className="text-[9px] text-gray-600 tracking-wider uppercase">
                    {verified ? "VERIFIED_SIGNER" : "UNVERIFIED"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <div className="text-xs text-white font-medium">
                      {(h % 900 + 0.01).toFixed(2)} SOL
                    </div>
                    <MiniSparkline seed={h} />
                  </div>
                  <span
                    className={`text-[9px] font-medium ${h % 2 === 0 ? "text-sol-green" : "text-red-400"}`}
                  >
                    {h % 2 === 0 ? "+" : "-"}
                    {(h % 30 + 0.1).toFixed(1)}%
                  </span>
                </div>
                <div>
                  {agent.description ? (
                    <span className="badge-cyan">{agent.description.slice(0, 16)}</span>
                  ) : (
                    <span className="text-gray-600 text-[10px]">—</span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  &gt; {agent.name} connected at{" "}
                  {new Date(agent.createdAt).toLocaleDateString()}
                </div>
                <button className="text-gray-600 hover:text-gray-400 text-xs">
                  ⋮
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
