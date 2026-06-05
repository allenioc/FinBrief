"use client";

import { useCallback, useState } from "react";
import type { Brief } from "@/lib/types";
import {
  getInitialArticleFeedMeta,
} from "@/lib/mock-refresh";
import { toTopicSlug } from "@/lib/slug";
import { ArticleCard } from "./ArticleCard";
import { FeedStatusBar } from "./FeedStatusBar";
import { RefreshFeedButton } from "./RefreshFeedButton";
import { useWatchlist } from "./WatchlistProvider";

export function DashboardFeed({
  initialBriefs,
  query,
}: {
  initialBriefs: Brief[];
  query: string;
}) {
  const [briefs, setBriefs] = useState(initialBriefs);
  const [meta, setMeta] = useState(getInitialArticleFeedMeta);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(12);
  const { items: watchlistItems } = useWatchlist();

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setStatusMessage("Refreshing live briefings…");
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    params.set("limit", "20");
    const response = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as { briefs: Brief[]; lastUpdatedAt: string };
      setBriefs(payload.briefs);
      setMeta({
        refreshCount: meta.refreshCount + 1,
        lastUpdatedAt: payload.lastUpdatedAt ?? new Date().toISOString(),
      });
      setVisibleCount(12);
    }
    setLoading(false);
    setStatusMessage(null);
  }, [query, meta.refreshCount]);

  const watchlistSymbols = watchlistItems.map((item) => item.symbol.toLowerCase());
  const displayed = briefs.slice(0, visibleCount);
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
        <FeedStatusBar lastUpdatedAt={meta.lastUpdatedAt} showRefreshHint />
        <RefreshFeedButton
          onClick={handleRefresh}
          loading={loading}
          loadingMessage="Refreshing live briefings…"
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
          <>Latest briefings across equities, ETFs, and macro topics</>
        )}
      </p>

      {displayed.length === 0 ? (
        <p className="fin-panel py-12 text-center text-sm text-fin-subtle">
          No briefings found. Try AAPL, TSLA, SPY, QQQ, inflation, or interest rates. Mock data will be used when live providers are unavailable.
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

      {visibleCount < briefs.length && (
        <div className="flex justify-center">
          <button
            type="button"
            className="fin-btn-secondary"
            onClick={() => setVisibleCount((prev) => Math.min(briefs.length, prev + 6))}
          >
            Load more stories
          </button>
        </div>
      )}
    </div>
  );
}
