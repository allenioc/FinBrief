import type { MarketImpact } from "@/lib/types";

const styles: Record<MarketImpact, string> = {
  low: "bg-status-neutral-bg text-status-neutral border-fin-border",
  medium: "bg-status-warning-bg text-status-warning border-status-warning/25",
  high: "bg-status-negative-bg text-status-negative border-status-negative/25",
};

const labels: Record<MarketImpact, string> = {
  low: "Low impact",
  medium: "Medium impact",
  high: "High impact",
};

export function MarketImpactBadge({ impact }: { impact: MarketImpact }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[impact]}`}
    >
      {labels[impact]}
    </span>
  );
}
