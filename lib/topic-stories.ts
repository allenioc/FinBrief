import { TOPIC_STORIES_MAX } from "./news-constants";
import { filterUniqueStories } from "./dashboard-sections";
import type { Brief } from "./types";

const BROAD_INDEX_ETFS = new Set(["SPY", "QQQ", "VTI", "DIA"]);

type TopicMatchConfig = {
  symbols?: string[];
  terms?: string[];
  topics?: string[];
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
  inflation: { terms: ["inflation", "cpi", "consumer price", "pce"], topics: ["Inflation"] },
};

export function normalizeTopicQuery(query: string): string {
  return query.trim().toLowerCase();
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

function publishedTime(iso: string): number {
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
}

function topicMatchScore(brief: Brief, config: TopicMatchConfig, rawQuery: string): number {
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
  }

  for (const term of config.terms ?? []) {
    if (containsTerm(text, term)) score += 45;
  }

  for (const topic of config.topics ?? []) {
    if (brief.topic.toLowerCase() === topic.toLowerCase()) score += 55;
    if (containsTerm(text, topic.toLowerCase())) score += 35;
  }

  const normalizedQuery = normalizeTopicQuery(rawQuery);
  if (containsWord(text, normalizedQuery)) score += 50;
  if (brief.topic.toLowerCase() === normalizedQuery) score += 60;

  return score;
}

function resolveTopicConfig(query: string): TopicMatchConfig {
  const normalized = normalizeTopicQuery(query);
  if (TOPIC_MATCH[normalized]) return TOPIC_MATCH[normalized];

  return {
    symbols: normalized.length <= 5 ? [normalized.toUpperCase()] : undefined,
    terms: [normalized],
  };
}

export function filterBriefsForTopic(
  briefs: Brief[],
  topicQuery: string,
  max: number = TOPIC_STORIES_MAX
): Brief[] {
  const trimmed = topicQuery.trim();
  if (!trimmed) return briefs;

  const config = resolveTopicConfig(trimmed);
  const ranked = briefs
    .map((brief) => ({
      brief,
      score: topicMatchScore(brief, config, trimmed),
    }))
    .filter((entry) => entry.score >= 35)
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
