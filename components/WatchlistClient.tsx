"use client";

import { useCallback, useEffect, useState } from "react";
import type { WatchlistFeedItem } from "@/lib/types";
import {
  getInitialWatchlistFeedMeta,
  mockRefreshDelay,
  refreshWatchlistFeed,
  toWatchlistFeedItems,
} from "@/lib/mock-refresh";
import { AddToWatchlist } from "./AddToWatchlist";
import { FeedStatusBar } from "./FeedStatusBar";
import { RefreshFeedButton } from "./RefreshFeedButton";
import { useWatchlist } from "./WatchlistProvider";
import { WatchlistSummary } from "./WatchlistSummary";
import { WatchlistTable } from "./WatchlistTable";

export function WatchlistClient() {
  const { items: followedItems } = useWatchlist();
  const [items, setItems] = useState<WatchlistFeedItem[]>(() => toWatchlistFeedItems(followedItems));
  const [meta, setMeta] = useState(getInitialWatchlistFeedMeta);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setItems((prev) => {
      const prevById = new Map(prev.map((item) => [item.id, item]));
      return toWatchlistFeedItems(followedItems).map((next) => {
        const existing = prevById.get(next.id);
        return existing
          ? {
              ...existing,
              ...next,
              feedLastUpdatedAt: existing.feedLastUpdatedAt,
              newStoriesCount: existing.newStoriesCount,
            }
          : next;
      });
    });
  }, [followedItems]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await mockRefreshDelay(800);
    const result = refreshWatchlistFeed(items, meta.refreshCount);
    setItems(result.items);
    setMeta(result.meta);
    setLoading(false);
  }, [items, meta.refreshCount]);

  const sorted = [...items].sort(
    (a, b) =>
      new Date(b.feedLastUpdatedAt).getTime() - new Date(a.feedLastUpdatedAt).getTime()
  );

  return (
    <>
      <div className="mb-8">
        <AddToWatchlist />
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <FeedStatusBar lastUpdatedAt={meta.lastUpdatedAt} />
        <RefreshFeedButton
          onClick={handleRefresh}
          loading={loading}
          loadingMessage="Refreshing watchlist…"
          label="Refresh watchlist"
        />
      </div>

      {loading && (
        <p className="mb-4 text-sm text-fin-accent" role="status">
          Refreshing watchlist…
        </p>
      )}

      <div className="mb-8">
        <WatchlistSummary items={items} />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-fin-navy">Your watchlist</h2>
          <p className="text-sm text-fin-subtle">
            {items.length} items · sorted by last feed update
          </p>
        </div>
        <WatchlistTable items={sorted} />
      </section>
    </>
  );
}
