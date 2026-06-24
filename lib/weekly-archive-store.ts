import { enrichBrief } from "./article-analysis";
import { cacheGet, cacheSet } from "./news-cache";
import type { Brief } from "./types";
import {
  briefToArchiveArticle,
  buildWeeklyArchivePayload,
  currentWeekDateKeys,
  datedEditionCacheKey,
  weekKeyFromDate,
  weekKeyFromDateKey,
  weeklyDayCacheKey,
  type WeeklyArchivePayload,
  type WeeklyDayRecord,
} from "./weekly-archive";

function enrichBriefs(briefs: Brief[]): Brief[] {
  return briefs.map(enrichBrief);
}

async function loadWeeklyDayRecord(editionDate: string): Promise<WeeklyDayRecord | null> {
  const cached = await cacheGet<WeeklyDayRecord>(weeklyDayCacheKey(editionDate));
  if (cached?.value.articles?.length) {
    return cached.value;
  }
  return null;
}

async function loadDatedEditionRecord(editionDate: string): Promise<WeeklyDayRecord | null> {
  const weekly = await loadWeeklyDayRecord(editionDate);
  if (weekly) return weekly;

  const dated = await cacheGet<WeeklyDayRecord>(datedEditionCacheKey(editionDate));
  if (dated?.value.articles?.length) {
    return dated.value;
  }
  return null;
}

export async function saveDailyEditionForWeek(editionDate: string, briefs: Brief[]): Promise<void> {
  if (briefs.length === 0) return;

  const record: WeeklyDayRecord = {
    editionDate,
    savedAt: new Date().toISOString(),
    weekKey: weekKeyFromDateKey(editionDate),
    articles: enrichBriefs(briefs).map((brief) => briefToArchiveArticle(brief)),
  };

  await Promise.all([
    cacheSet(weeklyDayCacheKey(editionDate), record),
    cacheSet(datedEditionCacheKey(editionDate), record),
  ]);
}

/** Read-only weekly archive for the current calendar week (saved dated editions only). */
export async function loadWeeklyArchive(reference: Date = new Date()): Promise<WeeklyArchivePayload> {
  const weekKey = weekKeyFromDate(reference);
  const dayRecords: WeeklyDayRecord[] = [];

  for (const editionDate of currentWeekDateKeys(reference)) {
    const record = await loadDatedEditionRecord(editionDate);
    if (record?.articles.length) {
      dayRecords.push(record);
    }
  }

  dayRecords.sort((a, b) => b.editionDate.localeCompare(a.editionDate));
  return buildWeeklyArchivePayload(dayRecords, weekKey, reference);
}
