import { ARTICLE_IMAGES } from "./article-images";
import {
  buildEducationalSummary,
  buildLongSummary,
  buildThirtySecondVersion,
  estimateMarketImpact,
  estimateSentiment,
  extractKeyTerms,
  inferArticleType,
} from "./article-analysis";
import { toTopicSlug } from "./slug";
import type { ProviderArticle } from "./news-providers";
import type { Brief, MarketImpact, Sentiment } from "./types";

export interface NormalizedNewsArticle {
  id: string;
  headline: string;
  source: string;
  author?: string;
  publishedAt: string;
  imageUrl?: string;
  originalUrl: string;
  excerpt: string;
  relatedTickerOrTopic: string;
  articleType: "company" | "market" | "macro" | "etf" | "sector";
  sentiment: Sentiment;
  marketImpact: MarketImpact;
  confidence: number;
  thirtySecondVersion: string;
  finbriefSummary: string;
  whatHappened: string;
  whyItMatters: string;
  whoIsAffected: string[];
  keyTerms: { term: string; definition: string }[];
  bullCase: string;
  bearCase: string;
  neutralView: string;
  risks: string[];
  thingsToWatch: string[];
  relatedAssets: string[];
  recommendedNext: string[];
}

function inferTopic(query: string, headline: string): string {
  const normalized = query.trim();
  if (normalized) return normalized.toUpperCase() === normalized ? normalized : normalized;
  const words = headline.split(" ").filter(Boolean);
  return words.slice(0, 2).join(" ");
}

function fallbackImageForType(type: NormalizedNewsArticle["articleType"]): string {
  if (type === "company") return ARTICLE_IMAGES.aapl.url;
  if (type === "macro") return ARTICLE_IMAGES.fed.url;
  if (type === "etf") return ARTICLE_IMAGES.aiChips.url;
  if (type === "sector") return ARTICLE_IMAGES.techSector.url;
  return ARTICLE_IMAGES.market.url;
}

function mapArticleType(type: NormalizedNewsArticle["articleType"]): Brief["articleType"] {
  if (type === "macro") return "macro news";
  if (type === "etf") return "ETF/index news";
  if (type === "sector") return "sector news";
  if (type === "market") return "market news";
  return "company news";
}

function dataSnapshotFor(type: NormalizedNewsArticle["articleType"], symbol: string): Brief["dataSnapshot"] {
  if (type === "macro") {
    return {
      kind: "macro",
      relatedIndicators: ["CPI", "PCE", "Jobs", "Treasury yields"],
      affectedSectors: ["Financials", "Real Estate", "Technology"],
      affectedIndexes: ["SPY", "QQQ", "DIA", "VTI"],
      marketSensitivity: "high",
    };
  }

  if (type === "etf" || type === "market") {
    return {
      kind: "etf",
      tracks: symbol || "Broad market basket",
      topHoldings: ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL"],
      expenseRatio: "0.10%",
      dailyChange: "N/A",
      dailyChangePercent: 0,
      relatedSectors: ["Technology", "Financials", "Industrials"],
      macroFactors: ["Rates", "Inflation", "Earnings"],
    };
  }

  return {
    kind: "stock",
    price: "N/A",
    dailyChange: "N/A",
    dailyChangePercent: 0,
    marketCap: "N/A",
    peRatio: "N/A",
    volume: "N/A",
    sector: type === "sector" ? symbol || "Sector" : "Company",
    earningsDate: "See source for latest filing dates",
  };
}

function recommendedFor(topic: string): string[] {
  const slug = toTopicSlug(topic);
  return [topic, "SPY", "QQQ", "Inflation", "Interest Rates", slug].slice(0, 6);
}

export function normalizeProviderArticles(input: {
  query: string;
  providerArticles: ProviderArticle[];
}): NormalizedNewsArticle[] {
  return input.providerArticles.map((article) => {
    const analysisText = `${article.headline} ${article.excerpt} ${article.content ?? ""}`;
    const type = inferArticleType(analysisText);
    const topic = inferTopic(input.query, article.headline);
    const { sentiment, confidence } = estimateSentiment(analysisText);
    const marketImpact = estimateMarketImpact(analysisText);
    const keyTerms = extractKeyTerms(analysisText);

    return {
      id: article.id,
      headline: article.headline,
      source: article.source,
      author: article.author,
      publishedAt: article.publishedAt,
      imageUrl: article.imageUrl,
      originalUrl: article.originalUrl,
      excerpt: article.excerpt,
      relatedTickerOrTopic: topic,
      articleType: type,
      sentiment,
      marketImpact,
      confidence,
      thirtySecondVersion: buildThirtySecondVersion(article.headline, article.excerpt),
      finbriefSummary: buildLongSummary(article.headline, article.excerpt, input.query),
      whatHappened: article.excerpt,
      whyItMatters: `This story may influence expectations around ${topic}, especially for related equities, ETFs, and macro-sensitive assets.`,
      whoIsAffected: [`Investors tracking ${topic}`, "Related sector ETFs", "Macro-sensitive portfolios"],
      keyTerms,
      bullCase: `If follow-up data supports this headline, sentiment around ${topic} could improve.`,
      bearCase: `If later updates weaken the narrative, risk appetite around ${topic} may fade.`,
      neutralView: "The signal is useful, but confirmation from additional reporting and data is still needed.",
      risks: [
        "Headline-driven moves can reverse quickly",
        "Provider descriptions may omit key context",
        "Follow-up reports may change the interpretation",
      ],
      thingsToWatch: [
        "Next management or policy update",
        "Revisions from major sources",
        "Price reaction in related assets",
      ],
      relatedAssets: [topic, "SPY", "QQQ"].filter(Boolean),
      recommendedNext: recommendedFor(topic),
    };
  });
}

export function normalizedToBrief(article: NormalizedNewsArticle): Brief {
  return {
    id: article.id,
    headline: article.headline,
    source: article.source,
    author: article.author,
    publishedAt: article.publishedAt,
    imageUrl: article.imageUrl ?? fallbackImageForType(article.articleType),
    imageAlt: `${article.relatedTickerOrTopic} market-related article image`,
    originalUrl: article.originalUrl,
    excerpt: article.excerpt,
    summary: article.finbriefSummary,
    thirtySecondVersion: article.thirtySecondVersion,
    whatHappened: article.whatHappened,
    whyItMatters: article.whyItMatters,
    whoIsAffected: article.whoIsAffected.join(", "),
    ticker: article.relatedTickerOrTopic.toUpperCase() === article.relatedTickerOrTopic
      ? article.relatedTickerOrTopic
      : "—",
    topic: article.relatedTickerOrTopic,
    sentiment: article.sentiment,
    sentimentConfidence: article.confidence,
    marketImpact: article.marketImpact,
    articleType: mapArticleType(article.articleType),
    keyAffectedAssets: article.relatedAssets,
    relatedAssets: article.relatedAssets.map((symbol) => ({
      symbol,
      name: symbol,
      type: "stock",
    })),
    keyTerms: article.keyTerms,
    bullCase: article.bullCase,
    bearCase: article.bearCase,
    neutralView: article.neutralView,
    risks: article.risks,
    thingsToWatch: article.thingsToWatch,
    dataSnapshot: dataSnapshotFor(article.articleType, article.relatedTickerOrTopic),
    recommendedNext: article.recommendedNext.map((label) => ({
      label,
      href: `/topic/${toTopicSlug(label)}`,
      kind: "topic",
    })),
    sourceLinks: [{ name: article.source, url: article.originalUrl }],
  };
}

export function providerArticlesToBriefs(params: {
  query: string;
  providerArticles: ProviderArticle[];
}): { normalized: NormalizedNewsArticle[]; briefs: Brief[] } {
  const normalized = normalizeProviderArticles(params);
  return {
    normalized,
    briefs: normalized.map(normalizedToBrief),
  };
}

export function buildCardPreview(article: NormalizedNewsArticle): string {
  return buildEducationalSummary(article.headline, article.excerpt, article.relatedTickerOrTopic);
}
