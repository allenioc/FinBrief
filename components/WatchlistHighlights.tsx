"use client";

import Link from "next/link";
import { useWatchlist } from "./WatchlistProvider";
import { FollowToggleButton } from "./FollowToggleButton";

export function WatchlistHighlights() {
  const { items } = useWatchlist();
  const highlights = items.slice(0, 8);

  if (highlights.length === 0) {
    return (
      <p className="fin-panel py-10 text-center text-sm text-fin-subtle">
        You are not following anything yet. Add symbols in the watchlist page.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {highlights.map((item) => (
        <Link key={item.id} href={`/?q=${encodeURIComponent(item.symbol)}`} className="fin-card fin-card-hover p-4">
          <span className="font-mono text-sm font-bold text-fin-brand">{item.symbol}</span>
          <p className="mt-1 text-xs text-fin-subtle line-clamp-2">{item.name}</p>
          <p className="mt-2 text-xs font-medium text-fin-subtle">Open live topic feed</p>
          <div className="mt-3">
            <FollowToggleButton item={item} />
          </div>
        </Link>
      ))}
    </div>
  );
}
