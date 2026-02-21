"use client";

export function NodeZones() {
  return (
    <div className="panel p-4">
      <div className="panel-header mb-3 flex items-center gap-2">
        <span className="text-sol-green">◈</span> NODE_ZONES
      </div>
      <div className="text-[10px] text-gray-500 py-4 text-center">
        No zone data. Connect a node provider API to list regions.
      </div>
    </div>
  );
}
