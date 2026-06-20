"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Brief } from "@/lib/types";
import {
  getInitialArticleFeedMeta,
} from "@/lib/mock-refresh";
import { formatLastUpdated } from "@/lib/date-format";
import { friendlyEditionError } from "@/lib/user-messages";
import { DAILY_EDITION_ARTICLE_LIMIT } from "@/lib/news-constants";
import { enrichBriefImage } from "@/lib/article-image";
import { buildDashboardSections } from "@/lib/dashboard-sections";
import { filterBriefsForTopic } from "@/lib/topic-stories";
import { toTopicSlug } from "@/lib/slug";
import { ArticleCard } from "./ArticleCard";

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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [hasLoadedApi, setHasLoadedApi] = useState(initialBriefs.length > 0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiLayoutDebug, setApiLayoutDebug] = useState<{
    savedEditionArticleCount: number;
    articlesWithImageUrl: number;
  } | null>(null);
  const editionRef = useRef<Brief[]>(initialBriefs.map(enrichBriefImage));
  const isRefreshingRef = useRef(false);
  const topicQuery = query.trim();
  const isTopicView = topicQuery.length > 0;

  const [editionBriefs, setEditionBriefs] = useState<Brief[]>(() => initialBriefs.map(enrichBriefImage));

  useEffect(() => {
    editionRef.current = editionBriefs;
  }, [editionBriefs]);

  const topicStories = useMemo(
    () => (isTopicView ? filterBriefsForTopic(editionBriefs, topicQuery) : []),
    [editionBriefs, isTopicView, topicQuery]
  );

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

  const refreshFeed = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    const params = new URLSearchParams();
    params.set("timeRange", "week");
    params.set("limit", String(DAILY_EDITION_ARTICLE_LIMIT));
    params.set("page", "1");
    params.set("edition", dailyEditionKey());
    try {
      const response = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as {
          briefs: Brief[];
          fetchedAt: string;
          hasMore?: boolean;
          provider?: string;
          errorMessage?: string;
          savedEditionArticleCount?: number;
          articlesWithImageUrl?: number;
        };
        setApiError(friendlyEditionError(payload.errorMessage) ?? null);
        setApiLayoutDebug({
          savedEditionArticleCount: payload.savedEditionArticleCount ?? payload.briefs?.length ?? 0,
          articlesWithImageUrl: payload.articlesWithImageUrl ?? 0,
        });
        const apiBriefs = (payload.briefs ?? []).map(enrichBriefImage);
        const provider = payload.provider ?? "mock";
        const nextEdition =
          provider === "mock" && apiBriefs.length === 0
            ? initialBriefs.map(enrichBriefImage)
            : apiBriefs;
        const prevSig = idsSignature(editionRef.current);
        const nextSig = idsSignature(nextEdition);
        if (prevSig !== nextSig) {
          setEditionBriefs(nextEdition);
        }
        setMeta((prev) => ({
          refreshCount: prev.refreshCount + 1,
          lastUpdatedAt: payload.fetchedAt ?? new Date().toISOString(),
        }));
        setVisibleCount(12);
        setPage(1);
        setHasMore(Boolean(payload.hasMore));
        setHasLoadedApi(true);
      } else {
        setApiError("We couldn't load today's edition right now. Please check back later.");
      }
    } catch {
      setApiError("We couldn't load today's edition right now. Please check back later.");
    } finally {
      isRefreshingRef.current = false;
    }
  }, [initialBriefs]);

  useEffect(() => {
    refreshFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const enriched = initialBriefs.map(enrichBriefImage);
    setEditionBriefs(enriched);
    editionRef.current = enriched;
    setPage(1);
    setHasMore(false);
    setVisibleCount(12);
    setHasLoadedApi(initialBriefs.length > 0);
    setApiError(null);
    setApiLayoutDebug(null);
  }, [initialBriefs]);

  const handleLoadMore = useCallback(async () => {
    if (isTopicView) return;
    if (visibleCount < editionBriefs.length) {
      setVisibleCount((prev) => Math.min(editionBriefs.length, prev + 6));
      return;
    }
    if (!hasMore || isRefreshingRef.current) return;

    setIsLoadingMore(true);
    const nextPage = page + 1;
    const params = new URLSearchParams();
    params.set("timeRange", "week");
    params.set("limit", String(DAILY_EDITION_ARTICLE_LIMIT));
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
      setApiError(friendlyEditionError(payload.errorMessage) ?? null);
      setEditionBriefs((prev) => {
        const existing = new Set(prev.map((item) => item.id));
        const additions = payload.briefs.filter((item) => !existing.has(item.id)).map(enrichBriefImage);
        return [...prev, ...additions];
      });
      setVisibleCount((prev) => prev + 12);
      setPage(nextPage);
      setHasMore(Boolean(payload.hasMore));
    } finally {
      setIsLoadingMore(false);
    }
  }, [editionBriefs.length, hasMore, isTopicView, page, visibleCount]);

  useEffect(() => {
    let midnightTimer: number | undefined;

    const scheduleMidnightRefresh = () => {
      midnightTimer = window.setTimeout(async () => {
        await refreshFeed();
        scheduleMidnightRefresh();
      }, msUntilNextLocalMidnight());
    };
    scheduleMidnightRefresh();

    return () => {
      if (midnightTimer) window.clearTimeout(midnightTimer);
    };
  }, [refreshFeed]);

  const { sections: groupedSections, layoutDebug } = buildDashboardSections(editionBriefs);
  const hasVisibleStories = isTopicView
    ? topicStories.length > 0
    : groupedSections.some((section) => section.stories.length > 0);
  const editionArticleCount = apiLayoutDebug?.savedEditionArticleCount ?? layoutDebug.savedEditionArticleCount;
  const editionImageCount = apiLayoutDebug?.articlesWithImageUrl ?? layoutDebug.articlesWithImageUrl;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-fin-subtle">
          <span className="font-semibold text-fin-navy">Daily edition</span>
          <span>{formatLastUpdated(meta.lastUpdatedAt)}</span>
          <span>
            {isTopicView
              ? `${topicStories.length} topic ${topicStories.length === 1 ? "story" : "stories"}`
              : `${editionBriefs.length} stories`}
          </span>
          {!isTopicView && (
            <span
              className="text-[11px] text-fin-subtle"
              data-layout-debug
              title="Dashboard layout debug"
            >
              Edition {editionArticleCount} saved · Top {layoutDebug.topStoriesCount} · imageUrl{" "}
              {editionImageCount}
            </span>
          )}
        </div>
        <p className="text-xs text-fin-subtle">Daily edition updates once per day.</p>
      </div>

      {apiError && (
        <p className="text-sm font-medium text-status-warning" role="status">
          {apiError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-fin-brand px-3 py-1.5 text-xs font-semibold text-white">
          {isTopicView ? `${topicQuery} · today's edition` : "This week's edition"}
        </span>
        {isTopicView && (
          <span className="rounded-full bg-fin-muted px-3 py-1.5 text-xs font-medium text-fin-subtle">
            Filtered from saved daily edition
          </span>
        )}
      </div>

      {!hasLoadedApi ? (
        <p className="fin-panel py-12 text-center text-sm text-fin-subtle">
          Loading stories...
        </p>
      ) : isTopicView && topicStories.length === 0 ? (
        <div className="fin-panel py-12 text-center">
          <p className="text-sm font-medium text-fin-navy">No stories for {topicQuery} in today&apos;s edition</p>
          <p className="mt-2 text-sm text-fin-subtle">
            This topic has no matching stories in the current daily edition. Check back after the next update or
            browse another topic.
          </p>
        </div>
      ) : !hasVisibleStories ? (
        <div className="fin-panel py-12 text-center">
          <p className="text-sm font-medium text-fin-navy">No stories in this edition yet</p>
          <p className="mt-2 text-sm text-fin-subtle">
            The daily edition updates once per day. Check back after the next update, or try a different topic from
            the sidebar.
          </p>
        </div>
      ) : isTopicView ? (
        <section className="space-y-4">
          <div>
            <h3 className="fin-section-title">{topicQuery} stories</h3>
            <p className="text-sm text-fin-subtle">
              Up to {topicStories.length} stor{topicStories.length === 1 ? "y" : "ies"} from today&apos;s saved
              edition
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {topicStories.map((brief, index) => (
              <ArticleCard
                key={brief.id}
                article={brief}
                variant={index === 0 ? "hero" : "standard"}
                priorityImage={index === 0}
              />
            ))}
          </div>
        </section>
      ) : (
        <div className="space-y-10">
          {groupedSections.map((section) => {
            if (section.stories.length === 0) return null;

            return (
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
                      variant={
                        section.title === "Top Stories" && index === 0
                          ? "hero"
                          : section.title === "Top Stories"
                            ? "standard"
                            : "compact"
                      }
                      priorityImage={section.title === "Top Stories" && index === 0}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!isTopicView && (visibleCount < editionBriefs.length || hasMore) && (
        <div className="flex justify-center">
          <button
            type="button"
            className="fin-btn-secondary"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load more stories"}
          </button>
        </div>
      )}
    </div>
  );
}
