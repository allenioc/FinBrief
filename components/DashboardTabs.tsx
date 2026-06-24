"use client";

import { useSearchParams } from "next/navigation";
import { DashboardFeed } from "./DashboardFeed";
import { WeeklyArchiveFeed } from "./WeeklyArchiveFeed";
import type { Brief } from "@/lib/types";

export function DashboardTabs({
  initialBriefs,
  query,
}: {
  initialBriefs: Brief[];
  query: string;
}) {
  const searchParams = useSearchParams();
  const isTopicView = query.trim().length > 0;
  const isWeekView = !isTopicView && searchParams.get("tab") === "week";

  if (isWeekView) {
    return <WeeklyArchiveFeed />;
  }

  return <DashboardFeed initialBriefs={initialBriefs} query={query} />;
}
