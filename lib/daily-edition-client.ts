import type { Brief } from "./types";
import { EXPLANATION_COPY_VERSION } from "./article-brief-quality";
import { purgeStaleExplanationClientStorage } from "./explanation-cache";
import { SUMMARY_COPY_VERSION } from "./article-analysis";

export type EditionDataSource = "daily_edition" | "topic_filter" | "cache" | "session_storage";

export type DailyEditionSnapshot = {
  editionDateKey: string;
  briefs: Brief[];
  fetchedAt: string;
  hasMore: boolean;
  savedArticleCount: number;
  articlesWithImageUrl: number;
  source: EditionDataSource;
  cacheStatus?: string;
  provider?: string;
  copyVersion?: number;
  explanationVersion?: number;
};

const STORAGE_PREFIX = "finbrief-daily-edition";

export function dailyEditionDateKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function dailyEditionRequestKey(): string {
  return `business-news-feed-${dailyEditionDateKey()}`;
}

export function isTrustedEditionSnapshot(snapshot: DailyEditionSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  if (snapshot.editionDateKey !== dailyEditionDateKey()) return false;
  if (snapshot.copyVersion !== SUMMARY_COPY_VERSION) return false;
  if (snapshot.explanationVersion !== EXPLANATION_COPY_VERSION) return false;
  if (!Array.isArray(snapshot.briefs) || snapshot.briefs.length === 0) return false;
  if (snapshot.cacheStatus === "server_hydrate") return false;
  if (snapshot.provider === "mock" || snapshot.provider === "error") return false;
  return true;
}

function storageKey(dateKey: string): string {
  return `${STORAGE_PREFIX}::${dateKey}`;
}

function readFromStorage(): DailyEditionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const key = storageKey(dailyEditionDateKey());
    const raw = window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyEditionSnapshot;
    if (!isTrustedEditionSnapshot(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function readEditionSnapshot(): DailyEditionSnapshot | null {
  return readFromStorage();
}

/** Bootstrap read rejects legacy snapshots missing the current explanationVersion. */
export function readBootstrapSnapshot(): DailyEditionSnapshot | null {
  purgeStaleExplanationClientStorage();
  return readEditionSnapshot();
}

export function writeEditionSnapshot(snapshot: DailyEditionSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    const key = storageKey(snapshot.editionDateKey);
    const serialized = JSON.stringify(snapshot);
    window.localStorage.setItem(key, serialized);
    window.sessionStorage.setItem(key, serialized);
  } catch {
    // Storage may be unavailable in private mode.
  }
}
