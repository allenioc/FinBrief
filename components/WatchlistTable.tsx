import Link from "next/link";
import type { WatchlistFeedItem, WatchlistItemType } from "@/lib/types";
import { MarketImpactBadge } from "./MarketImpactBadge";
import { SentimentBadge } from "./SentimentBadge";
import { TimeAgo } from "./TimeAgo";

const typeLabels: Record<WatchlistItemType, string> = {
  stock: "Stock",
  etf: "ETF",
  index: "Index",
  sector: "Sector",
  topic: "Macro topic",
};

export function WatchlistTable({ items }: { items: WatchlistFeedItem[] }) {
  if (items.length === 0) {
    return (
      <p className="fin-panel py-12 text-center text-sm text-fin-subtle">
        Your watchlist is empty. Use the form above to add tickers or topics (demo only).
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
            <th className="px-5 py-3 fin-label">Sentiment</th>
            <th className="px-5 py-3 fin-label">Impact</th>
            <th className="px-5 py-3 fin-label text-right">Total</th>
            <th className="px-5 py-3 fin-label">Last updated</th>
            <th className="px-5 py-3 fin-label text-right">New</th>
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
              <td className="px-5 py-4 text-right font-semibold tabular-nums text-fin-navy">
                {item.relatedStoriesCount}
              </td>
              <td className="px-5 py-4">
                <TimeAgo iso={item.feedLastUpdatedAt} />
              </td>
              <td className="px-5 py-4 text-right">
                <span
                  className={
                    item.newStoriesCount > 0
                      ? "inline-flex min-w-[2rem] justify-center rounded-full bg-fin-brand-soft px-2.5 py-0.5 font-bold tabular-nums text-fin-brand"
                      : "text-fin-subtle"
                  }
                >
                  {item.newStoriesCount > 0 ? item.newStoriesCount : "—"}
                </span>
              </td>
              <td className="px-5 py-4 text-right">
                <Link
                  href={`/topic/${item.topicSlug}`}
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
