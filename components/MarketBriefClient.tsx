"use client";

import { useCallback, useState } from "react";
import type { MarketBriefData } from "@/lib/types";
import {
  getInitialMarketBriefMeta,
  mockRefreshDelay,
  refreshMarketBrief,
} from "@/lib/mock-refresh";
import { formatLastUpdated, formatTodayAt } from "@/lib/date-format";
import { FeedStatusBar } from "./FeedStatusBar";
import { MarketBriefPanel } from "./MarketBriefPanel";
import { RefreshFeedButton } from "./RefreshFeedButton";
import { LastUpdatedLabel } from "./LastUpdatedLabel";

export function MarketBriefClient({ initialData }: { initialData: MarketBriefData }) {
  const [data, setData] = useState(initialData);
  const [meta, setMeta] = useState(getInitialMarketBriefMeta);
  const [loading, setLoading] = useState(false);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    await mockRefreshDelay(1000);
    const result = refreshMarketBrief(meta.refreshCount);
    setData(result.data);
    setMeta(result.meta);
    setLoading(false);
  }, [meta.refreshCount]);

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
          loadingMessage="Refreshing market brief…"
          label="Refresh market brief"
        />
      </div>

      <FeedStatusBar lastUpdatedAt={meta.lastUpdatedAt} />

      {loading && (
        <p className="text-sm font-medium text-fin-brand" role="status">
          Refreshing market brief…
        </p>
      )}

      <MarketBriefPanel data={data} updatedLabel={formatLastUpdated(meta.lastUpdatedAt)} />
    </div>
  );
}
