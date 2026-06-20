import type { Brief, WatchlistItem } from "./types";

const BROAD_INDEX_ETFS = new Set(["SPY", "QQQ", "VTI", "DIA"]);

const TOPIC_ALIASES: Record<string, string[]> = {
  "AI STOCKS": ["artificial intelligence", " ai ", "generative ai", "machine learning", "openai"],
  SEMICONDUCTORS: ["semiconductor", "semiconductors", " chip ", " chips ", "foundry", "wafer"],
  INFLATION: ["inflation", "cpi", "consumer price", "price index"],
  "INTEREST RATES": ["interest rate", "interest rates", "fed ", "federal reserve", "fomc", "policy rate", "yields", "rate cut", "rate hike"],
  ENERGY: ["oil ", " crude", "natural gas", "energy sector"],
  "FED POLICY": ["federal reserve", "fomc", "fed ", "powell", "monetary policy"],
};

const INDEX_TERMS: Record<string, string[]> = {
  SPY: ["s&p 500", "s&p500", "sp 500", "sp500", "large-cap", "large cap", "broad market", "stock market", "wall street", "equity market", "s&p"],
  QQQ: ["nasdaq-100", "nasdaq 100", "nasdaq100", "mega-cap tech", "mega cap tech", "nasdaq composite"],
  VTI: ["total market", "total stock market", "entire market", "all-cap"],
  DIA: ["dow jones", "dow 30", "industrial average", "blue chip"],
};

const COMPANY_ALIASES: Record<string, string[]> = {
  AAPL: ["apple"],
  MSFT: ["microsoft"],
  NVDA: ["nvidia"],
  TSLA: ["tesla"],
  GOOGL: ["google", "alphabet"],
  AMZN: ["amazon"],
  META: ["meta platforms", "facebook"],
};

export interface DashboardSection {
  title: string;
  subtitle: string;
  stories: Brief[];
  emptyMessage?: string;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArticleUrl(url: string): string {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().toLowerCase().replace(/\/$/, "");
  } catch {
    return trimmed.toLowerCase();
  }
}

export function areSimilarTitles(a: string, b: string): boolean {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const prefixLength = Math.min(40, left.length, right.length);
  if (prefixLength >= 20) {
    if (left.startsWith(right.slice(0, prefixLength)) || right.startsWith(left.slice(0, prefixLength))) {
      return true;
    }
  }

  const wordsLeft = new Set(left.split(" ").filter((word) => word.length > 3));
  const wordsRight = new Set(right.split(" ").filter((word) => word.length > 3));
  if (wordsLeft.size === 0 || wordsRight.size === 0) return false;

  let overlap = 0;
  wordsLeft.forEach((word) => {
    if (wordsRight.has(word)) overlap += 1;
  });
  return overlap / Math.min(wordsLeft.size, wordsRight.size) >= 0.75;
}

export function isSameStory(a: Brief, b: Brief): boolean {
  if (a.id === b.id) return true;

  const urlA = normalizeArticleUrl(a.originalUrl);
  const urlB = normalizeArticleUrl(b.originalUrl);
  if (urlA && urlB && urlA === urlB) return true;

  return areSimilarTitles(a.headline, b.headline);
}

export function filterUniqueStories(stories: Brief[], excluded: Brief[] = []): Brief[] {
  const kept: Brief[] = [];
  for (const story of stories) {
    if (excluded.some((item) => isSameStory(story, item))) continue;
    if (kept.some((item) => isSameStory(story, item))) continue;
    kept.push(story);
  }
  return kept;
}

function publishedTime(iso: string): number {
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
}

function briefSearchText(brief: Brief): string {
  return `${brief.headline} ${brief.excerpt} ${brief.summary} ${brief.topic} ${brief.whoIsAffected}`.toLowerCase();
}

function containsTerm(text: string, term: string): boolean {
  return text.includes(term.toLowerCase());
}

function containsWord(text: string, word: string): boolean {
  const trimmed = word.trim();
  if (!trimmed) return false;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

function isBroadMarketRelevant(brief: Brief): boolean {
  if (brief.articleType === "macro news" || brief.articleType === "market news") return true;

  if (brief.articleType === "ETF/index news") {
    const ticker = brief.ticker.toUpperCase();
    return BROAD_INDEX_ETFS.has(ticker);
  }

  const text = briefSearchText(brief);
  const broadTerms = [
    "stock market",
    "wall street",
    "broad market",
    "equity markets",
    "major indexes",
    "market rally",
    "market selloff",
    "s&p",
    "nasdaq",
    "dow jones",
  ];
  return broadTerms.some((term) => containsTerm(text, term));
}

function matchesBroadIndexEtf(brief: Brief, symbol: string, text: string): boolean {
  const ticker = brief.ticker.toUpperCase();
  if (ticker === symbol) return true;
  if (!isBroadMarketRelevant(brief)) return false;

  const terms = INDEX_TERMS[symbol] ?? [];
  if (terms.some((term) => containsTerm(text, term))) return true;

  if ((symbol === "SPY" || symbol === "VTI") && brief.articleType === "macro news") {
    return true;
  }

  if (symbol === "QQQ") {
    return (
      (brief.articleType === "macro news" || brief.articleType === "ETF/index news") &&
      containsTerm(text, "nasdaq")
    );
  }

  return false;
}

export function isWatchlistRelated(brief: Brief, watchlistItems: WatchlistItem[]): boolean {
  if (watchlistItems.length === 0) return false;

  const text = briefSearchText(brief);
  const ticker = brief.ticker.toUpperCase();

  return watchlistItems.some((item) => {
    const symbol = item.symbol.toUpperCase();

    if (ticker !== "—" && ticker === symbol) return true;

    if (BROAD_INDEX_ETFS.has(symbol)) {
      return matchesBroadIndexEtf(brief, symbol, text);
    }

    if (item.type === "stock") {
      if (containsWord(text, symbol)) return true;
      const aliases = COMPANY_ALIASES[symbol] ?? [];
      if (aliases.some((alias) => containsTerm(text, alias))) return true;
      if (containsWord(text, item.name)) return true;
      return false;
    }

    if (item.type === "etf" || item.type === "index") {
      if (containsWord(text, symbol)) return true;
      if (containsTerm(text, item.name.toLowerCase())) return true;
      return false;
    }

    const topicKey = item.symbol.toUpperCase();
    const topicLower = item.symbol.toLowerCase();
    if (brief.topic.toLowerCase() === topicLower) return true;
    if (containsTerm(text, topicLower)) return true;

    const aliases = TOPIC_ALIASES[topicKey] ?? [];
    return aliases.some((alias) => containsTerm(text, alias));
  });
}

function scoreTopStory(brief: Brief): number {
  let score = 0;
  if (brief.marketImpact === "high") score += 4;
  else if (brief.marketImpact === "medium") score += 2;
  else score += 1;

  if (brief.articleType === "macro news" || brief.articleType === "market news") score += 3;
  else if (brief.articleType === "ETF/index news") score += 2;
  else if (brief.ticker !== "—") score += 1;

  score += publishedTime(brief.publishedAt) / 1e13;
  return score;
}

function withinWeek(iso: string, now: number): boolean {
  const published = publishedTime(iso);
  if (!published) return true;
  const ageMs = now - published;
  if (ageMs < 0) return true;
  return ageMs <= 7 * 24 * 60 * 60 * 1000;
}

export function buildDashboardSections(
  briefs: Brief[],
  watchlistItems: WatchlistItem[],
  visibleCount: number
): DashboardSection[] {
  const now = Date.now();
  const scoped = [...briefs]
    .filter((brief) => withinWeek(brief.publishedAt, now))
    .sort((a, b) => publishedTime(b.publishedAt) - publishedTime(a.publishedAt));
  const pool = scoped.slice(0, visibleCount);

  const topStories = filterUniqueStories(
    [...pool].sort((a, b) => scoreTopStory(b) - scoreTopStory(a))
  ).slice(0, 4);

  const watchlistStories = filterUniqueStories(
    pool.filter((brief) => isWatchlistRelated(brief, watchlistItems)),
    topStories
  );

  const marketStories = filterUniqueStories(
    pool.filter((brief) => brief.articleType === "market news" || brief.articleType === "macro news"),
    [...topStories, ...watchlistStories]
  );

  const recommendedStories = filterUniqueStories(pool, [
    ...topStories,
    ...watchlistStories,
    ...marketStories,
  ]);

  return [
    {
      title: "Top Stories",
      subtitle: "Most relevant stories right now",
      stories: topStories,
    },
    {
      title: "Latest Market Stories",
      subtitle: "Macro and index-focused context",
      stories: marketStories,
    },
    {
      title: "Watchlist-related Stories",
      subtitle: "Stories tied to assets you follow",
      stories: watchlistStories,
      emptyMessage:
        watchlistStories.length === 0
          ? "No watchlist-specific stories in today's edition."
          : undefined,
    },
    {
      title: "Recommended Next",
      subtitle: "Additional stories worth reading",
      stories: recommendedStories,
    },
  ];
}
