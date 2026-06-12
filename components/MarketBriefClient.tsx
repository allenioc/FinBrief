"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Brief, MarketBriefData } from "@/lib/types";
import { getInitialMarketBriefMeta } from "@/lib/mock-refresh";
import { buildMarketBriefFromBriefs } from "@/lib/market-brief-live";
import { formatLastUpdated, formatTodayAt } from "@/lib/date-format";
import { MarketBriefPanel } from "./MarketBriefPanel";

function msUntilNextLocalMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

function dailyEditionKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `business-news-feed-${yyyy}-${mm}-${dd}`;
}

export function MarketBriefClient({ initialData }: { initialData: MarketBriefData }) {
  const [data, setData] = useState(initialData);
  const [meta, setMeta] = useState(getInitialMarketBriefMeta);
  const [articleCount, setArticleCount] = useState<number>(0);
  const isFetchingRef = useRef(false);

  const loadDailyEdition = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    const params = new URLSearchParams({
      timeRange: "week",
      limit: "20",
      page: "1",
    });
    params.set("edition", dailyEditionKey());
    try {
      const response = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        briefs: Brief[];
        fetchedAt?: string;
      };
      if (payload.briefs?.length > 0) {
        setData(buildMarketBriefFromBriefs(payload.briefs));
      }
      setArticleCount(payload.briefs?.length ?? 0);
      setMeta((prev) => ({
        refreshCount: prev.refreshCount + 1,
        lastUpdatedAt: payload.fetchedAt ?? new Date().toISOString(),
      }));
    } catch {
      // Keep showing the current data; the saved edition is already rendered.
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadDailyEdition();

    let midnightTimer: number | undefined;
    const scheduleMidnightRefresh = () => {
      midnightTimer = window.setTimeout(async () => {
        await loadDailyEdition();
        scheduleMidnightRefresh();
      }, msUntilNextLocalMidnight());
    };
    scheduleMidnightRefresh();

    return () => {
      if (midnightTimer) window.clearTimeout(midnightTimer);
    };
  }, [loadDailyEdition]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div>
          <p className="fin-label text-fin-brand">Daily Market Brief</p>
          <p className="mt-1 text-sm text-fin-subtle" suppressHydrationWarning>
            {formatTodayAt(new Date(meta.lastUpdatedAt))}
          </p>
        </div>
        <p className="text-xs text-fin-subtle">Daily market brief updates once per day.</p>
      </div>

      <p className="text-xs text-fin-subtle">
        {formatLastUpdated(meta.lastUpdatedAt)} · {articleCount} stories
      </p>

      <MarketBriefPanel data={data} updatedLabel={formatLastUpdated(meta.lastUpdatedAt)} />
    </div>
  );
}
