import type { Sentiment } from "@/lib/types";
import { SENTIMENT_TOOLTIPS } from "@/lib/analysis-tooltips";
import { Tooltip } from "./Tooltip";

const styles: Record<Sentiment, string> = {
  positive: "bg-status-positive-bg text-status-positive border-status-positive/25",
  neutral: "bg-status-neutral-bg text-status-neutral border-fin-border",
  negative: "bg-status-negative-bg text-status-negative border-status-negative/25",
  mixed: "bg-status-warning-bg text-status-warning border-status-warning/25",
};

const labels: Record<Sentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  mixed: "Mixed",
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const label = labels[sentiment];

  return (
    <Tooltip
      label={`${label} sentiment explanation`}
      content={SENTIMENT_TOOLTIPS[sentiment]}
      triggerClassName="rounded-full"
    >
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[sentiment]}`}
      >
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
        {label}
      </span>
    </Tooltip>
  );
}
