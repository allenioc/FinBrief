"use client";

import { useCallback, useEffect, useState } from "react";
import type { Brief, MarketBriefData } from "@/lib/types";
import {
  getInitialMarketBriefMeta,
} from "@/lib/mock-refresh";
import { buildMarketBriefFromBriefs } from "@/lib/market-brief-live";
import { formatProviderLabel, isLiveProvider } from "@/lib/news-source";
import { formatLastUpdated, formatTodayAt } from "@/lib/date-format";
import { FeedStatusBar } from "./FeedStatusBar";
import { MarketBriefPanel } from "./MarketBriefPanel";
import { RefreshFeedButton } from "./RefreshFeedButton";
import { LastUpdatedLabel } from "./LastUpdatedLabel";

export function MarketBriefClient({ initialData }: { initialData: MarketBriefData }) {
  const [data, setData] = useState(initialData);
  const [meta, setMeta] = useState(getInitialMarketBriefMeta);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<string>("mock");

  const fetchLiveBrief = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      q: "",
      limit: "24",
      page: "1",
    });
    try {
      const response = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        briefs: Brief[];
        provider?: string;
        lastUpdatedAt?: string;
      };
      if (payload.briefs?.length > 0) {
        setData(buildMarketBriefFromBriefs(payload.briefs));
      }
      setProvider(payload.provider ?? "mock");
      setMeta((prev) => ({
        refreshCount: prev.refreshCount + 1,
        lastUpdatedAt: payload.lastUpdatedAt ?? new Date().toISOString(),
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLiveBrief();
  }, [fetchLiveBrief]);

  const handleRefresh = useCallback(async () => {
    await fetchLiveBrief();
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
          loadingMessage="Refreshing live market brief…"
          label="Refresh market brief"
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

      <FeedStatusBar lastUpdatedAt={meta.lastUpdatedAt} />

      {loading && (
        <p className="text-sm font-medium text-fin-brand" role="status">
          Refreshing market brief from /api/news…
        </p>
      )}

      <MarketBriefPanel data={data} updatedLabel={formatLastUpdated(meta.lastUpdatedAt)} />
    </div>
  );
}
