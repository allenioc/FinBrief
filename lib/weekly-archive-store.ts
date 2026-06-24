import { enrichBrief } from "./article-analysis";
import { BROAD_NEWS_QUERY, DAILY_EDITION_ARTICLE_LIMIT } from "./news-constants";
import { cacheGet, cacheSet } from "./news-cache";
import type { Brief } from "./types";
import {
  briefToArchiveArticle,
  buildWeeklyArchivePayload,
  currentWeekDateKeys,
  localDateKey,
  weekKeyFromDate,
  weekKeyFromDateKey,
  weeklyDayCacheKey,
  type WeeklyArchivePayload,
  type WeeklyDayRecord,
} from "./weekly-archive";

type EditionRecord = {
  editionDate: string;
  savedAt: string;
  payload: { briefs: Brief[] };
};

async function loadBroadSavedEditionForToday(today: string): Promise<Brief[] | null> {
  const editionKey = `edition::${BROAD_NEWS_QUERY}::week::${DAILY_EDITION_ARTICLE_LIMIT}::1`;
  const saved = await cacheGet<EditionRecord>(editionKey);
  if (
    saved &&
    saved.value.editionDate === today &&
    Array.isArray(saved.value.payload.briefs) &&
    saved.value.payload.briefs.length > 0
  ) {
    return saved.value.payload.briefs.map(enrichBrief);
  }
  return null;
}

export async function saveDailyEditionForWeek(editionDate: string, briefs: Brief[]): Promise<void> {
  if (briefs.length === 0) return;
  const weekKey = weekKeyFromDateKey(editionDate);
  const record: WeeklyDayRecord = {
    editionDate,
    savedAt: new Date().toISOString(),
    weekKey,
    articles: briefs.map((brief) => briefToArchiveArticle(enrichBrief(brief))),
  };
  await cacheSet(weeklyDayCacheKey(editionDate), record);
}

async function loadWeeklyDayRecord(editionDate: string): Promise<WeeklyDayRecord | null> {
  const cached = await cacheGet<WeeklyDayRecord>(weeklyDayCacheKey(editionDate));
  if (cached?.value.articles?.length) {
    return cached.value;
  }
  return null;
}

async function ensureWeeklyDayFromSavedEdition(
  editionDate: string,
  today: string
): Promise<WeeklyDayRecord | null> {
  const existing = await loadWeeklyDayRecord(editionDate);
  if (existing) return existing;
  if (editionDate !== today) return null;

  const briefs = await loadBroadSavedEditionForToday(today);
  if (!briefs?.length) return null;

  await saveDailyEditionForWeek(today, briefs);
  return loadWeeklyDayRecord(today);
}

/** Read-only weekly archive for the current calendar week (saved daily editions only). */
export async function loadWeeklyArchive(reference: Date = new Date()): Promise<WeeklyArchivePayload> {
  const weekKey = weekKeyFromDate(reference);
  const today = localDateKey(reference);
  const dateKeys = currentWeekDateKeys(reference);
  const dayRecords: WeeklyDayRecord[] = [];

  for (const editionDate of dateKeys) {
    const record =
      (await ensureWeeklyDayFromSavedEdition(editionDate, today)) ??
      (await loadWeeklyDayRecord(editionDate));
    if (record && record.weekKey === weekKey && record.articles.length > 0) {
      dayRecords.push(record);
    }
  }

  dayRecords.sort((a, b) => b.editionDate.localeCompare(a.editionDate));
  return buildWeeklyArchivePayload(dayRecords, weekKey, reference);
}
