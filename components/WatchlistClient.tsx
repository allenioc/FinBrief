"use client";

import { AddToWatchlist } from "./AddToWatchlist";
import { useWatchlist } from "./WatchlistProvider";
import { WatchlistSummary } from "./WatchlistSummary";
import { WatchlistTable } from "./WatchlistTable";

export function WatchlistClient() {
  const { items } = useWatchlist();

  return (
    <>
      <div className="mb-8">
        <AddToWatchlist />
      </div>

      <div className="mb-8">
        <WatchlistSummary items={items} />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-fin-navy">Your topics</h2>
          <p className="text-sm text-fin-subtle">
            {items.length} saved {items.length === 1 ? "topic" : "topics"} · click Open to filter live news
          </p>
        </div>
        <WatchlistTable items={items} />
      </section>
    </>
  );
}
