"use client";

import { useCallback, useEffect, useState } from "react";
import type { Brief, MarketBriefData } from "@/lib/types";
import {
  getInitialMarketBriefMeta,
} from "@/lib/mock-refresh";
import { buildMarketBriefFromBriefs } from "@/lib/market-brief-live";
import { BROAD_NEWS_QUERY } from "@/lib/news-constants";
import { formatProviderLabel, isLiveProvider } from "@/lib/news-source";
import { formatLastUpdated, formatTodayAt } from "@/lib/date-format";
import { MarketBriefPanel } from "./MarketBriefPanel";
import { RefreshFeedButton } from "./RefreshFeedButton";
import { LastUpdatedLabel } from "./LastUpdatedLabel";

export function MarketBriefClient({ initialData }: { initialData: MarketBriefData }) {
  const [data, setData] = useState(initialData);
  const [meta, setMeta] = useState(getInitialMarketBriefMeta);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<string>("mock");
  const [articleCount, setArticleCount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchLiveBrief = useCallback(async (manual = false) => {
    setLoading(true);
    if (manual) setStatusMessage("Checking for newer stories…");
    const params = new URLSearchParams({
      q: BROAD_NEWS_QUERY,
      limit: "20",
      page: "1",
    });
    if (manual) params.set("fresh", Date.now().toString());
    try {
      const response = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        briefs: Brief[];
        provider?: string;
        fetchedAt?: string;
      };
      const prevTop = data.topStories.map((story) => story.id).join("|");
      const nextTop = payload.briefs.slice(0, 5).map((story) => story.id).join("|");
      if (payload.briefs?.length > 0) {
        setData(buildMarketBriefFromBriefs(payload.briefs));
      }
      setArticleCount(payload.briefs?.length ?? 0);
      setProvider(payload.provider ?? "mock");
      setMeta((prev) => ({
        refreshCount: prev.refreshCount + 1,
        lastUpdatedAt: payload.fetchedAt ?? new Date().toISOString(),
      }));
      if (manual) setStatusMessage(prevTop === nextTop ? "You're up to date." : "Stories updated.");
    } finally {
      setLoading(false);
      if (manual) window.setTimeout(() => setStatusMessage(null), 1800);
    }
  }, [data.topStories]);

  useEffect(() => {
    fetchLiveBrief();
  }, [fetchLiveBrief]);

  const handleRefresh = useCallback(async () => {
    await fetchLiveBrief(true);
  }, [fetchLiveBrief]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <p className="fin-label text-fin-brand">Daily Market Brief</p>
          <p className="mt-1 text-sm text-fin-subtle" suppressHydrationWarning>
            {formatTodayAt(new Date(meta.lastUpdatedAt))}
          </p>
          <LastUpdatedLabel iso={meta.lastUpdatedAt} prefix="Feed refreshed" className="text-sm text-fin-subtle" />
        </div>
        <RefreshFeedButton
          onClick={handleRefresh}
          loading={loading}
          loadingMessage="Checking for newer stories…"
          label="Refresh stories"
        />
      </div>

      <div
        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
          isLiveProvider(provider)
            ? "bg-status-positive-bg text-status-positive"
            : "bg-status-warning-bg text-status-warning"
        }`}
      >
        {isLiveProvider(provider) ? `Live feed: ${formatProviderLabel(provider)}` : "Mock fallback"}
      </div>
      <p className="text-xs text-fin-subtle">
        {formatLastUpdated(meta.lastUpdatedAt)} · {articleCount} stories
      </p>
      <p className="text-xs text-fin-subtle">
        Last updated: {formatLastUpdated(meta.lastUpdatedAt)}
      </p>

      {statusMessage && (
        <p className="text-sm font-medium text-fin-brand" role="status">
          {statusMessage}
        </p>
      )}

      {loading && !statusMessage && (
        <p className="text-sm font-medium text-fin-brand" role="status">
          Refreshing market brief from /api/news…
        </p>
      )}

      <MarketBriefPanel data={data} updatedLabel={formatLastUpdated(meta.lastUpdatedAt)} />
    </div>
  );
}
