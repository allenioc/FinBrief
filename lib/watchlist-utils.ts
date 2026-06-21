import { toTopicSlug } from "./slug";
import type { Brief, TopicProfile, WatchlistItem, WatchlistItemType } from "./types";

export const WATCHLIST_STORAGE_KEY = "finbrief-watchlist";

/** Newest additions first — shared by watchlist table and sidebar Following. */
export function sortWatchlistItems(items: WatchlistItem[]): WatchlistItem[] {
  return [...items].sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  );
}

function toSymbol(value: string): string {
  return value.trim().toUpperCase();
}

const KNOWN_ETFS = new Set([
  "SPY",
  "QQQ",
  "VTI",
  "DIA",
  "XLK",
  "SMH",
  "TLT",
  "IWM",
  "EFA",
  "EEM",
]);

export function inferWatchlistType(symbol: string): WatchlistItemType {
  const trimmed = symbol.trim();
  if (!trimmed) return "topic";
  if (trimmed.includes(" ")) return "topic";
  const upper = trimmed.toUpperCase();
  if (KNOWN_ETFS.has(upper)) return "etf";
  if (/^[A-Z]{1,5}$/.test(upper)) return "stock";
  return "topic";
}

export function normalizeFollowInput(input: {
  symbol: string;
  name?: string;
  type?: WatchlistItemType;
}): WatchlistItem | null {
  const trimmed = input.symbol.trim();
  if (!trimmed) return null;
  const type = input.type ?? inferWatchlistType(trimmed);
  const symbol =
    type === "stock" || type === "etf" || type === "index" ? trimmed.toUpperCase() : trimmed;
  return createWatchlistItem({
    symbol,
    name: input.name?.trim() || trimmed,
    type,
  });
}

export function createWatchlistItem(input: {
  symbol: string;
  name?: string;
  type?: WatchlistItemType;
  relatedStoriesCount?: number;
  latestSentiment?: WatchlistItem["latestSentiment"];
  marketImpact?: WatchlistItem["marketImpact"];
}): WatchlistItem {
  const symbol = toSymbol(input.symbol);
  const now = new Date().toISOString();
  return {
    id: `w-${toTopicSlug(symbol)}`,
    symbol,
    name: input.name?.trim() || symbol,
    type: input.type ?? inferWatchlistType(symbol),
    topicSlug: toTopicSlug(symbol),
    addedAt: now,
    lastUpdated: now,
    latestSentiment: input.latestSentiment ?? "neutral",
    marketImpact: input.marketImpact ?? "medium",
    relatedStoriesCount: input.relatedStoriesCount ?? 1,
  };
}

export function watchlistItemFromBrief(brief: Brief): WatchlistItem {
  const symbol = brief.ticker !== "—" ? brief.ticker : brief.topic;
  return createWatchlistItem({
    symbol,
    name: brief.topic,
    type: mapArticleTypeToWatchlistType(brief.articleType),
    latestSentiment: brief.sentiment,
    marketImpact: brief.marketImpact,
    relatedStoriesCount: Math.max(1, brief.keyAffectedAssets.length),
  });
}

export function watchlistItemFromTopic(profile: TopicProfile): WatchlistItem {
  return createWatchlistItem({
    symbol: profile.symbol,
    name: profile.name,
    type: profile.type,
    latestSentiment: profile.latestSentiment,
    marketImpact: profile.marketImpact,
  });
}

export function mapArticleTypeToWatchlistType(type: Brief["articleType"]): WatchlistItemType {
  if (type === "ETF/index news") return "etf";
  if (type === "sector news") return "sector";
  if (type === "macro news") return "topic";
  return "stock";
}
