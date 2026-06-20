import { DASHBOARD_TOP_STORIES_MAX } from "./news-constants";
import { countArticlesWithImageUrl } from "./article-image";
import type { Brief } from "./types";

export interface DashboardSection {
  title: string;
  subtitle: string;
  stories: Brief[];
}

export type DashboardLayoutDebug = {
  savedEditionArticleCount: number;
  topStoriesCount: number;
  articlesWithImageUrl: number;
};

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArticleUrl(url: string): string {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().toLowerCase().replace(/\/$/, "");
  } catch {
    return trimmed.toLowerCase();
  }
}

export function areSimilarTitles(a: string, b: string): boolean {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const prefixLength = Math.min(50, left.length, right.length);
  if (prefixLength >= 30) {
    if (left.startsWith(right.slice(0, prefixLength)) || right.startsWith(left.slice(0, prefixLength))) {
      return true;
    }
  }

  const wordsLeft = new Set(left.split(" ").filter((word) => word.length > 4));
  const wordsRight = new Set(right.split(" ").filter((word) => word.length > 4));
  if (wordsLeft.size === 0 || wordsRight.size === 0) return false;

  let overlap = 0;
  wordsLeft.forEach((word) => {
    if (wordsRight.has(word)) overlap += 1;
  });
  return overlap / Math.min(wordsLeft.size, wordsRight.size) >= 0.85;
}

export function isHardDuplicate(a: Brief, b: Brief): boolean {
  if (a.id === b.id) return true;

  const urlA = normalizeArticleUrl(a.originalUrl);
  const urlB = normalizeArticleUrl(b.originalUrl);
  return Boolean(urlA && urlB && urlA === urlB);
}

export function isSameStory(a: Brief, b: Brief): boolean {
  if (isHardDuplicate(a, b)) return true;
  return areSimilarTitles(a.headline, b.headline);
}

export function filterUniqueStories(stories: Brief[], excluded: Brief[] = []): Brief[] {
  const kept: Brief[] = [];
  for (const story of stories) {
    if (excluded.some((item) => isSameStory(story, item))) continue;
    if (kept.some((item) => isSameStory(story, item))) continue;
    kept.push(story);
  }
  return kept;
}

function filterHardUniqueStories(stories: Brief[]): Brief[] {
  const kept: Brief[] = [];
  for (const story of stories) {
    if (kept.some((item) => isHardDuplicate(story, item))) continue;
    kept.push(story);
  }
  return kept;
}

function publishedTime(iso: string): number {
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
}

function scoreTopStory(brief: Brief): number {
  let score = 0;
  if (brief.marketImpact === "high") score += 4;
  else if (brief.marketImpact === "medium") score += 2;
  else score += 1;

  if (brief.articleType === "macro news" || brief.articleType === "market news") score += 3;
  else if (brief.articleType === "ETF/index news") score += 2;
  else if (brief.ticker !== "—") score += 1;

  score += publishedTime(brief.publishedAt) / 1e13;
  return score;
}

function rankStories(stories: Brief[]): Brief[] {
  return [...stories].sort((a, b) => {
    const scoreDelta = scoreTopStory(b) - scoreTopStory(a);
    if (scoreDelta !== 0) return scoreDelta;
    return publishedTime(b.publishedAt) - publishedTime(a.publishedAt);
  });
}

export function buildDashboardSections(
  briefs: Brief[]
): { sections: DashboardSection[]; layoutDebug: DashboardLayoutDebug } {
  // Use the full saved daily edition; week scoping is applied when the edition is fetched.
  const pool = filterHardUniqueStories(rankStories(briefs));

  const topLimit = Math.min(DASHBOARD_TOP_STORIES_MAX, pool.length);
  const topStories = pool.slice(0, topLimit);

  const marketStories = filterUniqueStories(
    pool.filter((brief) => brief.articleType === "market news" || brief.articleType === "macro news"),
    topStories
  );

  const recommendedStories = filterUniqueStories(pool, [...topStories, ...marketStories]);

  const layoutDebug: DashboardLayoutDebug = {
    savedEditionArticleCount: briefs.length,
    topStoriesCount: topStories.length,
    articlesWithImageUrl: countArticlesWithImageUrl(briefs),
  };

  return {
    layoutDebug,
    sections: [
      {
        title: "Top Stories",
        subtitle: "Most relevant stories right now",
        stories: topStories,
      },
      {
        title: "Latest Market Stories",
        subtitle: "Macro and index-focused context",
        stories: marketStories,
      },
      {
        title: "Recommended Next",
        subtitle: "Additional stories worth reading",
        stories: recommendedStories,
      },
    ],
  };
}
