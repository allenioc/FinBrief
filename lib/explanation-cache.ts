import type { Brief } from "./types";
import { EXPLANATION_COPY_VERSION } from "./article-brief-quality";

const DAILY_EDITION_PREFIX = "finbrief-daily-edition";
const WEEKLY_ARCHIVE_PREFIX = "finbrief-weekly-archive";
const ARTICLE_SESSION_PREFIX = "finbrief-article-";

type StorageLike = Pick<Storage, "length" | "key" | "getItem" | "removeItem">;

function isStaleExplanationVersion(version: unknown): boolean {
  return typeof version !== "number" || version < EXPLANATION_COPY_VERSION;
}

function purgeMatchingKeys(storage: StorageLike, prefix: string): number {
  let removed = 0;
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    storage.removeItem(key);
    removed += 1;
  }
  return removed;
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

/** Drop stale Article Brief session stashes so brief pages fall back to saved server data. */
export function purgeStaleArticleSessionStorage(articleId?: string): void {
  if (typeof window === "undefined") return;
  const storages = [window.sessionStorage, window.localStorage];

  for (const storage of storages) {
    if (articleId) {
      const key = `${ARTICLE_SESSION_PREFIX}${articleId}`;
      try {
        const parsed = JSON.parse(storage.getItem(key) ?? "null") as Brief;
        if (isStaleExplanationVersion(parsed?.explanationVersion)) {
          storage.removeItem(key);
        }
      } catch {
        storage.removeItem(key);
      }
      continue;
    }

    purgeMatchingKeys(storage, ARTICLE_SESSION_PREFIX);
  }
}

/** Remove browser caches that still carry pre-v4 explanation copy. Safe to call on every load. */
export function purgeStaleExplanationClientStorage(): void {
  if (typeof window === "undefined") return;
  purgeDailyEditionStorage(window.localStorage);
  purgeDailyEditionStorage(window.sessionStorage);
  purgeWeeklyArchiveStorage(window.localStorage);
  purgeStaleArticleSessionStorage();
}

export function isTrustedExplanationVersion(version: unknown): boolean {
  return !isStaleExplanationVersion(version);
}

export { EXPLANATION_COPY_VERSION };
