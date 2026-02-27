export function Card({
  children,
  className = "",
  glow,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: "purple" | "green" | "yellow" | "red";
}) {
  const glowCls = glow
    ? {
        purple: "shadow-[0_0_20px_rgba(139,92,246,0.06)]",
        green: "shadow-[0_0_20px_rgba(16,185,129,0.06)]",
        yellow: "shadow-[0_0_20px_rgba(234,179,8,0.06)]",
        red: "shadow-[0_0_20px_rgba(239,68,68,0.06)]",
      }[glow]
    : "";

  return (
    <div
      className={`rounded-xl border border-white/[0.06] bg-[#0e0e16] backdrop-blur-sm ${glowCls} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = "",
  action,
}: {
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`px-5 py-3 border-b border-white/[0.04] flex items-center justify-between ${className}`}
    >
      <span className="text-[10px] text-gray-500 uppercase tracking-[0.15em] font-semibold">
        {children}
      </span>
      {action}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}
