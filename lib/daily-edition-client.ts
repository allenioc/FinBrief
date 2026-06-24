import type { Brief } from "./types";
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
};

const SESSION_PREFIX = "finbrief-daily-edition";

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
  if (!Array.isArray(snapshot.briefs) || snapshot.briefs.length === 0) return false;
  if (snapshot.cacheStatus === "server_hydrate") return false;
  if (snapshot.provider === "mock" || snapshot.provider === "error") return false;
  return true;
}

export function readEditionSnapshot(): DailyEditionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${SESSION_PREFIX}::${dailyEditionDateKey()}`);
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

export function writeEditionSnapshot(snapshot: DailyEditionSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${SESSION_PREFIX}::${snapshot.editionDateKey}`, JSON.stringify(snapshot));
  } catch {
    // Storage may be unavailable in private mode.
  }
}
