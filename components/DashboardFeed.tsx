"use client";

import { useCallback, useState } from "react";
import type { Brief } from "@/lib/types";
import {
  getInitialArticleFeedMeta,
  mockRefreshDelay,
  refreshArticleFeed,
} from "@/lib/mock-refresh";
import { ArticleCard } from "./ArticleCard";
import { FeedStatusBar } from "./FeedStatusBar";
import { RefreshFeedButton } from "./RefreshFeedButton";

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

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setStatusMessage("Refreshing market brief…");
    await mockRefreshDelay();
    const result = refreshArticleFeed(query, meta.refreshCount);
    setBriefs(result.briefs);
    setMeta(result.meta);
    setLoading(false);
    setStatusMessage(null);
  }, [query, meta.refreshCount]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <FeedStatusBar lastUpdatedAt={meta.lastUpdatedAt} showRefreshHint />
        <RefreshFeedButton
          onClick={handleRefresh}
          loading={loading}
          loadingMessage="Refreshing market brief…"
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

      {briefs.length === 0 ? (
        <p className="fin-panel py-12 text-center text-sm text-fin-subtle">
          No briefings found. Try AAPL, TSLA, SPY, QQQ, inflation, or interest rates.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {briefs.map((brief, index) => (
            <ArticleCard
              key={`${brief.id}-${meta.refreshCount}`}
              article={brief}
              variant={index === 0 && !query ? "hero" : "standard"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
