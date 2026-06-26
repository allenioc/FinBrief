import { isLiveEditionPayload } from "./daily-edition";
import { BROAD_NEWS_QUERY, DAILY_EDITION_ARTICLE_LIMIT } from "./news-constants";
import { cacheGet } from "./news-cache";
import type { Brief } from "./types";
import { saveDailyEditionForWeek } from "./weekly-archive-store";

type RollingEditionRecord = {
  editionDate: string;
  payload: {
    briefs: Brief[];
    provider?: string;
    articleCount?: number;
  };
};

function broadEditionCacheKey(): string {
  const queryKey = BROAD_NEWS_QUERY.toLowerCase();
  return `edition::${queryKey}::week::${DAILY_EDITION_ARTICLE_LIMIT}::1`;
}

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
