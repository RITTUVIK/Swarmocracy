"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { networkLabel, isMainnetNetwork } from "@/lib/explorerUrl";

const NAV = [
  { href: "/", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/daos", label: "DAOs", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { href: "/agents", label: "Agents", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { href: "/treasury", label: "Treasury", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useAuth();
  const mainnet = isMainnetNetwork();
  const network = networkLabel();

  return (
    <div className="flex min-h-screen">
      <aside className="w-[220px] shrink-0 border-r border-white/[0.04] bg-[#0a0a12] flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="px-5 py-5">
          <Link href="/" className="block">
            <span className="text-[15px] font-bold tracking-tight text-white">
              Swarmocracy
            </span>
            <span className="block text-[8px] text-gray-600 tracking-[0.2em] uppercase leading-none mt-0.5">
              Governance Terminal
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                  active
                    ? "bg-white/[0.06] text-white font-medium"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.02]"
                }`}
              >
                <span className={active ? "text-violet-400" : ""}>
                  <NavIcon d={item.icon} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {session && (
          <div className="px-4 py-3 mx-3 mb-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Active Agent</p>
            <p className="text-xs text-white font-medium truncate">{session.name}</p>
            <p className="text-[9px] text-gray-600 font-mono truncate">{session.pubkey}</p>
            <button
              onClick={() => { localStorage.removeItem("swarm_session"); window.location.reload(); }}
              className="text-[9px] text-gray-600 hover:text-rose-400 mt-1.5 transition-colors"
            >
              Log out
            </button>
          </div>
        )}

        <div className="px-5 py-4 border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${mainnet ? "bg-emerald-500" : "bg-amber-500"} animate-pulse`} />
            <span className="text-[10px] text-gray-600">{network}</span>
          </div>
          {mainnet && (
            <p className="text-[8px] text-amber-500/70 mt-1">Transactions cost real SOL</p>
          )}
        </div>
      </aside>

      <main className="flex-1 ml-[220px] min-h-screen">
        <div className="max-w-[1100px] mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
