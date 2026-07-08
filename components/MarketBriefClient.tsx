"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Brief, MarketBriefData, MarketSnapshotPayload } from "@/lib/types";
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

export function MarketBriefClient({
  initialData,
  initialSnapshot,
}: {
  initialData: MarketBriefData;
  initialSnapshot: MarketSnapshotPayload | null;
}) {
  const [data, setData] = useState(initialData);
  const [snapshot, setSnapshot] = useState<MarketSnapshotPayload | null>(initialSnapshot);
  const [meta, setMeta] = useState(getInitialMarketBriefMeta);
  const [articleCount, setArticleCount] = useState<number>(0);
  const isFetchingRef = useRef(false);

  const applyBriefs = useCallback(
    (briefs: Brief[], fetchedAt?: string, nextSnapshot?: MarketSnapshotPayload | null) => {
      const activeSnapshot = nextSnapshot ?? snapshot;
      if (briefs.length > 0) {
        setData(buildMarketBriefFromBriefs(briefs, activeSnapshot));
      } else if (activeSnapshot) {
        setData(buildMarketBriefFromBriefs([], activeSnapshot));
      }
      setArticleCount(briefs.length);
      if (fetchedAt) {
        setMeta((prev) => ({
          refreshCount: prev.refreshCount + 1,
          lastUpdatedAt: fetchedAt,
        }));
      }
    },
    [snapshot]
  );

  const loadMarketSnapshot = useCallback(async () => {
    try {
      const response = await fetch("/api/market-snapshot", { cache: "no-store" });
      if (!response.ok) return null;
      const payload = (await response.json()) as MarketSnapshotPayload;
      setSnapshot(payload);
      return payload;
    } catch {
      return null;
    }
  }, []);

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
      const [newsResponse, nextSnapshot] = await Promise.all([
        fetch(`/api/news?${params.toString()}`, { cache: "no-store" }),
        loadMarketSnapshot(),
      ]);

      if (newsResponse.ok) {
        const payload = (await newsResponse.json()) as {
          briefs?: Brief[];
          fetchedAt?: string;
        };
        applyBriefs(payload.briefs ?? [], payload.fetchedAt, nextSnapshot);
      } else if (nextSnapshot) {
        applyBriefs([], undefined, nextSnapshot);
      }
    } catch {
      // Keep current panel data on failure.
    } finally {
      isFetchingRef.current = false;
    }
  }, [applyBriefs, loadMarketSnapshot]);

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
          <p className="fin-label text-fin-brand">Daily Market Risk Brief</p>
          <p className="mt-1 text-sm text-fin-subtle" suppressHydrationWarning>
            {formatTodayAt(new Date(meta.lastUpdatedAt))}
          </p>
        </div>
        <p className="text-xs text-fin-subtle">Headlines refresh daily · market levels refresh about every 20 minutes.</p>
      </div>

      <p className="text-xs text-fin-subtle">
        {formatLastUpdated(meta.lastUpdatedAt)} · {articleCount} stories
      </p>

      <MarketBriefPanel
        data={data}
        updatedLabel={formatLastUpdated(meta.lastUpdatedAt)}
        snapshotLabel={
          data.marketSnapshotFetchedAt
            ? `Market snapshot ${formatLastUpdated(data.marketSnapshotFetchedAt)}`
            : undefined
        }
      />
    </div>
  );
}
