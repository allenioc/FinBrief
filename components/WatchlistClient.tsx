"use client";

import { useMemo } from "react";
import { AddToWatchlist } from "./AddToWatchlist";
import { useWatchlist } from "./WatchlistProvider";
import { WatchlistSummary } from "./WatchlistSummary";
import { WatchlistTable } from "./WatchlistTable";

export function WatchlistClient() {
  const { items } = useWatchlist();
  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
      ),
    [items]
  );

  return (
    <>
      <div className="mb-8">
        <AddToWatchlist />
      </div>

      <div className="mb-8">
        <WatchlistSummary items={sorted} />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-fin-navy">Your topics</h2>
          <p className="text-sm text-fin-subtle">
            {sorted.length} saved {sorted.length === 1 ? "topic" : "topics"} · click Open to filter live news
          </p>
        </div>
        <WatchlistTable items={sorted} />
      </section>
    </>
  );
}
