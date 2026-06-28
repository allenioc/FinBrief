import { EXPLANATION_COPY_VERSION } from "./article-brief-quality";

/** Tracks the last Article Brief explanation cache migration applied in this browser. */
export const EXPLANATION_CACHE_MIGRATION_KEY = "finbrief-explanation-cache-version";

const DAILY_EDITION_PREFIX = "finbrief-daily-edition";
const WEEKLY_ARCHIVE_PREFIX = "finbrief-weekly-archive";
const ARTICLE_SESSION_PREFIX = "finbrief-article-";

type StorageLike = Pick<Storage, "length" | "key" | "getItem" | "removeItem">;

function isStaleExplanationVersion(version: unknown): boolean {
  return typeof version !== "number" || version < EXPLANATION_COPY_VERSION;
}

function purgeMatchingKeys(storage: StorageLike, prefix: string): void {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    storage.removeItem(key);
  }
}

function purgeDailyEditionStorage(storage: StorageLike): void {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key?.startsWith(DAILY_EDITION_PREFIX)) continue;
    try {
      const parsed = JSON.parse(storage.getItem(key) ?? "null") as { explanationVersion?: number };
      if (isStaleExplanationVersion(parsed?.explanationVersion)) {
        storage.removeItem(key);
      }
    } catch {
      storage.removeItem(key);
    }
  }
}

function purgeWeeklyArchiveStorage(storage: StorageLike): void {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key?.startsWith(WEEKLY_ARCHIVE_PREFIX)) continue;
    try {
      const parsed = JSON.parse(storage.getItem(key) ?? "null") as { explanationVersion?: number };
      if (isStaleExplanationVersion(parsed?.explanationVersion)) {
        storage.removeItem(key);
      }
    } catch {
      storage.removeItem(key);
    }
  }
}

/** Remove all Article Brief navigation stashes (session + local). */
export function purgeAllArticleBriefSessionStashes(): void {
  if (typeof window === "undefined") return;
  purgeMatchingKeys(window.sessionStorage, ARTICLE_SESSION_PREFIX);
  purgeMatchingKeys(window.localStorage, ARTICLE_SESSION_PREFIX);
}

/** Drop stale explanation snapshot blobs from browser storage. */
export function purgeStaleExplanationSnapshotStorage(): void {
  if (typeof window === "undefined") return;
  purgeDailyEditionStorage(window.localStorage);
  purgeDailyEditionStorage(window.sessionStorage);
  purgeWeeklyArchiveStorage(window.localStorage);
  purgeAllArticleBriefSessionStashes();
}

/**
 * Run once per EXPLANATION_COPY_VERSION bump.
 * Only touches FinBrief explanation/article snapshot keys — not watchlists or unrelated settings.
 */
export function migrateArticleBriefExplanationCache(): boolean {
  if (typeof window === "undefined") return false;

  const current = String(EXPLANATION_COPY_VERSION);
  const stored = window.localStorage.getItem(EXPLANATION_CACHE_MIGRATION_KEY);
  if (stored === current) return false;

  purgeAllArticleBriefSessionStashes();
  purgeStaleExplanationSnapshotStorage();

  window.localStorage.setItem(EXPLANATION_CACHE_MIGRATION_KEY, current);
  return true;
}

/** Article Brief pages must never reuse cached explanation copy from session/local stashes. */
export function clearArticleBriefSessionStash(articleId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`${ARTICLE_SESSION_PREFIX}${articleId}`);
  window.localStorage.removeItem(`${ARTICLE_SESSION_PREFIX}${articleId}`);
}

export function isTrustedExplanationVersion(version: unknown): boolean {
  return !isStaleExplanationVersion(version);
}

/** @deprecated Prefer migrateArticleBriefExplanationCache for version bumps. */
export function purgeStaleExplanationClientStorage(): void {
  migrateArticleBriefExplanationCache();
}

/** @deprecated Article Brief pages should not read session stashes for explanation copy. */
export function purgeStaleArticleSessionStorage(articleId?: string): void {
  if (typeof window === "undefined") return;
  if (articleId) {
    clearArticleBriefSessionStash(articleId);
    return;
  }
  purgeAllArticleBriefSessionStashes();
}

export { EXPLANATION_COPY_VERSION };
