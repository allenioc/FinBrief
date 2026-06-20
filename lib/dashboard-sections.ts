import {
  DASHBOARD_TOP_STORIES_MAX,
  DASHBOARD_WATCHLIST_MAX,
} from "./news-constants";
import { countArticlesWithImageUrl } from "./article-image";
import type { Brief, WatchlistItem } from "./types";

const BROAD_INDEX_ETFS = new Set(["SPY", "QQQ", "VTI", "DIA"]);

const TOPIC_ALIASES: Record<string, string[]> = {
  "AI STOCKS": [
    "artificial intelligence",
    " ai ",
    "generative ai",
    "machine learning",
    "openai",
    "data center",
    "nvidia",
  ],
  SEMICONDUCTORS: [
    "semiconductor",
    "semiconductors",
    " chip ",
    " chips ",
    "foundry",
    "wafer",
    "smh",
  ],
  INFLATION: ["inflation", "cpi", "consumer price", "price index", "pce"],
  "INTEREST RATES": [
    "interest rate",
    "interest rates",
    "fed ",
    "federal reserve",
    "fomc",
    "policy rate",
    "yields",
    "rate cut",
    "rate hike",
    "treasury",
  ],
  ENERGY: ["oil ", " crude", "natural gas", "energy sector", "opec"],
  "FED POLICY": ["federal reserve", "fomc", "fed ", "powell", "monetary policy"],
  XLK: ["technology sector", " tech ", "software", "cloud", "xlk"],
  SMH: ["semiconductor", " chip ", "smh", "foundry"],
};

const INDEX_TERMS: Record<string, string[]> = {
  SPY: [
    "s&p 500",
    "s&p500",
    "sp 500",
    "sp500",
    "large-cap",
    "large cap",
    "broad market",
    "stock market",
    "wall street",
    "equity market",
    "s&p",
  ],
  QQQ: [
    "nasdaq-100",
    "nasdaq 100",
    "nasdaq100",
    "mega-cap tech",
    "mega cap tech",
    "nasdaq composite",
    "tech stocks",
  ],
  VTI: ["total market", "total stock market", "entire market", "all-cap", "broad market"],
  DIA: ["dow jones", "dow 30", "industrial average", "blue chip"],
};

const COMPANY_ALIASES: Record<string, string[]> = {
  AAPL: ["apple", "iphone", "app store"],
  MSFT: ["microsoft", "azure", "windows"],
  NVDA: ["nvidia", "gpu", "cuda"],
  TSLA: ["tesla", "ev ", "electric vehicle"],
  GOOGL: ["google", "alphabet", "youtube"],
  AMZN: ["amazon", "aws", "prime"],
  META: ["meta platforms", "facebook", "instagram"],
};

export interface DashboardSection {
  title: string;
  subtitle: string;
  stories: Brief[];
}

export type DashboardLayoutDebug = {
  savedEditionArticleCount: number;
  topStoriesCount: number;
  watchlistStoriesCount: number;
  articlesWithImageUrl: number;
};

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

  const prefixLength = Math.min(50, left.length, right.length);
  if (prefixLength >= 30) {
    if (left.startsWith(right.slice(0, prefixLength)) || right.startsWith(left.slice(0, prefixLength))) {
      return true;
    }
  }

  const wordsLeft = new Set(left.split(" ").filter((word) => word.length > 4));
  const wordsRight = new Set(right.split(" ").filter((word) => word.length > 4));
  if (wordsLeft.size === 0 || wordsRight.size === 0) return false;

  let overlap = 0;
  wordsLeft.forEach((word) => {
    if (wordsRight.has(word)) overlap += 1;
  });
  return overlap / Math.min(wordsLeft.size, wordsRight.size) >= 0.85;
}

export function isHardDuplicate(a: Brief, b: Brief): boolean {
  if (a.id === b.id) return true;

  const urlA = normalizeArticleUrl(a.originalUrl);
  const urlB = normalizeArticleUrl(b.originalUrl);
  return Boolean(urlA && urlB && urlA === urlB);
}

export function isSameStory(a: Brief, b: Brief): boolean {
  if (isHardDuplicate(a, b)) return true;
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

function filterHardUniqueStories(stories: Brief[]): Brief[] {
  const kept: Brief[] = [];
  for (const story of stories) {
    if (kept.some((item) => isHardDuplicate(story, item))) continue;
    kept.push(story);
  }
  return kept;
}

function publishedTime(iso: string): number {
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
}

function briefSearchText(brief: Brief): string {
  const assetText = [
    brief.ticker,
    brief.topic,
    brief.articleType,
    ...brief.keyAffectedAssets,
    ...brief.relatedAssets.map((asset) => `${asset.symbol} ${asset.name}`),
    ...brief.keyTerms.map((term) => term.term),
  ].join(" ");

  return `${brief.headline} ${brief.excerpt} ${brief.summary} ${brief.whoIsAffected} ${assetText}`.toLowerCase();
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
  if (brief.keyAffectedAssets.some((asset) => asset.toUpperCase() === symbol)) return true;

  if (!isBroadMarketRelevant(brief)) return false;

  const terms = INDEX_TERMS[symbol] ?? [];
  if (terms.some((term) => containsTerm(text, term))) return true;

  if ((symbol === "SPY" || symbol === "VTI") && brief.articleType === "macro news") {
    return true;
  }

  if (symbol === "QQQ") {
    return (
      (brief.articleType === "macro news" ||
        brief.articleType === "ETF/index news" ||
        brief.articleType === "sector news") &&
      (containsTerm(text, "nasdaq") || containsTerm(text, "tech"))
    );
  }

  return false;
}

function watchlistMatchScore(brief: Brief, item: WatchlistItem): number {
  const text = briefSearchText(brief);
  const symbol = item.symbol.toUpperCase();
  const ticker = brief.ticker.toUpperCase();
  let score = 0;

  if (ticker !== "—" && ticker === symbol) score += 100;
  if (brief.keyAffectedAssets.some((asset) => asset.toUpperCase() === symbol)) score += 80;
  if (brief.relatedAssets.some((asset) => asset.symbol.toUpperCase() === symbol)) score += 70;

  if (BROAD_INDEX_ETFS.has(symbol) && matchesBroadIndexEtf(brief, symbol, text)) {
    score += 60;
  }

  if (item.type === "stock") {
    if (containsWord(text, symbol)) score += 65;
    const aliases = COMPANY_ALIASES[symbol] ?? [];
    if (aliases.some((alias) => containsTerm(text, alias))) score += 55;
    const nameParts = item.name
      .toLowerCase()
      .split(/[\s,./]+/)
      .filter((part) => part.length > 3);
    if (nameParts.some((part) => containsWord(text, part))) score += 40;
  }

  if (item.type === "etf" || item.type === "index") {
    if (containsWord(text, symbol)) score += 60;
    if (containsTerm(text, item.name.toLowerCase())) score += 45;
  }

  const topicKey = item.symbol.toUpperCase();
  const topicLower = item.symbol.toLowerCase();
  if (brief.topic.toLowerCase() === topicLower) score += 55;
  if (containsTerm(text, topicLower)) score += 40;

  const aliases = TOPIC_ALIASES[topicKey] ?? TOPIC_ALIASES[item.name.toUpperCase()] ?? [];
  if (aliases.some((alias) => containsTerm(text, alias))) score += 35;

  if (item.type === "sector" && brief.articleType === "sector news") score += 25;
  if (item.type === "topic" && (brief.articleType === "macro news" || brief.articleType === "market news")) {
    score += 10;
  }

  return score;
}

export function isWatchlistRelated(brief: Brief, watchlistItems: WatchlistItem[]): boolean {
  if (watchlistItems.length === 0) return false;
  return watchlistItems.some((item) => watchlistMatchScore(brief, item) >= 30);
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

function rankStories(stories: Brief[]): Brief[] {
  return [...stories].sort((a, b) => {
    const scoreDelta = scoreTopStory(b) - scoreTopStory(a);
    if (scoreDelta !== 0) return scoreDelta;
    return publishedTime(b.publishedAt) - publishedTime(a.publishedAt);
  });
}

function pickWatchlistStories(
  pool: Brief[],
  topStories: Brief[],
  watchlistItems: WatchlistItem[]
): Brief[] {
  if (watchlistItems.length === 0) return [];

  const ranked = pool
    .map((brief) => ({
      brief,
      score: Math.max(0, ...watchlistItems.map((item) => watchlistMatchScore(brief, item))),
    }))
    .filter((entry) => entry.score >= 30)
    .sort(
      (a, b) =>
        b.score - a.score ||
        publishedTime(b.brief.publishedAt) - publishedTime(a.brief.publishedAt)
    );

  return filterUniqueStories(
    ranked.map((entry) => entry.brief),
    topStories
  ).slice(0, DASHBOARD_WATCHLIST_MAX);
}

export function buildDashboardSections(
  briefs: Brief[],
  watchlistItems: WatchlistItem[]
): { sections: DashboardSection[]; layoutDebug: DashboardLayoutDebug } {
  // Use the full saved daily edition; week scoping is applied when the edition is fetched.
  const pool = filterHardUniqueStories(rankStories(briefs));

  const topStories = pool.slice(0, DASHBOARD_TOP_STORIES_MAX);
  const watchlistStories = pickWatchlistStories(pool, topStories, watchlistItems);

  const marketStories = filterUniqueStories(
    pool.filter((brief) => brief.articleType === "market news" || brief.articleType === "macro news"),
    [...topStories, ...watchlistStories]
  );

  const recommendedStories = filterUniqueStories(pool, [
    ...topStories,
    ...watchlistStories,
    ...marketStories,
  ]);

  const layoutDebug: DashboardLayoutDebug = {
    savedEditionArticleCount: briefs.length,
    topStoriesCount: topStories.length,
    watchlistStoriesCount: watchlistStories.length,
    articlesWithImageUrl: countArticlesWithImageUrl(briefs),
  };

  return {
    layoutDebug,
    sections: [
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
        title: "Recommended Next",
        subtitle: "Additional stories worth reading",
        stories: recommendedStories,
      },
      {
        title: "Watchlist Stories",
        subtitle: "Stories tied to assets you follow",
        stories: watchlistStories,
      },
    ],
  };
}
