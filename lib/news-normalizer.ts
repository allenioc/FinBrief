import {
  buildBullCase,
  buildBearCase,
  buildFinBriefSummary,
  buildNeutralView,
  buildThirtySecondVersion,
  buildWhyItMatters,
  buildWhoIsAffected,
  enrichArticleCopy,
  estimateMarketImpact,
  estimateSentiment,
  extractKeyTerms,
  inferArticleType,
  inferDisplayTopic,
} from "./article-analysis";
import { enrichBriefImage, computeFallbackImageId } from "./article-image";
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
  fallbackImageId?: string;
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

function inferTopic(query: string, headline: string, articleType: NormalizedNewsArticle["articleType"]): string {
  return inferDisplayTopic(query, headline, articleType);
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
    const topic = inferTopic(input.query, article.headline, type);
    const { sentiment, confidence } = estimateSentiment(analysisText);
    const marketImpact = estimateMarketImpact(analysisText);
    const keyTerms = extractKeyTerms(analysisText);
    const excerpt = article.excerpt?.trim() || "No summary available from provider.";
    const mappedArticleType = mapArticleType(type);

    return {
      id: article.id,
      headline: article.headline,
      source: article.source,
      author: article.author,
      publishedAt: article.publishedAt,
      imageUrl: article.imageUrl,
      fallbackImageId: computeFallbackImageId({
        id: article.id,
        originalUrl: article.originalUrl,
        source: article.source,
        articleType: mappedArticleType,
      }),
      originalUrl: article.originalUrl,
      excerpt,
      relatedTickerOrTopic: topic,
      articleType: type,
      sentiment,
      marketImpact,
      confidence,
      thirtySecondVersion: buildThirtySecondVersion(
        article.headline,
        excerpt,
        article.source,
        article.publishedAt
      ),
      finbriefSummary: buildFinBriefSummary(
        article.headline,
        excerpt,
        article.source,
        article.publishedAt
      ),
      whatHappened: excerpt,
      whyItMatters: buildWhyItMatters(
        article.headline,
        excerpt,
        type,
        article.source,
        article.publishedAt
      ),
      whoIsAffected: [
        buildWhoIsAffected(article.headline, excerpt, type, article.source, article.publishedAt),
      ],
      keyTerms,
      bullCase: buildBullCase(article.headline, excerpt, sentiment),
      bearCase: buildBearCase(article.headline, excerpt, sentiment),
      neutralView: buildNeutralView(),
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
  return enrichArticleCopy(
    enrichBriefImage({
    id: article.id,
    headline: article.headline,
    source: article.source,
    author: article.author,
    publishedAt: article.publishedAt,
    imageUrl: article.imageUrl ?? "",
    fallbackImageId:
      article.fallbackImageId ??
      computeFallbackImageId({
        id: article.id,
        originalUrl: article.originalUrl,
        source: article.source,
        articleType: mapArticleType(article.articleType),
      }),
    imageAlt: article.headline
      ? `${article.headline} thumbnail`
      : `${article.relatedTickerOrTopic} market-related article image`,
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
    })
  );
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
  return buildFinBriefSummary(article.headline, article.excerpt);
}
