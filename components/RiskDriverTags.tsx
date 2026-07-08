import type { RiskDriverTag } from "@/lib/types";

export function RiskDriverTags({
  drivers,
  max = 3,
  compact = false,
}: {
  drivers: RiskDriverTag[];
  max?: number;
  compact?: boolean;
}) {
  if (drivers.length === 0) return null;

  const visible = drivers.slice(0, max);

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((driver) => (
        <span
          key={driver}
          className={`rounded-full border border-fin-brand/25 bg-fin-brand-soft/60 font-medium text-fin-brand ${
            compact ? "px-2 py-0.5 text-[10px] uppercase tracking-wide" : "px-2.5 py-0.5 text-xs"
          }`}
        >
          {driver}
        </span>
      ))}
    </div>
  );
}
