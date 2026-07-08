/**
 * Mock feed refresh logic — swap these functions for API clients later.
 *
 * Future integration example:
 *   export async function refreshArticleFeed(query: string) {
 *     const res = await fetch(`/api/feed?${query}`);
 *     return res.json();
 *   }
 */

import { MOCK_BRIEFS } from "./articles-data";
import { MARKET_BRIEF } from "./market-brief-data";
import { MOCK_WATCHLIST } from "./watchlist-data";
import { minutesAgoIso, todayMorningBriefIso } from "./date-format";
import { searchBriefs } from "./briefs";
import type { Brief, FeedMeta, MarketBriefData, WatchlistFeedItem, WatchlistItem } from "./types";

const DEFAULT_FEED_META: FeedMeta = {
  lastUpdatedAt: minutesAgoIso(12),
  refreshCount: 0,
};

export function getInitialArticleFeedMeta(): FeedMeta {
  return { ...DEFAULT_FEED_META };
}

export function getInitialMarketBriefMeta(): FeedMeta {
  return {
    lastUpdatedAt: todayMorningBriefIso(),
    refreshCount: 0,
  };
}

export function getInitialWatchlistFeedMeta(): FeedMeta {
  return {
    lastUpdatedAt: minutesAgoIso(8),
    refreshCount: 0,
  };
}

/** Rotate array order deterministically from refresh count. */
function rotateList<T>(items: T[], offset: number): T[] {
  if (items.length === 0) return items;
  const n = items.length;
  const start = offset % n;
  return [...items.slice(start), ...items.slice(0, start)];
}

/**
 * Simulates fetching a fresh article feed.
 * TODO: replace with `fetchNewsBriefs(query)` from your news API.
 */
export function refreshArticleFeed(
  query: string,
  refreshCount: number
): { briefs: Brief[]; meta: FeedMeta } {
  const base = query.trim() ? searchBriefs(query) : [...MOCK_BRIEFS];
  const briefs = rotateList(base, refreshCount + 1);

  return {
    briefs,
    meta: {
      lastUpdatedAt: new Date().toISOString(),
      refreshCount: refreshCount + 1,
    },
  };
}

/**
 * Simulates refreshing the daily market brief.
 * TODO: replace with `fetchMarketBrief()`.
 */
export function refreshMarketBrief(refreshCount: number): {
  data: MarketBriefData;
  meta: FeedMeta;
} {
  const rotatedStories = rotateList(MARKET_BRIEF.topStories, refreshCount + 1);

  return {
    data: {
      ...MARKET_BRIEF,
      topStories: rotatedStories,
    },
    meta: {
      lastUpdatedAt: new Date().toISOString(),
      refreshCount: refreshCount + 1,
    },
  };
}

const WATCHLIST_FEED_OFFSETS = [8, 24, 12, 45, 18, 32, 6, 15, 22, 38, 10, 28, 14, 20];

/**
 * Simulates watchlist feed refresh.
 * TODO: replace with `fetchWatchlistUpdates(symbols)`.
 */
export function refreshWatchlistFeed(
  items: WatchlistFeedItem[],
  refreshCount: number
): { items: WatchlistFeedItem[]; meta: FeedMeta } {
  const refreshed = items.map((item, index) => {
    const minutes = WATCHLIST_FEED_OFFSETS[(index + refreshCount) % WATCHLIST_FEED_OFFSETS.length];
    const newStories = ((index + refreshCount) % 5) + 1;
    return {
      ...item,
      feedLastUpdatedAt: minutesAgoIso(Math.max(1, minutes - (refreshCount % 3))),
      newStoriesCount: newStories,
      relatedStoriesCount: item.relatedStoriesCount + (refreshCount % 2 === 0 ? 0 : 1),
    };
  });

  return {
    items: refreshed,
    meta: {
      lastUpdatedAt: new Date().toISOString(),
      refreshCount: refreshCount + 1,
    },
  };
}

export function toWatchlistFeedItems(items: WatchlistItem[]): WatchlistFeedItem[] {
  return items.map((item, index) => ({
    ...item,
    feedLastUpdatedAt: minutesAgoIso(WATCHLIST_FEED_OFFSETS[index % WATCHLIST_FEED_OFFSETS.length]),
    newStoriesCount: (index % 4) + 1,
  }));
}

export function getInitialWatchlistItems(): WatchlistFeedItem[] {
  return toWatchlistFeedItems(MOCK_WATCHLIST);
}

/** Simulated delay for UX (replace with real network latency). */
export function mockRefreshDelay(ms = 900): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
