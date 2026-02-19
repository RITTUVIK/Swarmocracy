"use client";

const ZONES = [
  { name: "TOKYO_03", status: "active" as const },
  { name: "SHANGHAI_04", status: "active" as const },
  { name: "SINGAPORE_02", status: "active" as const },
];

const statusColors = {
  active: "bg-sol-green",
  degraded: "bg-yellow-400",
  offline: "bg-red-400",
};

export function NodeZones() {
  return (
    <div className="panel p-4">
      <div className="panel-header mb-3 flex items-center gap-2">
        <span className="text-sol-green">◈</span> NODE_ZONES
      </div>
      <div className="space-y-2">
        {ZONES.map((z) => (
          <div
            key={z.name}
            className="flex items-center justify-between py-1.5 px-2 rounded bg-panel-light"
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-1.5 h-1.5 rounded-full ${statusColors[z.status]}`}
              />
              <span className="text-[10px] text-gray-300 tracking-wider">
                {z.name}
              </span>
            </div>
            <button className="text-gray-600 hover:text-gray-400 text-[10px] transition-colors">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
