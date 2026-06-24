"use client";

import { useEffect, useMemo, useState } from "react";
import { readEditionSnapshot } from "@/lib/daily-edition-client";
import {
  buildWeeklyArchiveFromBriefs,
  formatWeekLabel,
  isDateKeyInCurrentWeek,
  type WeeklyArchivePayload,
} from "@/lib/weekly-archive";
import type { Brief } from "@/lib/types";

function trustedSnapshotArchive(): WeeklyArchivePayload | null {
  const snapshot = readEditionSnapshot();
  if (!snapshot?.briefs.length) return null;
  if (!isDateKeyInCurrentWeek(snapshot.editionDateKey)) return null;
  return buildWeeklyArchiveFromBriefs(snapshot.briefs, snapshot.editionDateKey);
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
          const snapshotArchive = trustedSnapshotArchive();
          if (snapshotArchive?.storyCount) {
            setArchive(snapshotArchive);
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
