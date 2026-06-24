"use client";

import type { Brief } from "@/lib/types";
import { ArticleCard } from "./ArticleCard";
import { useWeeklyArchive } from "./useWeeklyArchive";

const EMPTY_STATE_MESSAGE =
  "This week's archive is empty for now. As new daily editions are saved, their stories will appear here automatically.";

function WeeklyArchiveSkeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-hidden="true">
      <div className="flex gap-3">
        <div className="h-3 w-28 rounded bg-fin-muted" />
        <div className="h-3 w-36 rounded bg-fin-muted" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="fin-card h-72 rounded-panel bg-fin-muted" />
        ))}
      </div>
    </div>
  );
}

export function WeeklyArchiveFeed() {
  const { archive, briefs: weeklyStories, loading, error, weekLabel } = useWeeklyArchive(true);
  const storyCount = archive?.storyCount ?? 0;

  if (loading) {
    return <WeeklyArchiveSkeleton />;
  }

  if (error && storyCount === 0) {
    return (
      <div className="fin-panel py-12 text-center">
        <p className="text-sm font-medium text-fin-navy">{error}</p>
        <p className="mt-2 text-sm text-fin-subtle">{EMPTY_STATE_MESSAGE}</p>
      </div>
    );
  }

  if (!archive || storyCount === 0) {
    return (
      <div className="fin-panel py-12 text-center">
        <p className="text-sm text-fin-subtle">{EMPTY_STATE_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-fin-subtle">
          <span className="font-semibold text-fin-navy">Weekly archive</span>
          <span>{weekLabel}</span>
          <span>
            {storyCount} {storyCount === 1 ? "story" : "stories"}
          </span>
        </div>
        <p className="text-xs text-fin-subtle">Saved daily editions only · resets each Sunday</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {weeklyStories.map((brief: Brief, index) => (
          <ArticleCard
            key={brief.id}
            article={brief}
            variant={index === 0 ? "hero" : "compact"}
            priorityImage={index === 0}
          />
        ))}
      </div>
    </div>
  );
}
