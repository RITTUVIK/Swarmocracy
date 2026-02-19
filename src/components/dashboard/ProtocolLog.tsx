"use client";

import { useEffect, useRef, useState } from "react";

interface LogEntry {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

const typeColors: Record<string, string> = {
  EXECUTE_DONE: "text-sol-green",
  AGENT_JOIN: "text-sol-cyan",
  PROPOSAL_NEW: "text-sol-purple",
  TX_CONFIRM: "text-sol-green",
  WARN: "text-yellow-400",
  SYNC: "text-sol-cyan",
  AGENT_VOTE: "text-sol-purple",
  ERROR: "text-red-400",
  PING: "text-gray-500",
  INFO: "text-gray-400",
};

export function ProtocolLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/v1/protocol-log");
        if (res.ok) setEntries(await res.json());
      } catch {}
    }
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="panel flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
        <div className="panel-header flex items-center gap-2">
          <span className="text-sol-green">▸</span> LIVE_PROTOCOL_LOG
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-sol-green animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 opacity-30" />
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono text-[10px]"
      >
        {entries.length === 0 ? (
          <div className="text-gray-600 py-4 text-center">
            Awaiting protocol events...
          </div>
        ) : (
          entries.map((e) => {
            const ts = new Date(e.createdAt);
            const timeStr = ts.toLocaleTimeString("en-US", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            return (
              <div key={e.id} className="flex gap-2 leading-relaxed">
                <span className="text-gray-600 shrink-0">[{timeStr}]</span>
                <span
                  className={`shrink-0 font-semibold ${typeColors[e.type] ?? "text-gray-400"}`}
                >
                  {e.type}
                </span>
                <span className="text-gray-400 truncate">{e.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
