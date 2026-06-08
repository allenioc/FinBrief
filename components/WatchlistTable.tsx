"use client";

import Link from "next/link";
import type { WatchlistItem, WatchlistItemType } from "@/lib/types";
import { ANALYSIS_LABEL_TOOLTIPS } from "@/lib/analysis-tooltips";
import { MarketImpactBadge } from "./MarketImpactBadge";
import { SentimentBadge } from "./SentimentBadge";
import { TooltipLabel } from "./Tooltip";
import { useWatchlist } from "./WatchlistProvider";

const typeLabels: Record<WatchlistItemType, string> = {
  stock: "Stock",
  etf: "ETF",
  index: "Index",
  sector: "Sector",
  topic: "Macro topic",
};

export function WatchlistTable({ items }: { items: WatchlistItem[] }) {
  if (items.length === 0) {
    return (
      <p className="fin-panel py-12 text-center text-sm text-fin-subtle">
        Your watchlist is empty. Use the form above to add topics to track.
      </p>
    );
  }

  return (
    <div className="fin-card overflow-x-auto">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead>
          <tr className="border-b border-fin-border bg-fin-muted/50">
            <th className="px-5 py-3 fin-label">Symbol / topic</th>
            <th className="px-5 py-3 fin-label">Name</th>
            <th className="px-5 py-3 fin-label">Type</th>
            <th className="px-5 py-3 fin-label">
              <TooltipLabel label="Sentiment" content={ANALYSIS_LABEL_TOOLTIPS.sentiment} />
            </th>
            <th className="px-5 py-3 fin-label">
              <TooltipLabel label="Market impact" content={ANALYSIS_LABEL_TOOLTIPS.marketImpact} />
            </th>
            <th className="px-5 py-3 fin-label text-right">Action</th>
            <th className="px-5 py-3 fin-label text-right">Brief</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-fin-border/80 last:border-0 transition-colors hover:bg-fin-muted/30"
            >
              <td className="px-5 py-4 font-mono font-bold text-fin-brand">{item.symbol}</td>
              <td className="max-w-[200px] px-5 py-4 text-fin-text">
                <span className="line-clamp-2">{item.name}</span>
              </td>
              <td className="px-5 py-4">
                <span className="rounded-full border border-fin-border bg-fin-muted px-2.5 py-0.5 text-xs font-medium text-fin-subtle">
                  {typeLabels[item.type]}
                </span>
              </td>
              <td className="px-5 py-4">
                <SentimentBadge sentiment={item.latestSentiment} />
              </td>
              <td className="px-5 py-4">
                <MarketImpactBadge impact={item.marketImpact} />
              </td>
              <td className="px-5 py-4 text-right">
                <RemoveFollowButton symbol={item.symbol} />
              </td>
              <td className="px-5 py-4 text-right">
                <Link
                  href={`/?q=${encodeURIComponent(item.symbol)}`}
                  className="fin-link text-xs font-bold"
                >
                  Open →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RemoveFollowButton({ symbol }: { symbol: string }) {
  const { removeFollow } = useWatchlist();

  return (
    <button
      type="button"
      onClick={() => removeFollow(symbol)}
      className="rounded-full border border-status-negative/30 bg-status-negative-bg px-3 py-1 text-xs font-semibold text-status-negative hover:opacity-90"
      aria-label={`Unfollow ${symbol}`}
    >
      Remove
    </button>
  );
}
