import { NextRequest, NextResponse } from "next/server";
import { MOCK_BRIEFS } from "@/lib/articles-data";
import { fetchProviderNews } from "@/lib/news-providers";
import { providerArticlesToBriefs } from "@/lib/news-normalizer";
import { searchBriefs } from "@/lib/briefs";

type CachedPayload = {
  query: string;
  provider: string;
  lastUpdatedAt: string;
  normalized: ReturnType<typeof providerArticlesToBriefs>["normalized"];
  briefs: ReturnType<typeof providerArticlesToBriefs>["briefs"];
};

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; payload: CachedPayload }>();

function toMockPayload(query: string): CachedPayload {
  const fallback = query.trim() ? searchBriefs(query) : MOCK_BRIEFS;
  return {
    query,
    provider: "mock",
    lastUpdatedAt: new Date().toISOString(),
    normalized: fallback.map((brief) => ({
      id: brief.id,
      headline: brief.headline,
      source: brief.source,
      author: brief.author,
      publishedAt: brief.publishedAt,
      imageUrl: brief.imageUrl,
      originalUrl: brief.originalUrl,
      excerpt: brief.excerpt,
      relatedTickerOrTopic: brief.ticker !== "—" ? brief.ticker : brief.topic,
      articleType:
        brief.articleType === "macro news"
          ? "macro"
          : brief.articleType === "ETF/index news"
            ? "etf"
            : brief.articleType === "sector news"
              ? "sector"
              : brief.articleType === "market news"
                ? "market"
                : "company",
      sentiment: brief.sentiment,
      marketImpact: brief.marketImpact,
      confidence: brief.sentimentConfidence,
      thirtySecondVersion: brief.thirtySecondVersion,
      finbriefSummary: brief.summary,
      whatHappened: brief.whatHappened,
      whyItMatters: brief.whyItMatters,
      whoIsAffected: brief.whoIsAffected.split(",").map((entry) => entry.trim()),
      keyTerms: brief.keyTerms,
      bullCase: brief.bullCase,
      bearCase: brief.bearCase,
      neutralView: brief.neutralView,
      risks: brief.risks,
      thingsToWatch: brief.thingsToWatch,
      relatedAssets: brief.keyAffectedAssets,
      recommendedNext: brief.recommendedNext.map((item) => item.label),
    })),
    briefs: fallback,
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(30, Math.max(8, Number(request.nextUrl.searchParams.get("limit") ?? "18")));
  const key = `${query.toLowerCase()}::${limit}`;

  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload);
  }

  const providerResponse = await fetchProviderNews(query, limit);
  const payload =
    providerResponse && providerResponse.articles.length > 0
      ? (() => {
          const mapped = providerArticlesToBriefs({
            query,
            providerArticles: providerResponse.articles.slice(0, limit),
          });
          return {
            query,
            provider: providerResponse.provider,
            lastUpdatedAt: providerResponse.fetchedAt,
            normalized: mapped.normalized,
            briefs: mapped.briefs,
          } satisfies CachedPayload;
        })()
      : toMockPayload(query);

  cache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload,
  });

  return NextResponse.json(payload);
}
