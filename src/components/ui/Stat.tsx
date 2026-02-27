export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "purple" | "green" | "yellow" | "red";
}) {
  const accentCls = accent
    ? {
        purple: "text-violet-400",
        green: "text-emerald-400",
        yellow: "text-amber-400",
        red: "text-rose-400",
      }[accent]
    : "text-white";

  return (
    <div>
      <div className="text-[9px] text-gray-500 uppercase tracking-[0.15em] font-semibold mb-1.5">
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums leading-none ${accentCls}`}>
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-gray-600 mt-1">{sub}</div>
      )}
    </div>
  );
}
