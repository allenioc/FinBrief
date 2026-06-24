import { enrichBrief } from "./article-analysis";
import { isSameStory, scoreStoryQuality } from "./story-dedup";
import type { Brief, SourceLink } from "./types";

/** Metadata stored per story in the weekly archive (no publisher image files). */
export type WeeklyArchiveArticle = {
  id: string;
  headline: string;
  source: string;
  author?: string;
  publishedAt: string;
  originalUrl: string;
  excerpt: string;
  summary: string;
  thirtySecondVersion: string;
  sourceLinks: SourceLink[];
  imageUrl: string;
  imageAlt: string;
  fallbackImageId?: string;
  imageDisplay?: "provider" | "fallback";
  ticker: string;
  topic: string;
  sentiment: Brief["sentiment"];
  sentimentConfidence: number;
  marketImpact: Brief["marketImpact"];
  articleType: Brief["articleType"];
  keyAffectedAssets: string[];
};

export type WeeklyDayRecord = {
  editionDate: string;
  savedAt: string;
  weekKey: string;
  articles: WeeklyArchiveArticle[];
};

export type WeeklyArchiveDayGroup = {
  editionDate: string;
  label: string;
  stories: Brief[];
};

export type WeeklyArchivePayload = {
  weekKey: string;
  weekLabel: string;
  editionDates: string[];
  storyCount: number;
  duplicatesRemoved: number;
  days: WeeklyArchiveDayGroup[];
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function localDateKey(reference: Date = new Date()): string {
  return formatDateKey(reference);
}

/** Calendar week starting Sunday in the user's local timezone. */
export function weekStartDate(reference: Date = new Date()): Date {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function weekKeyFromDate(reference: Date = new Date()): string {
  return formatDateKey(weekStartDate(reference));
}

export function weekKeyFromDateKey(dateKey: string): string {
  const parsed = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return weekKeyFromDate();
  return weekKeyFromDate(parsed);
}

export function currentWeekDateKeys(reference: Date = new Date()): string[] {
  const start = weekStartDate(reference);
  const keys: string[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    keys.push(formatDateKey(day));
  }
  return keys;
}

export function formatWeekLabel(reference: Date = new Date()): string {
  const keys = currentWeekDateKeys(reference);
  const start = new Date(`${keys[0]}T12:00:00`);
  const end = new Date(`${keys[6]}T12:00:00`);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

export function formatEditionDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function publishedTime(iso: string): number {
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function briefToArchiveArticle(brief: Brief): WeeklyArchiveArticle {
  return {
    id: brief.id,
    headline: brief.headline,
    source: brief.source,
    author: brief.author,
    publishedAt: brief.publishedAt,
    originalUrl: brief.originalUrl,
    excerpt: brief.excerpt,
    summary: brief.summary,
    thirtySecondVersion: brief.thirtySecondVersion,
    sourceLinks: brief.sourceLinks,
    imageUrl: brief.imageUrl,
    imageAlt: brief.imageAlt,
    fallbackImageId: brief.fallbackImageId,
    imageDisplay: brief.imageDisplay,
    ticker: brief.ticker,
    topic: brief.topic,
    sentiment: brief.sentiment,
    sentimentConfidence: brief.sentimentConfidence,
    marketImpact: brief.marketImpact,
    articleType: brief.articleType,
    keyAffectedAssets: brief.keyAffectedAssets,
  };
}

export function archiveArticleToBrief(article: WeeklyArchiveArticle): Brief {
  return {
    ...article,
    whatHappened: article.excerpt,
    whyItMatters: "",
    whoIsAffected: "",
    relatedAssets: [],
    keyTerms: [],
    bullCase: "",
    bearCase: "",
    neutralView: "",
    risks: [],
    thingsToWatch: [],
    dataSnapshot: {
      kind: "macro",
      relatedIndicators: [],
      affectedSectors: [],
      affectedIndexes: [],
      marketSensitivity: "medium",
    },
    recommendedNext: [],
  };
}

type TaggedStory = { brief: Brief; editionDate: string };

export function buildWeeklyArchivePayload(
  dayRecords: WeeklyDayRecord[],
  weekKey: string,
  reference: Date = new Date()
): WeeklyArchivePayload {
  const tagged: TaggedStory[] = [];
  for (const day of dayRecords) {
    for (const article of day.articles) {
      tagged.push({
        brief: enrichBrief(archiveArticleToBrief(article)),
        editionDate: day.editionDate,
      });
    }
  }

  const rawArticleCount = tagged.length;
  const sorted = [...tagged].sort(
    (a, b) => scoreStoryQuality(b.brief) - scoreStoryQuality(a.brief)
  );
  const kept: TaggedStory[] = [];
  for (const item of sorted) {
    if (kept.some((existing) => isSameStory(existing.brief, item.brief))) continue;
    kept.push(item);
  }

  const duplicatesRemoved = rawArticleCount - kept.length;
  const byDay = new Map<string, Brief[]>();
  for (const item of kept) {
    const stories = byDay.get(item.editionDate) ?? [];
    stories.push(item.brief);
    byDay.set(item.editionDate, stories);
  }

  const editionDates = [...byDay.keys()].sort((a, b) => b.localeCompare(a));
  const days: WeeklyArchiveDayGroup[] = editionDates.map((editionDate) => {
    const stories = [...(byDay.get(editionDate) ?? [])].sort(
      (a, b) => publishedTime(b.publishedAt) - publishedTime(a.publishedAt)
    );
    return {
      editionDate,
      label: formatEditionDayLabel(editionDate),
      stories,
    };
  });

  const storyCount = days.reduce((total, day) => total + day.stories.length, 0);

  return {
    weekKey,
    weekLabel: formatWeekLabel(reference),
    editionDates,
    storyCount,
    duplicatesRemoved,
    days,
  };
}

/** Client-side helper when only today's saved edition snapshot is available. */
export function buildWeeklyArchiveFromBriefs(
  briefs: Brief[],
  editionDate: string = localDateKey()
): WeeklyArchivePayload {
  const weekKey = weekKeyFromDateKey(editionDate);
  const record: WeeklyDayRecord = {
    editionDate,
    savedAt: new Date().toISOString(),
    weekKey,
    articles: briefs.map((brief) => briefToArchiveArticle(enrichBrief(brief))),
  };
  return buildWeeklyArchivePayload([record], weekKey);
}

export function weeklyDayCacheKey(editionDate: string): string {
  return `weekly-day::${editionDate}`;
}
