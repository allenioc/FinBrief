"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildWeeklyArchiveFromBriefs,
  formatWeekLabel,
  type WeeklyArchivePayload,
} from "@/lib/weekly-archive";
import { readEditionSnapshot } from "@/lib/daily-edition-client";
import type { Brief } from "@/lib/types";
import { useDailyEdition } from "./DailyEditionProvider";
import { ArticleCard } from "./ArticleCard";

function snapshotArchive(): WeeklyArchivePayload | null {
  const snapshot = readEditionSnapshot();
  if (!snapshot?.briefs.length) return null;
  return buildWeeklyArchiveFromBriefs(snapshot.briefs, snapshot.editionDateKey);
}

export function WeeklyArchiveFeed() {
  const { editionBriefs, ready: editionReady } = useDailyEdition();
  const clientArchive = useMemo(() => {
    const fromSnapshot = snapshotArchive();
    if (fromSnapshot?.storyCount) return fromSnapshot;
    if (editionBriefs.length > 0) {
      return buildWeeklyArchiveFromBriefs(editionBriefs);
    }
    return null;
  }, [editionBriefs]);

  const [archive, setArchive] = useState<WeeklyArchivePayload | null>(() => clientArchive);
  const [loading, setLoading] = useState(() => !clientArchive);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clientArchive?.storyCount) {
      setArchive((prev) => (prev && prev.storyCount >= clientArchive.storyCount ? prev : clientArchive));
      setLoading(false);
    }
  }, [clientArchive]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!clientArchive) setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/weekly-archive");
        if (!response.ok) {
          throw new Error("Could not load weekly archive.");
        }
        const payload = (await response.json()) as WeeklyArchivePayload;
        if (cancelled) return;
        if (payload.storyCount > 0) {
          setArchive(payload);
        } else {
          setArchive((prev) => prev ?? clientArchive ?? payload);
        }
      } catch {
        if (cancelled) return;
        if (!clientArchive) {
          setError("Could not load weekly archive.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [clientArchive]);

  useEffect(() => {
    if (!editionReady || editionBriefs.length === 0) return;
    const derived = buildWeeklyArchiveFromBriefs(editionBriefs);
    if (derived.storyCount === 0) return;
    setArchive((prev) => {
      if (prev && prev.storyCount >= derived.storyCount) return prev;
      return derived;
    });
    setLoading(false);
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
          Weekly archive uses saved daily editions only. It will populate as daily editions are saved.
        </p>
      </div>
    );
  }

  if (!archive || storyCount === 0) {
    return (
      <div className="fin-panel py-12 text-center">
        <p className="text-sm font-medium text-fin-navy">No saved stories this week yet</p>
        <p className="mt-2 text-sm text-fin-subtle">
          The archive will populate as daily editions are saved. It starts fresh each Sunday and never calls live
          news providers.
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
