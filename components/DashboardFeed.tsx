"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatLastUpdated } from "@/lib/date-format";
import { friendlyEditionError } from "@/lib/user-messages";
import { DAILY_EDITION_ARTICLE_LIMIT, TOPIC_STORIES_MAX } from "@/lib/news-constants";
import { dailyEditionRequestKey } from "@/lib/daily-edition-client";
import { restoreDashboardScroll } from "@/lib/dashboard-scroll-restore";
import { buildDashboardSections } from "@/lib/dashboard-sections";
import { filterBriefsForTopic, findWatchlistItemForQuery } from "@/lib/topic-stories";
import { toTopicSlug } from "@/lib/slug";
import type { Brief } from "@/lib/types";
import { useDailyEdition } from "./DailyEditionProvider";
import { useWatchlist } from "./WatchlistProvider";
import { ArticleCard } from "./ArticleCard";

export function DashboardFeed({
  initialBriefs,
  query,
}: {
  initialBriefs: Brief[];
  query: string;
}) {
  const {
    editionBriefs,
    ready,
    syncing,
    fetchedAt,
    hasMore,
    page,
    debug,
    hydrateFromServer,
    appendPage,
  } = useDailyEdition();
  const { items: watchlistItems } = useWatchlist();

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [apiError, setApiError] = useState<string | null>(null);
  const topicQuery = query.trim();
  const isTopicView = topicQuery.length > 0;

  useEffect(() => {
    hydrateFromServer(initialBriefs);
  }, [hydrateFromServer, initialBriefs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    restoreDashboardScroll();
  }, [ready, editionBriefs.length, topicQuery]);

  const followedTopic = useMemo(
    () => (isTopicView ? findWatchlistItemForQuery(watchlistItems, topicQuery) : undefined),
    [isTopicView, topicQuery, watchlistItems]
  );

  const topicStories = useMemo(
    () =>
      isTopicView ? filterBriefsForTopic(editionBriefs, topicQuery, TOPIC_STORIES_MAX, followedTopic) : [],
    [editionBriefs, followedTopic, isTopicView, topicQuery]
  );

  const { sections: groupedSections, layoutDebug } = buildDashboardSections(editionBriefs);
  const hasEditionStories = editionBriefs.length > 0;
  const hasVisibleStories = isTopicView
    ? topicStories.length > 0
    : groupedSections.some((section) => section.stories.length > 0);
  const showStories = hasEditionStories && (ready || hasVisibleStories);
  const showLoading = !showStories && !ready && syncing;
  const dataSource = isTopicView ? "topic_filter" : debug.source;
  const savedArticleCount = debug.savedArticleCount || editionBriefs.length;
  const renderedTopStoryCount = isTopicView ? topicStories.length : layoutDebug.topStoriesCount;

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
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-fin-subtle">
          <span className="font-semibold text-fin-navy">Daily edition</span>
          <span>{formatLastUpdated(fetchedAt ?? new Date().toISOString())}</span>
          <span>
            {isTopicView
              ? `${topicStories.length} topic ${topicStories.length === 1 ? "story" : "stories"}`
              : `${editionBriefs.length} stories`}
          </span>
          <span
            className="text-[11px] text-fin-subtle"
            data-layout-debug
            title="Dashboard layout debug"
          >
            source {dataSource} · saved {savedArticleCount} · top {renderedTopStoryCount}
            {!isTopicView &&
              ` · dedup ${layoutDebug.rawArticleCount}→${layoutDebug.dedupedArticleCount} (−${layoutDebug.duplicatesRemoved}) · imageUrl ${debug.articlesWithImageUrl}`}
          </span>
        </div>
        <p className="text-xs text-fin-subtle">
          Daily edition updates once per day.
          {syncing && hasEditionStories ? " Syncing in background…" : ""}
        </p>
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

      {showLoading ? (
        <p className="fin-panel py-12 text-center text-sm text-fin-subtle">Loading stories...</p>
      ) : isTopicView && topicStories.length === 0 && hasEditionStories ? (
        <div className="fin-panel py-12 text-center">
          <p className="text-sm font-medium text-fin-navy">No stories for {topicQuery} in today&apos;s edition</p>
          <p className="mt-2 text-sm text-fin-subtle">
            This topic has no matching stories in the current daily edition. Check back after the next update or
            browse another topic.
          </p>
        </div>
      ) : !hasVisibleStories && !hasEditionStories ? (
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
    </div>
  );
}
