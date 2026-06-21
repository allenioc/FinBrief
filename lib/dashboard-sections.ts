import { DASHBOARD_TOP_STORIES_MAX } from "./news-constants";
import { countArticlesWithImageUrl } from "./article-image";
import {
  dedupeStories,
  filterUniqueStories,
} from "./story-dedup";
import type { Brief } from "./types";

export {
  areSimilarTitles,
  filterUniqueStories,
  isHardDuplicate,
  isSameStory,
  normalizeArticleUrl,
} from "./story-dedup";

export interface DashboardSection {
  title: string;
  subtitle: string;
  stories: Brief[];
}

export type DashboardLayoutDebug = {
  savedEditionArticleCount: number;
  rawArticleCount: number;
  dedupedArticleCount: number;
  duplicatesRemoved: number;
  topStoriesCount: number;
  articlesWithImageUrl: number;
};

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
  const {
    stories: dedupedStories,
    rawArticleCount,
    dedupedArticleCount,
    duplicatesRemoved,
  } = dedupeStories(briefs);
  const pool = rankStories(dedupedStories);

  const topLimit = Math.min(DASHBOARD_TOP_STORIES_MAX, pool.length);
  const topStories = pool.slice(0, topLimit);

  const marketStories = filterUniqueStories(
    pool.filter((brief) => brief.articleType === "market news" || brief.articleType === "macro news"),
    topStories
  );

  const recommendedStories = filterUniqueStories(pool, [...topStories, ...marketStories]);

  const layoutDebug: DashboardLayoutDebug = {
    savedEditionArticleCount: briefs.length,
    rawArticleCount,
    dedupedArticleCount,
    duplicatesRemoved,
    topStoriesCount: topStories.length,
    articlesWithImageUrl: countArticlesWithImageUrl(dedupedStories),
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
