/** Shared daily-edition helpers for server routes and client cache upgrades. */

import { SUCCESS_FETCH_COOLDOWN_MS } from "./news-constants";

export { SUCCESS_FETCH_COOLDOWN_MS };

export function dateKeyFromFetchedAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

export function isLiveEditionPayload(payload: {
  provider?: string;
  articleCount?: number;
}): boolean {
  return isLiveEditionProvider(payload.provider) && (payload.articleCount ?? 0) > 0;
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
  currentCacheStatus?: string;
  currentProvider?: string;
  nextCacheStatus?: string;
  nextProvider?: string;
}): boolean {
  const {
    currentBriefIds,
    nextBriefIds,
    currentCacheStatus,
    currentProvider,
    nextCacheStatus,
    nextProvider,
  } = input;

  if (!currentBriefIds) return true;
  if (
    isFallbackCacheStatus(currentCacheStatus, currentProvider) &&
    isLiveCacheStatus(nextCacheStatus, nextProvider)
  ) {
    return true;
  }
  if (
    isLiveCacheStatus(currentCacheStatus, currentProvider) &&
    isFallbackCacheStatus(nextCacheStatus, nextProvider)
  ) {
    return false;
  }
  return currentBriefIds !== nextBriefIds;
}
