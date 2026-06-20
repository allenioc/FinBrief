import { TOPIC_STORIES_MAX } from "./news-constants";
import { filterUniqueStories } from "./dashboard-sections";
import { toTopicSlug } from "./slug";
import type { Brief, WatchlistItem } from "./types";

const BROAD_INDEX_ETFS = new Set(["SPY", "QQQ", "VTI", "DIA"]);
const MATCH_THRESHOLD = 28;

type TopicMatchConfig = {
  symbols?: string[];
  terms?: string[];
  topics?: string[];
};

const COMPANY_ALIASES: Record<string, string[]> = {
  AAPL: ["apple", "iphone"],
  MSFT: ["microsoft", "azure"],
  NVDA: ["nvidia", "gpu"],
  TSLA: ["tesla"],
  GOOGL: ["google", "alphabet"],
  AMZN: ["amazon", "aws"],
  META: ["meta platforms", "facebook"],
};

const TOPIC_MATCH: Record<string, TopicMatchConfig> = {
  aapl: { symbols: ["AAPL"], terms: ["apple", "iphone", "app store"] },
  apple: { symbols: ["AAPL"], terms: ["apple", "iphone", "app store"] },
  msft: { symbols: ["MSFT"], terms: ["microsoft", "azure", "windows"] },
  microsoft: { symbols: ["MSFT"], terms: ["microsoft", "azure", "windows"] },
  nvda: { symbols: ["NVDA"], terms: ["nvidia", "gpu", "cuda", "data center"] },
  nvidia: { symbols: ["NVDA"], terms: ["nvidia", "gpu", "cuda", "data center"] },
  tsla: { symbols: ["TSLA"], terms: ["tesla", "electric vehicle", " ev "] },
  tesla: { symbols: ["TSLA"], terms: ["tesla", "electric vehicle", " ev "] },
  googl: { symbols: ["GOOGL"], terms: ["google", "alphabet", "youtube"] },
  google: { symbols: ["GOOGL"], terms: ["google", "alphabet", "youtube"] },
  amzn: { symbols: ["AMZN"], terms: ["amazon", "aws", "prime"] },
  amazon: { symbols: ["AMZN"], terms: ["amazon", "aws", "prime"] },
  meta: { symbols: ["META"], terms: ["meta platforms", "facebook", "instagram"] },
  spy: {
    symbols: ["SPY"],
    terms: ["s&p 500", "s&p500", "sp 500", "large-cap", "large cap", "broad market", "s&p"],
  },
  qqq: {
    symbols: ["QQQ"],
    terms: ["nasdaq-100", "nasdaq 100", "nasdaq", "mega-cap tech", "tech stocks"],
  },
  vti: { symbols: ["VTI"], terms: ["total market", "total stock market", "all-cap", "broad market"] },
  dia: { symbols: ["DIA"], terms: ["dow jones", "dow 30", "industrial average", "blue chip"] },
  tlt: { symbols: ["TLT"], terms: ["treasury", "bond", "yields", "interest rate"] },
  ai: {
    terms: ["artificial intelligence", "generative ai", "machine learning", "openai", " ai ", "data center"],
    topics: ["AI Stocks", "Semiconductors"],
  },
  markets: {
    terms: ["stock market", "wall street", "equity market", "market rally", "market selloff", "indexes", "markets"],
  },
  economy: {
    terms: ["economy", "economic", "gdp", "recession", "growth", "labor market", "jobs report"],
  },
  banking: {
    terms: ["bank", "banking", "lending", "credit", "financial sector", "regional banks", "deposit"],
  },
  "real estate": {
    terms: ["real estate", "housing", "mortgage", "home prices", "reit", "commercial property"],
  },
  "interest rates": {
    terms: [
      "interest rate",
      "interest rates",
      "fed ",
      "federal reserve",
      "fomc",
      "yields",
      "treasury",
      "rate cut",
      "rate hike",
    ],
    topics: ["Interest Rates", "Fed Policy", "Inflation"],
  },
  "fed policy": {
    terms: ["federal reserve", "fomc", "fed ", "powell", "monetary policy", "rate cut", "rate hike"],
    topics: ["Fed Policy", "Interest Rates"],
  },
  energy: {
    terms: ["energy", "oil ", " crude", "natural gas", "opec", "energy sector"],
    topics: ["Energy"],
  },
  inflation: { terms: ["inflation", "cpi", "consumer price", "pce"], topics: ["Inflation"] },
  xlk: { symbols: ["XLK"], terms: ["technology sector", " tech ", "software"] },
  smh: { symbols: ["SMH"], terms: ["semiconductor", " chip ", "foundry"] },
};

export function normalizeTopicQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function findWatchlistItemForQuery(
  items: WatchlistItem[],
  query: string
): WatchlistItem | undefined {
  const normalized = normalizeTopicQuery(query);
  const slug = toTopicSlug(query);
  return items.find((item) => {
    if (normalizeTopicQuery(item.symbol) === normalized) return true;
    if (normalizeTopicQuery(item.name) === normalized) return true;
    if (item.topicSlug === slug) return true;
    return false;
  });
}

function briefSearchText(brief: Brief): string {
  const assetText = [
    brief.ticker,
    brief.topic,
    brief.articleType,
    brief.source,
    ...brief.keyAffectedAssets,
    ...brief.relatedAssets.map((asset) => `${asset.symbol} ${asset.name}`),
    ...brief.keyTerms.map((term) => `${term.term} ${term.definition}`),
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

function publishedTime(iso: string): number {
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
}

function uniqueTerms(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter(Boolean).map((value) => value!.toLowerCase()))];
}

export function resolveTopicConfig(
  query: string,
  watchlistItem?: Pick<WatchlistItem, "symbol" | "name" | "type">
): TopicMatchConfig {
  const normalized = normalizeTopicQuery(query);
  const symbolKey = normalizeTopicQuery(watchlistItem?.symbol ?? query);
  const base =
    TOPIC_MATCH[normalized] ??
    TOPIC_MATCH[symbolKey] ??
    ({
      symbols:
        normalized.length <= 6 && !normalized.includes(" ")
          ? [(watchlistItem?.symbol ?? query).trim().toUpperCase()]
          : undefined,
      terms: [normalized],
    } satisfies TopicMatchConfig);

  if (!watchlistItem) return base;

  const nameParts = watchlistItem.name
    .toLowerCase()
    .split(/[\s,./]+/)
    .filter((part) => part.length > 3);

  const symbolUpper = watchlistItem.symbol.toUpperCase();
  const aliases = COMPANY_ALIASES[symbolUpper] ?? [];

  return {
    symbols:
      base.symbols ??
      (watchlistItem.type === "stock" ||
      watchlistItem.type === "etf" ||
      watchlistItem.type === "index"
        ? [symbolUpper]
        : undefined),
    terms: uniqueTerms([
      ...(base.terms ?? []),
      normalized,
      symbolKey,
      watchlistItem.name,
      ...nameParts,
      ...aliases,
    ]),
    topics: uniqueTerms([
      ...(base.topics ?? []),
      watchlistItem.type === "topic" || watchlistItem.type === "sector" ? watchlistItem.name : undefined,
      watchlistItem.type === "topic" || watchlistItem.type === "sector" ? watchlistItem.symbol : undefined,
    ]),
  };
}

function topicMatchScore(
  brief: Brief,
  config: TopicMatchConfig,
  rawQuery: string,
  watchlistItem?: Pick<WatchlistItem, "symbol" | "name" | "type">
): number {
  const text = briefSearchText(brief);
  const ticker = brief.ticker.toUpperCase();
  let score = 0;

  for (const symbol of config.symbols ?? []) {
    const upper = symbol.toUpperCase();
    if (ticker === upper) score += 100;
    if (brief.keyAffectedAssets.some((asset) => asset.toUpperCase() === upper)) score += 80;
    if (brief.relatedAssets.some((asset) => asset.symbol.toUpperCase() === upper)) score += 70;
    if (containsWord(text, upper)) score += 65;
    if (BROAD_INDEX_ETFS.has(upper) && brief.articleType === "ETF/index news") score += 40;
    const aliases = COMPANY_ALIASES[upper] ?? [];
    if (aliases.some((alias) => containsTerm(text, alias))) score += 55;
  }

  for (const term of config.terms ?? []) {
    if (containsTerm(text, term)) score += 45;
    if (containsTerm(brief.source.toLowerCase(), term)) score += 20;
  }

  for (const topic of config.topics ?? []) {
    if (brief.topic.toLowerCase() === topic.toLowerCase()) score += 55;
    if (containsTerm(text, topic.toLowerCase())) score += 35;
  }

  const normalizedQuery = normalizeTopicQuery(rawQuery);
  if (containsWord(text, normalizedQuery)) score += 50;
  if (brief.topic.toLowerCase() === normalizedQuery) score += 60;
  if (containsTerm(brief.excerpt.toLowerCase(), normalizedQuery)) score += 35;
  if (containsTerm(brief.headline.toLowerCase(), normalizedQuery)) score += 40;

  if (watchlistItem) {
    const nameParts = watchlistItem.name
      .toLowerCase()
      .split(/[\s,./]+/)
      .filter((part) => part.length > 3);
    if (nameParts.some((part) => containsWord(text, part))) score += 40;
    if (watchlistItem.type === "sector" && brief.articleType === "sector news") score += 25;
    if (watchlistItem.type === "topic" && (brief.articleType === "macro news" || brief.articleType === "market news")) {
      score += 15;
    }
    if (watchlistItem.type === "etf" && brief.articleType === "ETF/index news") score += 20;
  }

  return score;
}

export function filterBriefsForTopic(
  briefs: Brief[],
  topicQuery: string,
  max: number = TOPIC_STORIES_MAX,
  watchlistItem?: Pick<WatchlistItem, "symbol" | "name" | "type">
): Brief[] {
  const trimmed = topicQuery.trim();
  if (!trimmed) return briefs;

  const config = resolveTopicConfig(trimmed, watchlistItem);
  const ranked = briefs
    .map((brief) => ({
      brief,
      score: topicMatchScore(brief, config, trimmed, watchlistItem),
    }))
    .filter((entry) => entry.score >= MATCH_THRESHOLD)
    .sort(
      (a, b) =>
        b.score - a.score ||
        publishedTime(b.brief.publishedAt) - publishedTime(a.brief.publishedAt)
    );

  return filterUniqueStories(ranked.map((entry) => entry.brief)).slice(0, max);
}

export function isTopicFilterQuery(query: string): boolean {
  return Boolean(query.trim());
}
