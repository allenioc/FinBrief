import { isLiveEditionPayload } from "./daily-edition";
import { cacheGet } from "./news-cache";
import type { Brief } from "./types";
import { broadEditionCacheKey } from "./weekly-archive";
import { saveDailyEditionForWeek } from "./weekly-archive-store";

type RollingEditionRecord = {
  editionDate: string;
  payload: {
    briefs: Brief[];
    provider?: string;
    articleCount?: number;
  };
};

/**
 * Mirror the rolling broad daily edition cache into dated weekly buckets.
 * Safe to call on cache hits and weekly reads — never calls live providers.
 * Ensures prior calendar days survive when today's edition replaces the rolling key.
 */
export async function mirrorRollingBroadEditionToWeek(): Promise<void> {
  const saved = await cacheGet<RollingEditionRecord>(broadEditionCacheKey());
  if (!saved?.value || !isLiveEditionPayload(saved.value.payload)) return;

  const { editionDate, payload } = saved.value;
  if (!editionDate || payload.briefs.length === 0) return;

  await saveDailyEditionForWeek(editionDate, payload.briefs);
}
