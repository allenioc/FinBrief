import type { Brief } from "./types";

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

export function readEditionSnapshot(): DailyEditionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${SESSION_PREFIX}::${dailyEditionDateKey()}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyEditionSnapshot;
    if (
      parsed.editionDateKey !== dailyEditionDateKey() ||
      !Array.isArray(parsed.briefs) ||
      parsed.briefs.length === 0
    ) {
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
