"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Brief } from "@/lib/types";
import {
  getInitialArticleFeedMeta,
} from "@/lib/mock-refresh";
import { formatLastUpdated } from "@/lib/date-format";
import { formatProviderLabel, isLiveProvider } from "@/lib/news-source";
import { BROAD_NEWS_QUERY } from "@/lib/news-constants";
import { toTopicSlug } from "@/lib/slug";
import { ArticleCard } from "./ArticleCard";
import { RefreshFeedButton } from "./RefreshFeedButton";
import { useWatchlist } from "./WatchlistProvider";

const AUTO_REFRESH_MS = 10 * 60 * 1000;
const FOCUS_REFRESH_COOLDOWN_MS = 2 * 60 * 1000;
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
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [meta, setMeta] = useState(getInitialArticleFeedMeta);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [providerLabel, setProviderLabel] = useState<string>("mock");
  const [timeWindow, setTimeWindow] = useState<"breaking" | "today" | "week">("today");
  const [hasLoadedApi, setHasLoadedApi] = useState(false);
  const { items: watchlistItems } = useWatchlist();
  const isRefreshingRef = useRef(false);
  const lastRefreshAtRef = useRef(Date.now());
  const activeQuery = query.trim() || DEFAULT_NEWS_QUERY;

  const refreshFeed = useCallback(async (reason: "manual" | "auto" | "focus" | "midnight") => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setLoading(true);
    if (reason === "manual") setStatusMessage("Checking for newer stories…");

    const params = new URLSearchParams();
    params.set("q", activeQuery);
    params.set("limit", "20");
    params.set("page", "1");
    if (reason === "manual") params.set("fresh", Date.now().toString());
    try {
      const response = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as {
          briefs: Brief[];
          fetchedAt: string;
          hasMore?: boolean;
          provider?: string;
        };
        const prevIds = briefs.slice(0, 5).map((item) => item.id).join("|");
        const provider = payload.provider ?? "mock";
        const apiBriefs = payload.briefs ?? [];
        const nextBriefs =
          provider === "newsapi"
            ? apiBriefs
            : apiBriefs.length > 0
              ? apiBriefs
              : initialBriefs;
        setBriefs(nextBriefs);
        setMeta((prev) => ({
          refreshCount: prev.refreshCount + 1,
          lastUpdatedAt: payload.fetchedAt ?? new Date().toISOString(),
        }));
        setVisibleCount(12);
        setPage(1);
        setHasMore(Boolean(payload.hasMore));
        setProviderLabel(provider);
        setHasLoadedApi(true);
        lastRefreshAtRef.current = Date.now();
        if (reason === "manual") {
          const nextIds = nextBriefs.slice(0, 5).map((item) => item.id).join("|");
          setStatusMessage(prevIds === nextIds ? "You're up to date." : "Stories updated.");
        }
      }
    } finally {
      setLoading(false);
      if (reason === "manual") {
        window.setTimeout(() => setStatusMessage(null), 1800);
      }
      isRefreshingRef.current = false;
    }
  }, [activeQuery, briefs, initialBriefs]);

  const handleRefresh = useCallback(async () => {
    await refreshFeed("manual");
  }, [refreshFeed]);

  useEffect(() => {
    refreshFeed("auto");
  }, [refreshFeed]);

  useEffect(() => {
    setPage(1);
    setHasMore(false);
    setVisibleCount(12);
    setHasLoadedApi(false);
  }, [activeQuery]);

  const handleLoadMore = useCallback(async () => {
    if (visibleCount < briefs.length) {
      setVisibleCount((prev) => Math.min(briefs.length, prev + 6));
      return;
    }
    if (!hasMore || isRefreshingRef.current) return;

    setLoading(true);
    const nextPage = page + 1;
    const params = new URLSearchParams();
    params.set("q", activeQuery);
    params.set("limit", "20");
    params.set("page", String(nextPage));
    try {
      const response = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        briefs: Brief[];
        hasMore?: boolean;
        provider?: string;
      };
      setBriefs((prev) => {
        const existing = new Set(prev.map((item) => item.id));
        const additions = payload.briefs.filter((item) => !existing.has(item.id));
        return [...prev, ...additions];
      });
      setVisibleCount((prev) => prev + 12);
      setPage(nextPage);
      setHasMore(Boolean(payload.hasMore));
      if (payload.provider) setProviderLabel(payload.provider);
    } finally {
      setLoading(false);
    }
  }, [activeQuery, briefs.length, hasMore, page, visibleCount]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      refreshFeed("auto");
    }, AUTO_REFRESH_MS);
    let midnightTimer: number | undefined;

    const scheduleMidnightRefresh = () => {
      midnightTimer = window.setTimeout(async () => {
        await refreshFeed("midnight");
        scheduleMidnightRefresh();
      }, msUntilNextLocalMidnight());
    };
    scheduleMidnightRefresh();

    const handleFocusRefresh = () => {
      const elapsed = Date.now() - lastRefreshAtRef.current;
      if (elapsed >= FOCUS_REFRESH_COOLDOWN_MS) {
        refreshFeed("focus");
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleFocusRefresh();
      }
    };

    window.addEventListener("focus", handleFocusRefresh);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      if (midnightTimer) window.clearTimeout(midnightTimer);
      window.removeEventListener("focus", handleFocusRefresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshFeed]);

  const watchlistSymbols = watchlistItems.map((item) => item.symbol.toLowerCase());
  const now = Date.now();
  const timeFiltered = briefs.filter((brief) => {
    const ageMs = now - new Date(brief.publishedAt).getTime();
    if (timeWindow === "breaking") return ageMs <= 6 * 60 * 60 * 1000;
    if (timeWindow === "today") return ageMs <= 24 * 60 * 60 * 1000;
    return ageMs <= 7 * 24 * 60 * 60 * 1000;
  });
  const scoped = timeFiltered.length > 0 ? timeFiltered : briefs;
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
          <span>Last updated: {formatLastUpdated(meta.lastUpdatedAt)}</span>
          <span>{briefs.length} stories</span>
        </div>
        <RefreshFeedButton
          onClick={handleRefresh}
          loading={loading}
          loadingMessage="Checking for newer stories…"
          label="Refresh stories"
        />
      </div>

      {statusMessage && (
        <p className="text-sm font-medium text-fin-brand" role="status">
          {statusMessage}
        </p>
      )}

      <p className="text-sm text-fin-subtle">
        {query ? (
          <>
            Results for{" "}
            <span className="font-mono font-semibold text-fin-navy">{query}</span>
            {" · "}
            {briefs.length} {briefs.length === 1 ? "briefing" : "briefings"}
          </>
        ) : (
          <>Latest business and finance stories across markets, economy, policy, and companies</>
        )}
      </p>
      <p className="text-xs text-fin-subtle">
        Auto-updates every 10 minutes, on tab return, and daily at 12:00 AM local time.
      </p>
      <div
        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
          isLiveProvider(providerLabel)
            ? "bg-status-positive-bg text-status-positive"
            : "bg-status-warning-bg text-status-warning"
        }`}
      >
        {isLiveProvider(providerLabel)
          ? `Live feed: ${formatProviderLabel(providerLabel)}`
          : "Mock fallback"}
      </div>

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
          Loading live stories from /api/news...
        </p>
      ) : displayed.length === 0 ? (
        <p className="fin-panel py-12 text-center text-sm text-fin-subtle">
          No stories found for this query. FinBrief will use mock fallback only when live providers are unavailable.
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
                      key={`${brief.id}-${meta.refreshCount}-${toTopicSlug(section.title)}`}
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
            disabled={loading}
          >
            {loading ? "Loading..." : "Load more stories"}
          </button>
        </div>
      )}
    </div>
  );
}
