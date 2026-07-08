import { NextRequest, NextResponse } from "next/server";
import { MOCK_BRIEFS } from "@/lib/articles-data";
import {
  fetchProviderNews,
  getProviderDebugStatuses,
  type ProviderTimeRange,
} from "@/lib/news-providers";
import { providerArticlesToBriefs } from "@/lib/news-normalizer";
import { BROAD_NEWS_QUERY, DAILY_EDITION_ARTICLE_LIMIT, DAILY_EDITION_REPLACEMENT_MIN, FAILURE_RETRY_COOLDOWN_MS, SUCCESS_FETCH_COOLDOWN_MS } from "@/lib/news-constants";
import { searchBriefs } from "@/lib/briefs";
import { enrichBrief } from "@/lib/article-analysis";
import { countArticlesWithImageUrl } from "@/lib/article-image";
import { filterBriefsForTopic } from "@/lib/topic-stories";
import {
  dateKeyFromFetchedAt,
  editionStoryCount,
  isEditionFetchedOnDate,
  isFreshSavedEditionForToday,
  isLiveEditionPayload,
  isWithinSuccessFetchCooldown,
  msSinceFetchedAt,
  shouldPersistLiveEditionFetch,
  shouldPersistNewDayEditionFetch,
} from "@/lib/daily-edition";
import { cacheGet, cacheSet, cacheBackendDescription, hasDurableCache } from "@/lib/news-cache";
import { saveDailyEditionForWeek, syncLiveEditionToWeekArchive, resolveWeeklyEditionDate } from "@/lib/weekly-archive-store";
import { mirrorRollingBroadEditionToWeek } from "@/lib/weekly-edition-sync";
import type { Brief } from "@/lib/types";

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

function normalizeTimeRange(input: string | null): ProviderTimeRange {
  if (input === "breaking" || input === "today" || input === "week") return input;
  return "week";
}

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

function inTimeRange(iso: string | undefined, range: ProviderTimeRange): boolean {
  if (range === "breaking") return true;
  const value = publishedTime(iso);
  if (!value) return true;
  const ageMs = Date.now() - value;
  if (ageMs < 0) return true;
  if (range === "today") return ageMs <= 24 * 60 * 60 * 1000;
  return ageMs <= 7 * 24 * 60 * 60 * 1000;
}

type EditionRecord = {
  editionDate: string;
  savedAt: string;
  payload: CachedPayload;
};

type LastGoodRecord = {
  fetchedAt: string;
  payload: CachedPayload;
};

type FetchCooldownRecord = {
  retryAt: number;
  lastSuccessfulFetchedAt?: string;
};

type CacheDebugFields = {
  cacheStatus: string;
  cacheBackend: string;
  editionDate: string;
  lastSuccessfulFetchedAt: string | null;
  reasonProviderFetchWasSkipped: string | null;
  reasonProviderFetchWasAllowed: string | null;
  savedEditionArticleCount: number;
  articlesWithImageUrl: number;
};

/**
 * After a failed live fetch, wait before retrying so repeated page loads
 * (or redeploys) cannot hammer rate-limited providers.
 */
const failureCooldownByScope = new Map<string, number>();

function fetchCooldownCacheKey(scopeKey: string): string {
  return `fetch-cooldown::${scopeKey}`;
}

async function readFetchCooldown(scopeKey: string): Promise<FetchCooldownRecord | null> {
  const cached = await cacheGet<FetchCooldownRecord>(fetchCooldownCacheKey(scopeKey));
  return cached?.value ?? null;
}

async function writeFetchCooldown(scopeKey: string, record: FetchCooldownRecord): Promise<void> {
  if (record.retryAt > Date.now()) {
    failureCooldownByScope.set(scopeKey, record.retryAt);
  } else {
    failureCooldownByScope.delete(scopeKey);
  }
  await cacheSet(fetchCooldownCacheKey(scopeKey), record);
}

async function resolveLastSuccessfulFetchedAt(
  scopeKey: string,
  today: string,
  savedEdition: { value: EditionRecord } | null | undefined,
  lastGood: { value: LastGoodRecord } | null | undefined
): Promise<string | null> {
  const cooldown = await readFetchCooldown(scopeKey);
  if (cooldown?.lastSuccessfulFetchedAt) return cooldown.lastSuccessfulFetchedAt;
  if (
    savedEdition &&
    savedEdition.value.editionDate === today &&
    savedEdition.value.payload.fetchedAt &&
    isEditionFetchedOnDate(savedEdition.value.payload.fetchedAt, today)
  ) {
    return savedEdition.value.payload.fetchedAt;
  }
  return lastGood?.value.fetchedAt ?? savedEdition?.value.payload.fetchedAt ?? null;
}

function resolveExistingEditionStoryCount(
  savedEdition: { value: EditionRecord } | null | undefined,
  lastGood: { value: LastGoodRecord } | null | undefined
): number {
  const counts = [
    savedEdition?.value.payload ? editionStoryCount(savedEdition.value.payload) : 0,
    lastGood?.value.payload ? editionStoryCount(lastGood.value.payload) : 0,
  ];
  return Math.max(...counts, 0);
}

function resolveBestSavedEdition(
  today: string,
  savedEdition: { tier: string; value: EditionRecord } | null | undefined,
  lastGood: { tier: string; value: LastGoodRecord } | null | undefined
): { payload: CachedPayload; cacheStatus: string; fetchedAt: string } | null {
  const candidates: Array<{ payload: CachedPayload; cacheStatus: string; fetchedAt: string }> = [];

  if (
    savedEdition &&
    isFreshSavedEditionForToday({
      editionDate: savedEdition.value.editionDate,
      fetchedAt: savedEdition.value.payload.fetchedAt,
      today,
    }) &&
    isLiveEditionPayload(savedEdition.value.payload)
  ) {
    candidates.push({
      payload: savedEdition.value.payload,
      cacheStatus: `hit:${savedEdition.tier}`,
      fetchedAt: savedEdition.value.payload.fetchedAt,
    });
  }
  if (lastGood && isLiveEditionPayload(lastGood.value.payload)) {
    candidates.push({
      payload: lastGood.value.payload,
      cacheStatus: `lastgood:${lastGood.tier}`,
      fetchedAt: lastGood.value.fetchedAt,
    });
  }
  if (savedEdition && isLiveEditionPayload(savedEdition.value.payload)) {
    candidates.push({
      payload: savedEdition.value.payload,
      cacheStatus: `stale_edition:${savedEdition.tier}`,
      fetchedAt: savedEdition.value.payload.fetchedAt,
    });
  }

  if (candidates.length === 0) return null;

  return candidates.reduce((best, candidate) => {
    const bestCount = editionStoryCount(best.payload);
    const candidateCount = editionStoryCount(candidate.payload);
    if (candidateCount > bestCount) return candidate;
    if (candidateCount < bestCount) return best;
    if (candidate.cacheStatus.startsWith("hit:")) return candidate;
    return best;
  });
}

async function serveSavedEditionResponse(
  today: string,
  best: { payload: CachedPayload; cacheStatus: string; fetchedAt: string },
  reasonProviderFetchWasSkipped: string,
  savedEditionDate?: string
) {
  const editionDate = resolveWeeklyEditionDate(savedEditionDate, best.fetchedAt, today);
  if (isLiveEditionPayload(best.payload)) {
    await syncLiveEditionToWeekArchive(editionDate, best.payload.briefs);
  }
  return NextResponse.json(
    withDebugFields(best.payload, {
      cacheStatus: best.cacheStatus,
      editionDate: today,
      lastSuccessfulFetchedAt: best.fetchedAt,
      reasonProviderFetchWasSkipped,
      reasonProviderFetchWasAllowed: null,
    })
  );
}

async function restoreTodaysEditionIfMissing(
  today: string,
  editionKey: string,
  best: { payload: CachedPayload; fetchedAt: string }
): Promise<void> {
  if (!isFreshSavedEditionForToday({ editionDate: today, fetchedAt: best.fetchedAt, today })) {
    return;
  }
  await cacheSet(editionKey, {
    editionDate: today,
    savedAt: new Date().toISOString(),
    payload: enrichPayloadBriefs(best.payload),
  } satisfies EditionRecord);
}

function adminSecret(): string {
  return process.env.ADMIN_REFRESH_TOKEN ?? process.env.CRON_SECRET ?? "";
}

function isAdminRequest(request: NextRequest): { authorized: boolean; note?: string } {
  const secret = adminSecret();
  if (!secret) {
    return {
      authorized: true,
      note: "No ADMIN_REFRESH_TOKEN or CRON_SECRET configured; refresh/debug are open. Set one to lock them down.",
    };
  }
  const provided =
    request.nextUrl.searchParams.get("key") ??
    request.headers.get("x-admin-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return { authorized: provided === secret };
}

function enrichPayloadBriefs(payload: CachedPayload): CachedPayload {
  const briefs = payload.briefs.map(enrichBrief);
  const syncFromBrief = <
    T extends {
      imageUrl?: string;
      fallbackImageId?: string;
      imageDisplay?: "provider" | "fallback";
      finbriefSummary?: string;
      thirtySecondVersion?: string;
      whatHappened?: string;
      whyItMatters?: string;
      whoIsAffected?: string[];
      sentiment?: Brief["sentiment"];
      marketImpact?: Brief["marketImpact"];
      confidence?: number;
    },
  >(
    article: T,
    brief: (typeof briefs)[number]
  ): T => ({
    ...article,
    imageUrl: brief.imageUrl,
    fallbackImageId: brief.fallbackImageId,
    imageDisplay: brief.imageDisplay,
    finbriefSummary: brief.summary,
    thirtySecondVersion: brief.thirtySecondVersion,
    whatHappened: brief.whatHappened,
    whyItMatters: brief.whyItMatters,
    whoIsAffected: brief.whoIsAffected.split(",").map((entry) => entry.trim()),
    sentiment: brief.sentiment,
    marketImpact: brief.marketImpact,
    confidence: brief.sentimentConfidence,
  });

  return {
    ...payload,
    briefs,
    articles: payload.articles.map((article, index) => {
      const brief = briefs[index];
      if (!brief) return article;
      return syncFromBrief(article, brief);
    }),
    normalized: payload.normalized.map((article, index) => {
      const brief = briefs[index];
      if (!brief) return article;
      return syncFromBrief(article, brief);
    }),
    articleCount: briefs.length,
  };
}

function withDebugFields(payload: CachedPayload, fields: Omit<CacheDebugFields, "cacheBackend" | "savedEditionArticleCount" | "articlesWithImageUrl">) {
  const enriched = enrichPayloadBriefs(payload);
  return {
    ...enriched,
    ...fields,
    cacheBackend: cacheBackendDescription(),
    savedEditionArticleCount: enriched.briefs.length,
    articlesWithImageUrl: countArticlesWithImageUrl(enriched.briefs),
  };
}

async function loadBroadSavedEdition(
  today: string,
  timeRange: ProviderTimeRange,
  fetchLimit: number
): Promise<{ payload: CachedPayload; fetchedAt: string } | null> {
  const broadKey = BROAD_NEWS_QUERY;
  const editionKey = `edition::${broadKey}::${timeRange}::${fetchLimit}::1`;
  const lastGoodKey = `lastgood::${broadKey}::${timeRange}`;
  const savedEdition = await cacheGet<EditionRecord>(editionKey);
  if (
    savedEdition &&
    isFreshSavedEditionForToday({
      editionDate: savedEdition.value.editionDate,
      fetchedAt: savedEdition.value.payload.fetchedAt,
      today,
    }) &&
    isLiveEditionPayload(savedEdition.value.payload)
  ) {
    return {
      payload: savedEdition.value.payload,
      fetchedAt: savedEdition.value.payload.fetchedAt,
    };
  }
  const lastGood = await cacheGet<LastGoodRecord>(lastGoodKey);
  if (lastGood && isLiveEditionPayload(lastGood.value.payload)) {
    return { payload: lastGood.value.payload, fetchedAt: lastGood.value.fetchedAt };
  }
  if (savedEdition && isLiveEditionPayload(savedEdition.value.payload)) {
    return {
      payload: savedEdition.value.payload,
      fetchedAt: savedEdition.value.payload.fetchedAt,
    };
  }
  return null;
}

function topicFilteredPayload(base: CachedPayload, topicQuery: string): CachedPayload {
  const filtered = filterBriefsForTopic(base.briefs, topicQuery);
  return {
    ...base,
    query: topicQuery,
    briefs: filtered,
    articles: [],
    normalized: [],
    articleCount: filtered.length,
    hasMore: false,
    totalAvailable: filtered.length,
  };
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
      fallbackImageId: brief.fallbackImageId,
      imageDisplay: brief.imageDisplay,
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
      fallbackImageId: brief.fallbackImageId,
      imageDisplay: brief.imageDisplay,
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
  const debug = request.nextUrl.searchParams.get("debug") === "true";
  const fresh = request.nextUrl.searchParams.get("fresh");
  const timeRange = normalizeTimeRange(request.nextUrl.searchParams.get("timeRange"));
  const providerParam = request.nextUrl.searchParams.get("provider")?.toLowerCase();
  const providerFilter =
    providerParam === "newsapi" ||
    providerParam === "gnews" ||
    providerParam === "thenewsapi" ||
    providerParam === "finnhub" ||
    providerParam === "polygon" ||
    providerParam === "alphavantage"
      ? providerParam
      : undefined;
  // Article lookup for /brief/[id]. Served entirely from saved data — this
  // path never calls live providers.
  const articleId = request.nextUrl.searchParams.get("articleId")?.trim();
  if (articleId) {
    const indexed = await cacheGet<Brief>(`article::${articleId}`);
    if (indexed) {
      return NextResponse.json({
        found: true,
        source: `index:${indexed.tier}`,
        article: enrichBrief(indexed.value),
      });
    }
    const broadScope = "broad-business-finance";
    for (const pageNum of [1, 2, 3]) {
      const record = await cacheGet<EditionRecord>(`edition::${broadScope}::week::20::${pageNum}`);
      const match = record?.value.payload.briefs.find((brief) => brief.id === articleId);
      if (match && record) {
        return NextResponse.json({
          found: true,
          source: `edition:${record.tier}`,
          article: enrichBrief(match),
        });
      }
    }
    const lastGood = await cacheGet<LastGoodRecord>(`lastgood::${broadScope}::week`);
    const staleMatch = lastGood?.value.payload.briefs.find((brief) => brief.id === articleId);
    if (staleMatch && lastGood) {
      return NextResponse.json({
        found: true,
        source: `lastgood:${lastGood.tier}`,
        article: enrichBrief(staleMatch),
      });
    }
    return NextResponse.json({ found: false }, { status: 404 });
  }

  const admin = isAdminRequest(request);
  const today = localDateKey();
  const queryKey = (query || "broad-business-finance").toLowerCase();
  const isBroadDashboardEdition =
    page === 1 && (queryKey === "broad-business-finance" || queryKey === BROAD_NEWS_QUERY);
  const fetchLimit = isBroadDashboardEdition ? Math.max(limit, DAILY_EDITION_ARTICLE_LIMIT) : limit;
  const editionKey = `edition::${queryKey}::${timeRange}::${fetchLimit}::${page}`;
  const lastGoodKey = `lastgood::${queryKey}::${timeRange}`;
  const scopeKey = `${queryKey}::${timeRange}`;

  if (debug) {
    // Debug mode triggers a live provider fetch, so it is admin-only when a
    // secret is configured. It is never linked from the normal UI.
    if (!admin.authorized) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized. Pass ?key=... or x-admin-key header." },
        { status: 401 }
      );
    }
    const providerRun = await fetchProviderNews(query, limit, page, timeRange, {
      providerFilter,
    });
    const statuses =
      providerRun?.providerRunStatuses ??
      (providerFilter
        ? [
            {
              provider: providerFilter,
              configured: false,
              attempted: false,
              status: "not_configured",
              articleCount: 0,
              cooldownRemainingMs: 0,
            },
          ]
        : []);
    const lastGood = await cacheGet<LastGoodRecord>(lastGoodKey);
    const savedEdition = await cacheGet<EditionRecord>(editionKey);
    return NextResponse.json({
      providers: getProviderDebugStatuses(),
      configured: {
        newsapi: Boolean(process.env.NEWS_API_KEY),
        gnews: Boolean(process.env.GNEWS_API_KEY),
        thenewsapi: Boolean(process.env.THENEWSAPI_KEY),
      },
      providerFilter: providerFilter ?? "all",
      query,
      timeRange,
      providerStatuses: statuses,
      providerCounts: providerRun?.providerStats ?? [],
      providerErrorMessage: providerRun?.errorMessage,
      mergedArticleCount: providerRun?.articles?.length ?? 0,
      finalProvider: providerRun?.provider ?? "none",
      cacheBackend: cacheBackendDescription(),
      durableCacheConfigured: hasDurableCache(),
      editionDate: today,
      savedEditionDate: savedEdition?.value.editionDate ?? null,
      savedEditionTier: savedEdition?.tier ?? null,
      lastSuccessfulFetchedAt: lastGood?.value.fetchedAt ?? null,
      adminNote: admin.note,
    });
  }

  const freshRequested =
    fresh === "true" || fresh === "1" || Boolean(request.nextUrl.searchParams.get("bust"));
  const adminRefresh = freshRequested && admin.authorized;
  const freshIgnoredNote =
    freshRequested && !admin.authorized ? "fresh_param_ignored_unauthorized" : null;

  let reasonAllowed: string | null = null;

  if (!adminRefresh) {
    const savedEdition = await cacheGet<EditionRecord>(editionKey);
    if (isBroadDashboardEdition) {
      await mirrorRollingBroadEditionToWeek();
    }
    const lastGood = await cacheGet<LastGoodRecord>(lastGoodKey);
    const cooldownRecord = await readFetchCooldown(scopeKey);
    const retryAt = Math.max(failureCooldownByScope.get(scopeKey) ?? 0, cooldownRecord?.retryAt ?? 0);
    const lastSuccessfulFetchedAt = await resolveLastSuccessfulFetchedAt(
      scopeKey,
      today,
      savedEdition,
      lastGood
    );
    const bestSaved = resolveBestSavedEdition(today, savedEdition, lastGood);

    // 1) Saved live edition for today: serve without providers only when fetched today.
    if (
      savedEdition &&
      isFreshSavedEditionForToday({
        editionDate: savedEdition.value.editionDate,
        fetchedAt: savedEdition.value.payload.fetchedAt,
        today,
      }) &&
      bestSaved &&
      isLiveEditionPayload(bestSaved.payload)
    ) {
      if (
        editionStoryCount(savedEdition.value.payload) < editionStoryCount(bestSaved.payload) &&
        editionStoryCount(bestSaved.payload) >= DAILY_EDITION_REPLACEMENT_MIN &&
        isFreshSavedEditionForToday({
          editionDate: today,
          fetchedAt: bestSaved.fetchedAt,
          today,
        })
      ) {
        await restoreTodaysEditionIfMissing(today, editionKey, bestSaved);
      }
      return serveSavedEditionResponse(
        today,
        bestSaved,
        "saved_edition_for_today_exists",
        savedEdition.value.editionDate
      );
    }

    reasonAllowed = !savedEdition
      ? "no_saved_edition"
      : savedEdition.value.editionDate !== today
        ? "edition_date_changed_and_today_not_fetched_yet"
        : !isFreshSavedEditionForToday({
              editionDate: savedEdition.value.editionDate,
              fetchedAt: savedEdition.value.payload.fetchedAt,
              today,
            })
          ? "saved_edition_stale_needs_today_fetch"
          : !isLiveEditionPayload(savedEdition.value.payload)
            ? "saved_edition_not_live_retry_allowed"
            : "saved_edition_has_zero_stories";

    // 2) Recent provider failure: serve the newest saved data instead of retrying.
    if (retryAt > Date.now() && bestSaved) {
      const reasonSkipped = `recent_provider_failure_retry_in_${Math.ceil((retryAt - Date.now()) / 1000)}s`;
      if (isLiveEditionPayload(bestSaved.payload)) {
        const editionDate = resolveWeeklyEditionDate(
          savedEdition?.value.editionDate,
          bestSaved.fetchedAt,
          today
        );
        await syncLiveEditionToWeekArchive(editionDate, bestSaved.payload.briefs);
      }
      return NextResponse.json(
        withDebugFields(
          {
            ...bestSaved.payload,
            errorMessage:
              "Live providers are temporarily unavailable. Showing the most recent saved edition.",
          },
          {
            cacheStatus: bestSaved.cacheStatus.startsWith("hit:")
              ? bestSaved.cacheStatus
              : `stale_fallback:${bestSaved.cacheStatus}`,
            editionDate: today,
            lastSuccessfulFetchedAt: bestSaved.fetchedAt,
            reasonProviderFetchWasSkipped: reasonSkipped,
            reasonProviderFetchWasAllowed: null,
          }
        )
      );
    }

    if (retryAt > Date.now()) {
      return NextResponse.json(
        withDebugFields(toMockPayload(query, page, limit), {
          cacheStatus: "mock_fallback",
          editionDate: today,
          lastSuccessfulFetchedAt: lastSuccessfulFetchedAt,
          reasonProviderFetchWasSkipped: `recent_provider_failure_retry_in_${Math.ceil((retryAt - Date.now()) / 1000)}s`,
          reasonProviderFetchWasAllowed: null,
        })
      );
    }

    // 3) Success cooldown: keep today's saved edition without calling providers again.
    if (
      isBroadDashboardEdition &&
      bestSaved &&
      isWithinSuccessFetchCooldown(lastSuccessfulFetchedAt, today)
    ) {
      if (
        !savedEdition &&
        dateKeyFromFetchedAt(bestSaved.fetchedAt) === today
      ) {
        await restoreTodaysEditionIfMissing(today, editionKey, bestSaved);
      }
      const remainingSeconds = Math.ceil(
        (SUCCESS_FETCH_COOLDOWN_MS - msSinceFetchedAt(lastSuccessfulFetchedAt)) / 1000
      );
      return serveSavedEditionResponse(
        today,
        bestSaved,
        `success_fetch_cooldown_${remainingSeconds}s_remaining`,
        savedEdition?.value.editionDate
      );
    }
  } else {
    reasonAllowed = "authorized_admin_refresh";
  }

  // Topic views filter the saved broad daily edition only — never call live providers.
  if (!adminRefresh && query.trim() && !isBroadDashboardEdition) {
    const broadSaved = await loadBroadSavedEdition(today, timeRange, DAILY_EDITION_ARTICLE_LIMIT);
    if (broadSaved) {
      return NextResponse.json(
        withDebugFields(topicFilteredPayload(broadSaved.payload, query), {
          cacheStatus: "topic_filter:broad_edition",
          editionDate: today,
          lastSuccessfulFetchedAt: broadSaved.fetchedAt,
          reasonProviderFetchWasSkipped: "topic_filter_from_saved_broad_edition",
          reasonProviderFetchWasAllowed: null,
        })
      );
    }
    const mockBase = toMockPayload("", page, fetchLimit);
    return NextResponse.json(
      withDebugFields(topicFilteredPayload(mockBase, query), {
        cacheStatus: "topic_filter:mock_fallback",
        editionDate: today,
        lastSuccessfulFetchedAt: null,
        reasonProviderFetchWasSkipped: "topic_filter_no_saved_broad_edition",
        reasonProviderFetchWasAllowed: null,
      })
    );
  }

  // 3) Cache rules allow a live fetch: this is the only place providers are called.
  const providerResponse = await fetchProviderNews(query, fetchLimit, page, timeRange, {
    editionFetch: isBroadDashboardEdition,
  });
  let payload = providerResponse
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
        const rangeBriefs = sortedBriefs.filter((item) => inTimeRange(item.publishedAt, timeRange));
        const rangeArticles = sortedArticles.filter((item) => inTimeRange(item.publishedAt, timeRange));
        const start = (Math.max(1, page) - 1) * fetchLimit;
        const pagedBriefs = rangeBriefs.slice(start, start + fetchLimit);
        const pagedArticles = rangeArticles.slice(start, start + fetchLimit);
        return {
          query,
          provider: providerResponse.provider,
          providerStats: providerResponse.providerStats,
          fetchedAt: providerResponse.fetchedAt,
          articleCount: pagedBriefs.length,
          page,
          limit: fetchLimit,
          hasMore: start + fetchLimit < rangeBriefs.length,
          totalAvailable: rangeBriefs.length,
          articles: pagedArticles,
          normalized: pagedArticles,
          briefs: pagedBriefs,
          errorMessage: providerResponse.errorMessage,
        } satisfies CachedPayload;
      })()
    : toMockPayload(query, page, fetchLimit);

  const savedEditionForSave = await cacheGet<EditionRecord>(editionKey);
  const lastGoodForSave = await cacheGet<LastGoodRecord>(lastGoodKey);
  const existingStoryCount = resolveExistingEditionStoryCount(savedEditionForSave, lastGoodForSave);
  const hasFreshSavedEditionForToday = Boolean(
    savedEditionForSave &&
      isFreshSavedEditionForToday({
        editionDate: savedEditionForSave.value.editionDate,
        fetchedAt: savedEditionForSave.value.payload.fetchedAt,
        today,
      })
  );
  const isSuccessfulLiveFetch = isLiveEditionPayload(payload);
  const shouldSaveLiveEdition =
    isSuccessfulLiveFetch &&
    (shouldPersistLiveEditionFetch(payload, existingStoryCount) ||
      shouldPersistNewDayEditionFetch(payload, hasFreshSavedEditionForToday));

  let cacheStatus: string;
  let lastSuccessfulFetchedAt: string | null = null;

  if (shouldSaveLiveEdition) {
    if (isBroadDashboardEdition) {
      await mirrorRollingBroadEditionToWeek();
    }
    const enrichedPayload = enrichPayloadBriefs(payload);
    await Promise.all([
      cacheSet(editionKey, {
        editionDate: today,
        savedAt: new Date().toISOString(),
        payload: enrichedPayload,
      } satisfies EditionRecord),
      cacheSet(lastGoodKey, {
        fetchedAt: enrichedPayload.fetchedAt,
        payload: enrichedPayload,
      } satisfies LastGoodRecord),
      writeFetchCooldown(scopeKey, {
        retryAt: 0,
        lastSuccessfulFetchedAt: enrichedPayload.fetchedAt,
      }),
      ...enrichedPayload.briefs.map((brief) => cacheSet(`article::${brief.id}`, brief)),
      saveDailyEditionForWeek(today, enrichedPayload.briefs),
    ]);
    cacheStatus = "live_fetch_saved_as_todays_edition";
    lastSuccessfulFetchedAt = enrichedPayload.fetchedAt;
    payload = enrichedPayload;
  } else {
    // Never save weak partials, 0-story, or rate-limited/error responses as a successful edition.
    const existingCooldown = await readFetchCooldown(scopeKey);
    const lastGood = lastGoodForSave;
    const rejectedPartialLiveFetch =
      isSuccessfulLiveFetch &&
      !shouldPersistLiveEditionFetch(payload, existingStoryCount) &&
      existingStoryCount >= DAILY_EDITION_REPLACEMENT_MIN;

    if (providerResponse) {
      await writeFetchCooldown(scopeKey, {
        retryAt: Date.now() + FAILURE_RETRY_COOLDOWN_MS,
        lastSuccessfulFetchedAt:
          existingCooldown?.lastSuccessfulFetchedAt ?? lastGood?.value.fetchedAt ?? undefined,
      });
    }

    if (lastGood && isLiveEditionPayload(lastGood.value.payload)) {
      lastSuccessfulFetchedAt = lastGood.value.fetchedAt;
      payload = {
        ...lastGood.value.payload,
        errorMessage: rejectedPartialLiveFetch
          ? `Provider returned only ${editionStoryCount(payload)} usable ${editionStoryCount(payload) === 1 ? "story" : "stories"}. Keeping the saved daily edition.`
          : payload.errorMessage ?? "Live provider unavailable. Showing latest available stories.",
      };
      cacheStatus = rejectedPartialLiveFetch
        ? `partial_fetch_rejected:${lastGood.tier}`
        : `stale_fallback:${lastGood.tier}`;
    } else {
      cacheStatus = payload.provider === "mock" ? "mock_fallback" : "live_fetch_failed_no_saved_edition";
    }
  }

  return NextResponse.json(
    withDebugFields(payload, {
      cacheStatus,
      editionDate: today,
      lastSuccessfulFetchedAt,
      reasonProviderFetchWasSkipped: freshIgnoredNote,
      reasonProviderFetchWasAllowed: reasonAllowed,
    })
  );
}
