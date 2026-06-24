import { enrichBrief } from "./article-analysis";
import { BROAD_NEWS_QUERY, DAILY_EDITION_ARTICLE_LIMIT } from "./news-constants";
import { cacheGet, cacheSet } from "./news-cache";
import type { Brief } from "./types";
import {
  briefToArchiveArticle,
  buildWeeklyArchivePayload,
  currentWeekDateKeys,
  formatDateKey,
  groupBriefsIntoDayRecords,
  mergeWeeklyDayRecords,
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

type LastGoodRecord = {
  fetchedAt: string;
  payload: { briefs: Brief[] };
};

type SavedBroadSource = {
  editionDate: string;
  savedAt: string;
  briefs: Brief[];
};

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

async function loadSavedBroadSourceFromEdition(page: number): Promise<SavedBroadSource | null> {
  const editionKey = `edition::${BROAD_NEWS_QUERY}::week::${DAILY_EDITION_ARTICLE_LIMIT}::${page}`;
  const saved = await cacheGet<EditionRecord>(editionKey);
  if (
    !saved ||
    !Array.isArray(saved.value.payload.briefs) ||
    saved.value.payload.briefs.length === 0
  ) {
    return null;
  }
  return {
    editionDate: saved.value.editionDate,
    savedAt: saved.value.savedAt,
    briefs: enrichBriefs(saved.value.payload.briefs),
  };
}

async function loadSavedBroadSources(): Promise<SavedBroadSource[]> {
  const sources: SavedBroadSource[] = [];
  for (const page of [1, 2, 3]) {
    const source = await loadSavedBroadSourceFromEdition(page);
    if (source) sources.push(source);
  }

  const lastGoodKey = `lastgood::${BROAD_NEWS_QUERY}::week`;
  const lastGood = await cacheGet<LastGoodRecord>(lastGoodKey);
  if (lastGood && Array.isArray(lastGood.value.payload.briefs) && lastGood.value.payload.briefs.length > 0) {
    sources.push({
      editionDate: formatDateKey(new Date(lastGood.value.fetchedAt)),
      savedAt: lastGood.value.fetchedAt,
      briefs: enrichBriefs(lastGood.value.payload.briefs),
    });
  }

  return sources;
}

export async function saveDailyEditionForWeek(editionDate: string, briefs: Brief[]): Promise<void> {
  if (briefs.length === 0) return;
  const record: WeeklyDayRecord = {
    editionDate,
    savedAt: new Date().toISOString(),
    weekKey: weekKeyFromDateKey(editionDate),
    articles: briefs
      .map(enrichBrief)
      .map((brief) => briefToArchiveArticle(brief)),
  };
  await cacheSet(weeklyDayCacheKey(editionDate), record);
}

async function persistDerivedDayRecords(records: WeeklyDayRecord[]): Promise<void> {
  await Promise.all(
    records.map(async (record) => {
      const existing = await loadWeeklyDayRecord(record.editionDate);
      if (existing?.articles.length) return;
      await cacheSet(weeklyDayCacheKey(record.editionDate), record);
    })
  );
}

/** Read-only weekly archive for the current calendar week (saved daily editions only). */
export async function loadWeeklyArchive(reference: Date = new Date()): Promise<WeeklyArchivePayload> {
  const weekKey = weekKeyFromDate(reference);
  const weekDates = new Set(currentWeekDateKeys(reference));
  const dayRecords = new Map<string, WeeklyDayRecord>();

  for (const editionDate of weekDates) {
    const cached = await loadWeeklyDayRecord(editionDate);
    if (cached?.articles.length) {
      dayRecords.set(editionDate, cached);
    }
  }

  const savedSources = await loadSavedBroadSources();
  for (const source of savedSources) {
    const derived = groupBriefsIntoDayRecords(
      source.briefs,
      source.editionDate,
      source.savedAt,
      reference
    );
    for (const record of derived) {
      const existing = dayRecords.get(record.editionDate);
      if (existing) {
        existing.articles = [...existing.articles, ...record.articles];
        if (record.savedAt > existing.savedAt) existing.savedAt = record.savedAt;
      } else {
        dayRecords.set(record.editionDate, record);
      }
    }
  }

  const mergedRecords = mergeWeeklyDayRecords([...dayRecords.values()]).filter(
    (record) => weekDates.has(record.editionDate) && record.articles.length > 0
  );

  await persistDerivedDayRecords(mergedRecords);

  mergedRecords.sort((a, b) => b.editionDate.localeCompare(a.editionDate));
  return buildWeeklyArchivePayload(mergedRecords, weekKey, reference);
}
