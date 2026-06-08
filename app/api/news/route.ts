import { NextRequest, NextResponse } from "next/server";
import { MOCK_BRIEFS } from "@/lib/articles-data";
import { fetchProviderNews } from "@/lib/news-providers";
import { providerArticlesToBriefs } from "@/lib/news-normalizer";
import { searchBriefs } from "@/lib/briefs";

type CachedPayload = {
  query: string;
  provider: string;
  providerStats: Array<{ provider: string; count: number }>;
  fetchedAt: string;
  articleCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
  totalAvailable: number;
  errorMessage?: string;
  articles: ReturnType<typeof providerArticlesToBriefs>["normalized"];
  normalized: ReturnType<typeof providerArticlesToBriefs>["normalized"];
  briefs: ReturnType<typeof providerArticlesToBriefs>["briefs"];
};

function localDateKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function publishedTime(iso?: string): number {
  if (!iso) return 0;
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
}

const cache = new Map<string, { expiresAt: number; payload: CachedPayload }>();

function msUntilNextLocalMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

function toMockPayload(query: string, page: number, limit: number): CachedPayload {
  const fallback = query.trim() ? searchBriefs(query) : MOCK_BRIEFS;
  const start = (Math.max(1, page) - 1) * limit;
  const pageItems = fallback.slice(start, start + limit);
  return {
    query,
    provider: "mock",
    providerStats: [{ provider: "mock", count: pageItems.length }],
    fetchedAt: new Date().toISOString(),
    articleCount: pageItems.length,
    page,
    limit,
    hasMore: start + limit < fallback.length,
    totalAvailable: fallback.length,
    articles: pageItems.map((brief) => ({
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
    normalized: pageItems.map((brief) => ({
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
    briefs: pageItems,
    errorMessage: "Live provider unavailable. Showing mock fallback.",
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(50, Math.max(8, Number(request.nextUrl.searchParams.get("limit") ?? "20")));
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1"));
  const fresh = request.nextUrl.searchParams.get("fresh");
  const bust = fresh === "true" || fresh === "1" || Boolean(request.nextUrl.searchParams.get("bust"));
  const edition = request.nextUrl.searchParams.get("edition")?.trim() || `business-news-feed-${localDateKey()}`;
  const queryKey = query || "broad-business-finance";
  const key = `${queryKey.toLowerCase()}::${edition.toLowerCase()}::${limit}::${page}`;

  const cached = bust ? null : cache.get(key);
  if (!bust && cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload);
  }

  const providerResponse = await fetchProviderNews(query, limit, page);
  const payload = providerResponse
    ? (() => {
        const mapped = providerArticlesToBriefs({
          query,
          providerArticles: providerResponse.articles,
        });
        const sortedBriefs = [...mapped.briefs].sort(
          (a, b) => publishedTime(b.publishedAt) - publishedTime(a.publishedAt)
        );
        const sortedArticles = [...mapped.normalized].sort(
          (a, b) => publishedTime(b.publishedAt) - publishedTime(a.publishedAt)
        );
        return {
          query,
          provider: providerResponse.provider,
          providerStats: providerResponse.providerStats,
          fetchedAt: providerResponse.fetchedAt,
          articleCount: sortedBriefs.length,
          page,
          limit,
          hasMore: page * limit < providerResponse.totalAvailable,
          totalAvailable: providerResponse.totalAvailable,
          articles: sortedArticles,
          normalized: sortedArticles,
          briefs: sortedBriefs,
        } satisfies CachedPayload;
      })()
    : toMockPayload(query, page, limit);

  if (!bust) {
    cache.set(key, {
      expiresAt: Date.now() + msUntilNextLocalMidnight(),
      payload,
    });
  }

  return NextResponse.json(payload);
}
