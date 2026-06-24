"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatLastUpdated } from "@/lib/date-format";
import { friendlyEditionError } from "@/lib/user-messages";
import { DAILY_EDITION_ARTICLE_LIMIT } from "@/lib/news-constants";
import { dailyEditionRequestKey } from "@/lib/daily-edition-client";
import { restoreDashboardScroll } from "@/lib/dashboard-scroll-restore";
import { buildDashboardSections } from "@/lib/dashboard-sections";
import { filterBriefsForTopic, findWatchlistItemForQuery } from "@/lib/topic-stories";
import { toTopicSlug } from "@/lib/slug";
import type { Brief } from "@/lib/types";
import { useDailyEdition } from "./DailyEditionProvider";
import { useWatchlist } from "./WatchlistProvider";
import { useWeeklyArchive } from "./useWeeklyArchive";
import { ArticleCard } from "./ArticleCard";

function DashboardFeedSkeleton() {
  return (
    <div className="space-y-8 animate-pulse" aria-hidden="true">
      <div className="space-y-3">
        <div className="h-3 w-40 rounded bg-fin-muted" />
        <div className="h-3 w-56 rounded bg-fin-muted" />
      </div>
      <div className="space-y-4">
        <div className="h-5 w-32 rounded bg-fin-muted" />
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="fin-card h-72 rounded-panel bg-fin-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardFeed({ query }: { query: string }) {
  const {
    editionBriefs,
    ready,
    syncing,
    fetchedAt,
    hasMore,
    page,
    appendPage,
  } = useDailyEdition();
  const { items: watchlistItems } = useWatchlist();
  const topicQuery = query.trim();
  const isTopicView = topicQuery.length > 0;
  const {
    briefs: weeklyBriefs,
    loading: weeklyLoading,
    error: weeklyError,
    weekLabel,
    archive: weeklyArchive,
  } = useWeeklyArchive(isTopicView);

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  const followedTopic = useMemo(
    () => (isTopicView ? findWatchlistItemForQuery(watchlistItems, topicQuery) : undefined),
    [isTopicView, topicQuery, watchlistItems]
  );

  const topicStories = useMemo(() => {
    if (!isTopicView) return [];
    const filtered = filterBriefsForTopic(weeklyBriefs, topicQuery, undefined, followedTopic);
    return [...filtered].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }, [followedTopic, isTopicView, topicQuery, weeklyBriefs]);

  useEffect(() => {
    if (isTopicView) {
      if (!weeklyLoading) restoreDashboardScroll();
      return;
    }
    if (!ready) return;
    restoreDashboardScroll();
  }, [ready, editionBriefs.length, topicQuery, isTopicView, weeklyLoading, topicStories.length]);

  const { sections: groupedSections } = buildDashboardSections(editionBriefs);
  const hasEditionStories = editionBriefs.length > 0;
  const hasVisibleStories = isTopicView
    ? topicStories.length > 0
    : groupedSections.some((section) => section.stories.length > 0);
  const hasWeeklyStories = (weeklyArchive?.storyCount ?? 0) > 0;
  const showLoading = isTopicView
    ? weeklyLoading
    : !ready || (syncing && !hasEditionStories);
  const showEmptyEdition = ready && !syncing && !hasEditionStories && !isTopicView;

  const handleLoadMore = useCallback(async () => {
    if (isTopicView) return;
    if (visibleCount < editionBriefs.length) {
      setVisibleCount((prev) => Math.min(editionBriefs.length, prev + 6));
      return;
    }
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    const nextPage = page + 1;
    const params = new URLSearchParams();
    params.set("timeRange", "week");
    params.set("limit", String(DAILY_EDITION_ARTICLE_LIMIT));
    params.set("page", String(nextPage));
    params.set("edition", dailyEditionRequestKey());
    try {
      const response = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        briefs: Brief[];
        hasMore?: boolean;
        errorMessage?: string;
      };
      setApiError(friendlyEditionError(payload.errorMessage) ?? null);
      appendPage(payload.briefs ?? [], Boolean(payload.hasMore), nextPage);
      setVisibleCount((prev) => prev + 12);
    } finally {
      setIsLoadingMore(false);
    }
  }, [appendPage, editionBriefs.length, hasMore, isLoadingMore, isTopicView, page, visibleCount]);

  return (
    <div className="space-y-6">
      {showLoading ? (
        <DashboardFeedSkeleton />
      ) : (
        <>
      {!isTopicView && (
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-fin-subtle">
          <span className="font-semibold text-fin-navy">Daily edition</span>
          {fetchedAt && <span>{formatLastUpdated(fetchedAt)}</span>}
          {hasEditionStories && (
            <span>
              {`${editionBriefs.length} stories`}
            </span>
          )}
        </div>
        <p className="text-xs text-fin-subtle">
          Daily edition updates once per day.
          {syncing && hasEditionStories ? " Syncing in background…" : ""}
        </p>
      </div>
      )}

      {isTopicView && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-fin-subtle">
            <span className="font-semibold text-fin-navy">Following</span>
            <span>{weekLabel}</span>
            {topicStories.length > 0 && (
              <span>
                {topicStories.length} matching {topicStories.length === 1 ? "story" : "stories"}
              </span>
            )}
          </div>
          <p className="text-xs text-fin-subtle">Saved daily editions this week · no live fetch</p>
        </div>
      )}

      {apiError && (
        <p className="text-sm font-medium text-status-warning" role="status">
          {apiError}
        </p>
      )}

      {isTopicView && (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-fin-brand px-3 py-1.5 text-xs font-semibold text-white">
            {topicQuery} · this week
          </span>
          <span className="rounded-full bg-fin-muted px-3 py-1.5 text-xs font-medium text-fin-subtle">
            Filtered from saved stories this week
          </span>
        </div>
      )}

      {isTopicView && weeklyError && !hasWeeklyStories ? (
        <div className="fin-panel py-12 text-center">
          <p className="text-sm font-medium text-fin-navy">{weeklyError}</p>
          <p className="mt-2 text-sm text-fin-subtle">
            Following topics use saved stories from the current week. Check back after more daily editions are saved.
          </p>
        </div>
      ) : isTopicView && !hasWeeklyStories ? (
        <div className="fin-panel py-12 text-center">
          <p className="text-sm font-medium text-fin-navy">No saved stories this week yet</p>
          <p className="mt-2 text-sm text-fin-subtle">
            As daily editions are saved during the week, matching stories for {topicQuery} will appear here
            automatically.
          </p>
        </div>
      ) : isTopicView && topicStories.length === 0 ? (
        <div className="fin-panel py-12 text-center">
          <p className="text-sm font-medium text-fin-navy">No matching saved stories for {topicQuery} this week</p>
          <p className="mt-2 text-sm text-fin-subtle">
            None of this week&apos;s saved stories match this topic yet. Try another topic from the sidebar or check
            back as more editions are saved.
          </p>
        </div>
      ) : showEmptyEdition && !hasVisibleStories ? (
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
              Matching saved stories from this week, newest first
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

      {!isTopicView && hasEditionStories && (visibleCount < editionBriefs.length || hasMore) && (
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
        </>
      )}
    </div>
  );
}
