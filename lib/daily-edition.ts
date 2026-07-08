/** Shared daily-edition helpers for server routes and client cache upgrades. */

import { DAILY_EDITION_REPLACEMENT_MIN, SUCCESS_FETCH_COOLDOWN_MS } from "./news-constants";

export { SUCCESS_FETCH_COOLDOWN_MS, DAILY_EDITION_REPLACEMENT_MIN };

export function dateKeyFromFetchedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isEditionFetchedOnDate(
  fetchedAt: string | null | undefined,
  dateKey: string
): boolean {
  return dateKeyFromFetchedAt(fetchedAt) === dateKey;
}

/** Saved edition counts as today's only when both the edition date and fetch time are today. */
export function isFreshSavedEditionForToday(input: {
  editionDate: string;
  fetchedAt: string | null | undefined;
  today: string;
}): boolean {
  const { editionDate, fetchedAt, today } = input;
  return editionDate === today && isEditionFetchedOnDate(fetchedAt, today);
}


export function isWithinSuccessFetchCooldown(
  fetchedAt: string | null | undefined,
  todayKey: string
): boolean {
  if (!fetchedAt) return false;
  if (dateKeyFromFetchedAt(fetchedAt) !== todayKey) return false;
  const ms = Date.now() - new Date(fetchedAt).getTime();
  return ms >= 0 && ms < SUCCESS_FETCH_COOLDOWN_MS;
}

export function msSinceFetchedAt(fetchedAt: string | null | undefined): number {
  if (!fetchedAt) return Number.POSITIVE_INFINITY;
  const ms = Date.now() - new Date(fetchedAt).getTime();
  return Number.isFinite(ms) && ms >= 0 ? ms : Number.POSITIVE_INFINITY;
}

export function isLiveEditionProvider(provider?: string | null): boolean {
  return Boolean(provider && provider !== "mock" && provider !== "error");
}

export function editionStoryCount(payload: {
  briefs?: { length: number };
  articleCount?: number;
}): number {
  if (Array.isArray(payload.briefs)) return payload.briefs.length;
  return payload.articleCount ?? 0;
}

export function isLiveEditionPayload(payload: {
  provider?: string;
  articleCount?: number;
  briefs?: { length: number };
}): boolean {
  return isLiveEditionProvider(payload.provider) && editionStoryCount(payload) > 0;
}

/** Strong enough to replace or establish today's saved daily edition. */
export function isStrongEditionPayload(
  payload: {
    provider?: string;
    articleCount?: number;
    briefs?: { length: number };
  },
  minimum = DAILY_EDITION_REPLACEMENT_MIN
): boolean {
  return isLiveEditionProvider(payload.provider) && editionStoryCount(payload) >= minimum;
}

/** Decide whether a live provider response may overwrite cached daily editions. */
export function shouldPersistLiveEditionFetch(
  incoming: {
    provider?: string;
    articleCount?: number;
    briefs?: { length: number };
  },
  existingStoryCount: number,
  minimum = DAILY_EDITION_REPLACEMENT_MIN
): boolean {
  const incomingCount = editionStoryCount(incoming);
  if (!isLiveEditionProvider(incoming.provider) || incomingCount === 0) return false;

  if (incomingCount < minimum) {
    return existingStoryCount < minimum;
  }

  if (existingStoryCount >= minimum) {
    return incomingCount >= existingStoryCount;
  }

  return true;
}

/**
 * Daily edition save rule when today does not yet have a fresh live fetch.
 * Accepts a strong enough fetch even if it is smaller than a prior day's lastGood edition.
 */
export function shouldPersistNewDayEditionFetch(
  incoming: {
    provider?: string;
    articleCount?: number;
    briefs?: { length: number };
  },
  hasFreshSavedEditionForToday: boolean,
  minimum = DAILY_EDITION_REPLACEMENT_MIN
): boolean {
  if (hasFreshSavedEditionForToday) return false;
  const incomingCount = editionStoryCount(incoming);
  return isLiveEditionProvider(incoming.provider) && incomingCount >= minimum;
}

export function isFallbackCacheStatus(cacheStatus?: string, provider?: string): boolean {
  if (provider === "mock" || provider === "error") return true;
  if (!cacheStatus) return true;
  return (
    cacheStatus.includes("mock") ||
    cacheStatus.includes("stale_fallback") ||
    cacheStatus === "server_hydrate"
  );
}

export function isLiveCacheStatus(cacheStatus?: string, provider?: string): boolean {
  return (
    isLiveEditionProvider(provider) &&
    Boolean(
      cacheStatus === "live_fetch_saved_as_todays_edition" ||
      cacheStatus?.startsWith("hit:") ||
      cacheStatus?.startsWith("lastgood:") ||
      cacheStatus?.startsWith("cooldown:")
    )
  );
}

export function shouldUpgradeEdition(input: {
  currentBriefIds: string;
  nextBriefIds: string;
  currentBriefCount?: number;
  nextBriefCount?: number;
  currentCacheStatus?: string;
  currentProvider?: string;
  nextCacheStatus?: string;
  nextProvider?: string;
  currentFetchedAt?: string | null;
  nextFetchedAt?: string | null;
  todayKey?: string;
}): boolean {
  const {
    currentBriefIds,
    nextBriefIds,
    currentBriefCount = 0,
    nextBriefCount = 0,
    currentCacheStatus,
    currentProvider,
    nextCacheStatus,
    nextProvider,
    currentFetchedAt,
    nextFetchedAt,
    todayKey,
  } = input;

  if (todayKey) {
    const currentFetchedToday = isEditionFetchedOnDate(currentFetchedAt, todayKey);
    const nextFetchedToday = isEditionFetchedOnDate(nextFetchedAt, todayKey);
    if (!currentFetchedToday && nextFetchedToday && nextBriefCount > 0) {
      return true;
    }
    if (currentFetchedToday && !nextFetchedToday) {
      return false;
    }
  }

  if (!currentBriefIds) return nextBriefCount >= DAILY_EDITION_REPLACEMENT_MIN || nextBriefCount > 0;

  if (
    currentBriefCount >= DAILY_EDITION_REPLACEMENT_MIN &&
    nextBriefCount < DAILY_EDITION_REPLACEMENT_MIN
  ) {
    return false;
  }

  if (
    currentBriefCount >= DAILY_EDITION_REPLACEMENT_MIN &&
    nextBriefCount >= DAILY_EDITION_REPLACEMENT_MIN &&
    nextBriefCount < currentBriefCount
  ) {
    return false;
  }

  if (
    isFallbackCacheStatus(currentCacheStatus, currentProvider) &&
    isLiveCacheStatus(nextCacheStatus, nextProvider)
  ) {
    return nextBriefCount >= DAILY_EDITION_REPLACEMENT_MIN || currentBriefCount < DAILY_EDITION_REPLACEMENT_MIN;
  }
  if (
    isLiveCacheStatus(currentCacheStatus, currentProvider) &&
    isFallbackCacheStatus(nextCacheStatus, nextProvider)
  ) {
    return false;
  }
  return currentBriefIds !== nextBriefIds;
}
