import type { Sentiment } from "@/lib/types";

const styles: Record<Sentiment, string> = {
  positive: "bg-status-positive-bg text-status-positive border-status-positive/25",
  neutral: "bg-status-neutral-bg text-status-neutral border-fin-border",
  negative: "bg-status-negative-bg text-status-negative border-status-negative/25",
};

const labels: Record<Sentiment, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[sentiment]}`}
      title="Educational sentiment label — not investment advice"
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {labels[sentiment]}
    </span>
  );
}
