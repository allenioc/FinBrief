/** Shared daily-edition helpers for server routes and client cache upgrades. */

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
      cacheStatus === "live_fetch_saved_as_todays_edition" || cacheStatus?.startsWith("hit:")
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
