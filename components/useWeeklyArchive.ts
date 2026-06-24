"use client";

import { useEffect, useMemo, useState } from "react";
import { formatWeekLabel, weekKeyFromDate, type WeeklyArchivePayload } from "@/lib/weekly-archive";
import type { Brief } from "@/lib/types";

const WEEKLY_CACHE_PREFIX = "finbrief-weekly-archive";

function readLocalWeekCache(weekKey: string): WeeklyArchivePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${WEEKLY_CACHE_PREFIX}::${weekKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WeeklyArchivePayload;
    return parsed.weekKey === weekKey ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocalWeekCache(payload: WeeklyArchivePayload): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${WEEKLY_CACHE_PREFIX}::${payload.weekKey}`, JSON.stringify(payload));
  } catch {
    // Storage may be unavailable in private mode.
  }
}

function preferRicherArchive(
  primary: WeeklyArchivePayload,
  fallback: WeeklyArchivePayload | null
): WeeklyArchivePayload {
  if (!fallback || fallback.weekKey !== primary.weekKey) return primary;
  if (primary.storyCount >= fallback.storyCount) return primary;
  return fallback;
}

export function useWeeklyArchive(enabled: boolean = true) {
  const [archive, setArchive] = useState<WeeklyArchivePayload | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const weekKey = weekKeyFromDate();

    const load = async () => {
      setLoading(true);
      setError(null);
      const localCache = readLocalWeekCache(weekKey);

      try {
        const response = await fetch("/api/weekly-archive");
        if (!response.ok) {
          throw new Error("Could not load weekly archive.");
        }
        const payload = (await response.json()) as WeeklyArchivePayload;
        const resolved =
          payload.storyCount > 0
            ? preferRicherArchive(payload, localCache)
            : localCache && localCache.weekKey === weekKey
              ? localCache
              : payload;
        if (!cancelled) {
          if (resolved.storyCount > 0) {
            writeLocalWeekCache(resolved);
          }
          setArchive(resolved);
        }
      } catch {
        if (!cancelled) {
          if (localCache?.storyCount) {
            setArchive(localCache);
            setError(null);
          } else {
            setError("Could not load weekly archive.");
            setArchive(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const briefs = useMemo<Brief[]>(
    () => archive?.days.flatMap((day) => day.stories) ?? [],
    [archive]
  );

  return {
    archive,
    briefs,
    loading,
    error,
    weekLabel: archive?.weekLabel ?? formatWeekLabel(),
  };
}
