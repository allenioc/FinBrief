import type { WatchlistFeedItem, WatchlistItemType } from "@/lib/types";

const typeLabels: Record<WatchlistItemType, string> = {
  stock: "Stocks",
  etf: "ETFs",
  index: "Indexes",
  sector: "Sectors",
  topic: "Macro topics",
};

export function WatchlistSummary({ items }: { items: WatchlistFeedItem[] }) {
  const byType = items.reduce(
    (acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<WatchlistItemType, number>
  );

  const totalStories = items.reduce((sum, i) => sum + i.relatedStoriesCount, 0);
  const totalNew = items.reduce((sum, i) => sum + i.newStoriesCount, 0);
  const highImpact = items.filter((i) => i.marketImpact === "high").length;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard label="Watchlist items" value={String(items.length)} />
      <StatCard label="Related stories" value={String(totalStories)} sub="Across all symbols" />
      <StatCard label="New stories" value={String(totalNew)} sub="Since last refresh (mock)" />
      <StatCard label="High impact items" value={String(highImpact)} sub="Elevated market sensitivity" />
      <div className="fin-card p-4">
        <p className="fin-label">Breakdown</p>
        <ul className="mt-2 space-y-1">
          {(Object.keys(typeLabels) as WatchlistItemType[]).map((type) => {
            const count = byType[type] ?? 0;
            if (count === 0) return null;
            return (
              <li key={type} className="flex justify-between text-sm">
                <span className="text-fin-subtle">{typeLabels[type]}</span>
                <span className="font-semibold tabular-nums text-fin-navy">{count}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="fin-card p-4">
      <p className="fin-label">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-fin-navy">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-fin-subtle">{sub}</p>}
    </div>
  );
}
