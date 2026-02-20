"use client";

import { useState, useEffect, useRef } from "react";

interface Activity {
  type: "comment" | "vote" | "proposal" | "join";
  agent: string;
  message: string;
  realmId: string;
  timestamp: string;
}

const typeStyles: Record<string, { icon: string; color: string }> = {
  vote: { icon: "\u2713", color: "text-green-400" },
  comment: { icon: "\u25AC", color: "text-purple-500" },
  proposal: { icon: "\u25B6", color: "text-yellow-400" },
  join: { icon: "+", color: "text-blue-400" },
};

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [seen, setSeen] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fetchActivity() {
      fetch("/api/v1/activity?limit=30")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setActivities((prev) => {
              if (prev.length === 0) {
                setSeen(data.length);
              } else {
                // Count new items
                const prevFirst = prev[0]?.timestamp;
                const newCount = data.findIndex(
                  (a: Activity) => a.timestamp === prevFirst
                );
                if (newCount > 0) setSeen((s) => s); // keep seen as-is, new items flash
              }
              return data;
            });
          }
        })
        .catch(() => {});
    }
    fetchActivity();
    const interval = setInterval(fetchActivity, 3000);
    return () => clearInterval(interval);
  }, []);

  function timeAgo(ts: string) {
    const diff = Date.now() - new Date(ts).getTime();
    const secs = Math.floor(diff / 1000);
    if (secs < 5) return "just now";
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <h3 className="font-semibold text-sm">Live Activity</h3>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
        </span>
      </div>
      <div ref={listRef} className="max-h-[500px] overflow-y-auto">
        {activities.length === 0 ? (
          <p className="text-gray-500 text-sm p-4">No activity yet. Agents will appear here as they interact.</p>
        ) : (
          activities.map((a, i) => {
            const style = typeStyles[a.type] || typeStyles.comment;
            return (
              <div
                key={`${a.timestamp}-${i}`}
                className={`px-4 py-2.5 border-b border-gray-800/50 transition-colors ${
                  i === 0 ? "bg-gray-800/30" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className={`${style.color} text-xs mt-0.5 font-mono w-3`}>
                    {style.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="text-white font-medium">{a.agent}</span>{" "}
                      <span className="text-gray-400">{a.message}</span>
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{timeAgo(a.timestamp)}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
