"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isTopicView = query.trim().length > 0;
  const activeTab = !isTopicView && searchParams.get("tab") === "week" ? "week" : "today";

  const buildTabHref = (tab: "today" | "week") => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "week") {
      params.set("tab", "week");
    } else {
      params.delete("tab");
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="space-y-6">
      {!isTopicView && (
        <div
          className="flex flex-wrap gap-2 border-b border-fin-border pb-4"
          role="tablist"
          aria-label="Dashboard views"
        >
          <Link
            href={buildTabHref("today")}
            scroll={false}
            role="tab"
            aria-selected={activeTab === "today"}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === "today"
                ? "bg-fin-brand text-white"
                : "bg-fin-muted text-fin-subtle hover:text-fin-navy"
            }`}
          >
            Today
          </Link>
          <Link
            href={buildTabHref("week")}
            scroll={false}
            role="tab"
            aria-selected={activeTab === "week"}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              activeTab === "week"
                ? "bg-fin-brand text-white"
                : "bg-fin-muted text-fin-subtle hover:text-fin-navy"
            }`}
          >
            This Week
          </Link>
        </div>
      )}

      {activeTab === "week" && !isTopicView ? (
        <WeeklyArchiveFeed />
      ) : (
        <DashboardFeed initialBriefs={initialBriefs} query={query} />
      )}
    </div>
  );
}
