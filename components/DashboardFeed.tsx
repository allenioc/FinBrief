"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Brief } from "@/lib/types";
import {
  getInitialArticleFeedMeta,
} from "@/lib/mock-refresh";
import { formatLastUpdated } from "@/lib/date-format";
import { BROAD_NEWS_QUERY } from "@/lib/news-constants";
import { toTopicSlug } from "@/lib/slug";
import { ArticleCard } from "./ArticleCard";
import { RefreshFeedButton } from "./RefreshFeedButton";
import { useWatchlist } from "./WatchlistProvider";

const DEFAULT_NEWS_QUERY = BROAD_NEWS_QUERY;

function msUntilNextLocalMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

export function DashboardFeed({
  initialBriefs,
  query,
}: {
  initialBriefs: Brief[];
  query: string;
}) {
  const [meta, setMeta] = useState(getInitialArticleFeedMeta);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [timeWindow, setTimeWindow] = useState<"breaking" | "today" | "week">("week");
  const [hasLoadedApi, setHasLoadedApi] = useState(initialBriefs.length > 0);
  const [lastUpdateMode, setLastUpdateMode] = useState<"daily" | "manual">("daily");
  const [apiError, setApiError] = useState<string | null>(null);
  const { items: watchlistItems } = useWatchlist();
  const briefsRef = useRef<Brief[]>(initialBriefs);
  const isRefreshingRef = useRef(false);
  const activeQuery = query.trim() || DEFAULT_NEWS_QUERY;
  const isDefaultFeed = activeQuery === DEFAULT_NEWS_QUERY;

  const [briefs, setBriefs] = useState<Brief[]>(initialBriefs);

  useEffect(() => {
    briefsRef.current = briefs;
  }, [briefs]);

  function idsSignature(items: Brief[]): string {
    return items.map((item) => item.id).join("|");
  }

  function dailyEditionKey(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `business-news-feed-${yyyy}-${mm}-${dd}`;
  }

  const refreshFeed = useCallback(async (reason: "manual" | "auto" | "midnight") => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    if (reason === "manual") {
      setIsManualRefreshing(true);
      setStatusMessage("Checking for newer stories…");
    }

    const params = new URLSearchParams();
    if (!isDefaultFeed) params.set("q", activeQuery);
    params.set("timeRange", isDefaultFeed ? "week" : timeWindow);
    params.set("limit", "20");
    params.set("page", "1");
    if (reason === "manual") {
      params.set("fresh", "true");
      params.set("t", Date.now().toString());
    } else {
      params.set("edition", dailyEditionKey());
    }
    try {
      const response = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as {
          briefs: Brief[];
          fetchedAt: string;
          hasMore?: boolean;
          provider?: string;
          errorMessage?: string;
        };
        setApiError(payload.errorMessage ?? null);
        const prevIds = briefsRef.current.slice(0, 5).map((item) => item.id).join("|");
        const apiBriefs = payload.briefs ?? [];
        const provider = payload.provider ?? "mock";
        const nextBriefs =
          provider === "mock" && apiBriefs.length === 0 ? initialBriefs : apiBriefs;
        const prevSig = idsSignature(briefsRef.current);
        const nextSig = idsSignature(nextBriefs);
        if (prevSig !== nextSig) {
          setBriefs(nextBriefs);
        }
        setMeta((prev) => ({
          refreshCount: prev.refreshCount + 1,
          lastUpdatedAt: payload.fetchedAt ?? new Date().toISOString(),
        }));
        setVisibleCount(12);
        setPage(1);
        setHasMore(Boolean(payload.hasMore));
        setHasLoadedApi(true);
        setLastUpdateMode(reason === "manual" ? "manual" : "daily");
        if (reason === "manual") {
          const nextIds = nextBriefs.slice(0, 5).map((item) => item.id).join("|");
          setStatusMessage(prevIds === nextIds ? "You're up to date." : "Stories updated.");
        }
      } else {
        setApiError("Live provider request failed. Please retry later.");
      }
    } catch {
      setApiError("Live provider request failed. Please retry later.");
    } finally {
      if (reason === "manual") {
        setIsManualRefreshing(false);
        window.setTimeout(() => setStatusMessage(null), 1800);
      }
      isRefreshingRef.current = false;
    }
  }, [activeQuery, initialBriefs, isDefaultFeed, timeWindow]);

  const handleRefresh = useCallback(async () => {
    await refreshFeed("manual");
  }, [refreshFeed]);

  useEffect(() => {
    refreshFeed("auto");
    // Intentionally tied to query/default feed changes only.
    // We avoid refetching on tab switches to reduce provider churn/rate limits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuery, isDefaultFeed]);

  useEffect(() => {
    setBriefs(initialBriefs);
    briefsRef.current = initialBriefs;
    setPage(1);
    setHasMore(false);
    setVisibleCount(12);
    setHasLoadedApi(initialBriefs.length > 0);
    setLastUpdateMode("daily");
    setTimeWindow("week");
    setApiError(null);
  }, [activeQuery, initialBriefs]);

  const handleLoadMore = useCallback(async () => {
    if (visibleCount < briefs.length) {
      setVisibleCount((prev) => Math.min(briefs.length, prev + 6));
      return;
    }
    if (!hasMore || isRefreshingRef.current) return;

    setIsLoadingMore(true);
    const nextPage = page + 1;
    const params = new URLSearchParams();
    if (!isDefaultFeed) params.set("q", activeQuery);
    params.set("timeRange", isDefaultFeed ? "week" : timeWindow);
    params.set("limit", "20");
    params.set("page", String(nextPage));
    params.set("edition", dailyEditionKey());
    try {
      const response = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        briefs: Brief[];
        hasMore?: boolean;
        errorMessage?: string;
      };
      setApiError(payload.errorMessage ?? null);
      setBriefs((prev) => {
        const existing = new Set(prev.map((item) => item.id));
        const additions = payload.briefs.filter((item) => !existing.has(item.id));
        return [...prev, ...additions];
      });
      setVisibleCount((prev) => prev + 12);
      setPage(nextPage);
      setHasMore(Boolean(payload.hasMore));
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeQuery, briefs.length, hasMore, isDefaultFeed, page, timeWindow, visibleCount]);

  useEffect(() => {
    if (!isDefaultFeed) return;
    let midnightTimer: number | undefined;

    const scheduleMidnightRefresh = () => {
      midnightTimer = window.setTimeout(async () => {
        await refreshFeed("midnight");
        scheduleMidnightRefresh();
      }, msUntilNextLocalMidnight());
    };
    scheduleMidnightRefresh();

    return () => {
      if (midnightTimer) window.clearTimeout(midnightTimer);
    };
  }, [isDefaultFeed, refreshFeed]);

  const watchlistSymbols = watchlistItems.map((item) => item.symbol.toLowerCase());
  const sortedBriefs = [...briefs].sort((a, b) => {
    const at = new Date(a.publishedAt).getTime();
    const bt = new Date(b.publishedAt).getTime();
    const safeA = Number.isFinite(at) ? at : 0;
    const safeB = Number.isFinite(bt) ? bt : 0;
    return safeB - safeA;
  });
  const now = Date.now();
  const scoped = sortedBriefs.filter((brief) => {
    const published = new Date(brief.publishedAt).getTime();
    if (!Number.isFinite(published)) return true;
    const ageMs = now - published;
    if (ageMs < 0) return true;
    if (timeWindow === "breaking") return ageMs <= 6 * 60 * 60 * 1000;
    if (timeWindow === "today") return ageMs <= 24 * 60 * 60 * 1000;
    return ageMs <= 7 * 24 * 60 * 60 * 1000;
  });
  const displayed = scoped.slice(0, visibleCount);
  const topStories = displayed.slice(0, 4);
  const marketStories = displayed.filter(
    (brief) => brief.articleType === "market news" || brief.articleType === "macro news"
  );
  const watchlistStories = displayed.filter((brief) => {
    const assets = [brief.ticker, brief.topic, ...brief.keyAffectedAssets].map((value) => value.toLowerCase());
    return watchlistSymbols.some((symbol) => assets.some((asset) => asset.includes(symbol)));
  });
  const recommendedStories = displayed.filter(
    (brief) => !topStories.some((top) => top.id === brief.id) && !watchlistStories.some((item) => item.id === brief.id)
  );

  const groupedSections: Array<{ title: string; subtitle: string; stories: Brief[] }> = [
    { title: "Top Stories", subtitle: "Most relevant stories right now", stories: topStories },
    { title: "Latest Market Stories", subtitle: "Macro and index-focused context", stories: marketStories },
    {
      title: "Watchlist-related Stories",
      subtitle: "Stories tied to assets you follow",
      stories: watchlistStories,
    },
    { title: "Recommended Next", subtitle: "Additional stories worth reading", stories: recommendedStories },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-fin-subtle">
          <span className="font-semibold text-fin-navy">Live feed</span>
          <span>
            {lastUpdateMode === "manual"
              ? formatLastUpdated(meta.lastUpdatedAt).replace("Daily edition updated", "Last refreshed")
              : formatLastUpdated(meta.lastUpdatedAt)}
          </span>
          <span>{briefs.length} stories</span>
        </div>
        <RefreshFeedButton
          onClick={handleRefresh}
          loading={isManualRefreshing}
          loadingMessage="Checking for newer stories…"
          label="Refresh stories"
        />
      </div>

      {statusMessage && (
        <p className="text-sm font-medium text-fin-brand" role="status">
          {statusMessage}
        </p>
      )}
      {apiError && (
        <p className="text-sm font-medium text-status-warning" role="status">
          {apiError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { id: "breaking", label: "Breaking" },
          { id: "today", label: "Today" },
          { id: "week", label: "This week" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTimeWindow(tab.id as "breaking" | "today" | "week")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              timeWindow === tab.id
                ? "bg-fin-brand text-white"
                : "border border-fin-border bg-fin-surface text-fin-navy hover:bg-fin-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!hasLoadedApi ? (
        <p className="fin-panel py-12 text-center text-sm text-fin-subtle">
          Loading stories...
        </p>
      ) : displayed.length === 0 ? (
        <p className="fin-panel py-12 text-center text-sm text-fin-subtle">
          {timeWindow === "today"
            ? "No fresh stories found today. Try This week or check back later."
            : "No fresh stories found. Try Refresh stories or check back later."}
        </p>
      ) : (
        <div className="space-y-10">
          {groupedSections.map((section) =>
            section.stories.length > 0 ? (
              <section key={section.title} className="space-y-4">
                <div>
                  <h3 className="fin-section-title">{section.title}</h3>
                  <p className="text-sm text-fin-subtle">{section.subtitle}</p>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {section.stories.map((brief, index) => (
                    <ArticleCard
                      key={`${brief.id}-${toTopicSlug(section.title)}`}
                      article={brief}
                      variant={index === 0 && section.title === "Top Stories" ? "hero" : "standard"}
                    />
                  ))}
                </div>
              </section>
            ) : null
          )}
        </div>
      )}

      {(visibleCount < briefs.length || hasMore) && (
        <div className="flex justify-center">
          <button
            type="button"
            className="fin-btn-secondary"
            onClick={handleLoadMore}
            disabled={isLoadingMore || isManualRefreshing}
          >
            {isLoadingMore ? "Loading..." : "Load more stories"}
          </button>
        </div>
      )}
    </div>
  );
}
