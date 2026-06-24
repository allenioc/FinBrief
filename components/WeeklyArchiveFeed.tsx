"use client";

import { useEffect, useState } from "react";
import {
  buildWeeklyArchiveFromBriefs,
  formatWeekLabel,
  type WeeklyArchivePayload,
} from "@/lib/weekly-archive";
import type { Brief } from "@/lib/types";
import { useDailyEdition } from "./DailyEditionProvider";
import { ArticleCard } from "./ArticleCard";

export function WeeklyArchiveFeed() {
  const { editionBriefs, ready: editionReady } = useDailyEdition();
  const [archive, setArchive] = useState<WeeklyArchivePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/weekly-archive");
        if (!response.ok) {
          throw new Error("Could not load weekly archive.");
        }
        const payload = (await response.json()) as WeeklyArchivePayload;
        if (!cancelled) setArchive(payload);
      } catch {
        if (!cancelled) {
          setError("Could not load weekly archive.");
          setArchive(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!editionReady || editionBriefs.length === 0) return;
    setArchive((prev) => {
      if (prev && prev.storyCount > 0) return prev;
      return buildWeeklyArchiveFromBriefs(editionBriefs);
    });
  }, [editionBriefs, editionReady]);

  const weekLabel = archive?.weekLabel ?? formatWeekLabel();
  const storyCount = archive?.storyCount ?? 0;

  if (loading && !archive) {
    return (
      <p className="fin-panel py-12 text-center text-sm text-fin-subtle">Loading this week&apos;s archive…</p>
    );
  }

  if (error && !archive) {
    return (
      <div className="fin-panel py-12 text-center">
        <p className="text-sm font-medium text-fin-navy">{error}</p>
        <p className="mt-2 text-sm text-fin-subtle">
          Weekly archive uses saved daily editions only. Check back after today&apos;s edition is saved.
        </p>
      </div>
    );
  }

  if (!archive || storyCount === 0) {
    return (
      <div className="fin-panel py-12 text-center">
        <p className="text-sm font-medium text-fin-navy">No saved editions this week yet</p>
        <p className="mt-2 text-sm text-fin-subtle">
          Stories appear here as each daily edition is saved. The archive starts fresh each Sunday and never
          calls live news providers.
        </p>
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
          {archive.duplicatesRemoved > 0 && (
            <span>Deduplicated {archive.duplicatesRemoved} repeat stories</span>
          )}
        </div>
        <p className="text-xs text-fin-subtle">Saved daily editions only · resets each Sunday</p>
      </div>

      <div className="space-y-10">
        {archive.days.map((day) => (
          <section key={day.editionDate} className="space-y-4">
            <div>
              <h3 className="fin-section-title">{day.label}</h3>
              <p className="text-sm text-fin-subtle">
                {day.stories.length} saved {day.stories.length === 1 ? "story" : "stories"} from this edition
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {day.stories.map((brief: Brief, index) => (
                <ArticleCard
                  key={`${day.editionDate}-${brief.id}`}
                  article={brief}
                  variant={index === 0 ? "hero" : "compact"}
                  priorityImage={index === 0}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
