import { enrichBrief } from "./article-analysis";
import { dateKeyFromFetchedAt } from "./daily-edition";
import { cacheGet, cacheSet } from "./news-cache";
import type { Brief } from "./types";
import {
  briefToArchiveArticle,
  buildWeeklyArchivePayload,
  currentWeekDateKeys,
  datedEditionCacheKey,
  isDateKeyInCurrentWeek,
  mergeWeeklyDayRecord,
  weekKeyFromDate,
  weekKeyFromDateKey,
  weeklyArchiveCacheKey,
  weeklyDayCacheKey,
  type WeeklyArchivePayload,
  type WeeklyArchiveStore,
  type WeeklyDayRecord,
} from "./weekly-archive";

/**
 * Weekly archive contract (This Week tab):
 * - Append-only merge of successful daily editions; never replace earlier days.
 * - Up to ~DAILY_EDITION_ARTICLE_LIMIT stories per saved edition day (~20).
 * - Dedupe by canonical URL and similar title via isSameStory().
 * - Calendar week resets each Sunday (local timezone weekKey).
 * - Read path only: never calls live news providers or backfills missing days.
 */

function enrichBriefs(briefs: Brief[]): Brief[] {
  return briefs.map(enrichBrief);
}

/** Resolve which edition day bucket a saved daily payload belongs in for the week archive. */
export function resolveWeeklyEditionDate(
  savedEditionDate: string | undefined,
  fetchedAt: string | undefined,
  referenceToday: string
): string | null {
  if (savedEditionDate && isDateKeyInCurrentWeek(savedEditionDate)) {
    return savedEditionDate;
  }
  const fetchedDay = fetchedAt ? dateKeyFromFetchedAt(fetchedAt) : null;
  if (fetchedDay && isDateKeyInCurrentWeek(fetchedDay)) {
    return fetchedDay;
  }
  if (isDateKeyInCurrentWeek(referenceToday)) {
    return referenceToday;
  }
  return null;
}

/**
 * Idempotent merge of a saved live daily edition into the current week archive.
 * Safe to call on cache hits; does not fetch providers or alter Today payloads.
 */
export async function syncLiveEditionToWeekArchive(
  editionDate: string | null,
  briefs: Brief[]
): Promise<void> {
  if (!editionDate || briefs.length === 0) return;
  await appendDailyEditionToWeek(editionDate, briefs);
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

async function loadWeekStore(weekKey: string): Promise<WeeklyArchiveStore | null> {
  const cached = await cacheGet<WeeklyArchiveStore>(weeklyArchiveCacheKey(weekKey));
  return cached?.value ?? null;
}

async function persistWeekStore(store: WeeklyArchiveStore): Promise<void> {
  await cacheSet(weeklyArchiveCacheKey(store.weekKey), store);
}

async function mirrorDayRecord(record: WeeklyDayRecord): Promise<void> {
  await Promise.all([
    cacheSet(weeklyDayCacheKey(record.editionDate), record),
    cacheSet(datedEditionCacheKey(record.editionDate), record),
  ]);
}

function recordBelongsToWeek(
  record: WeeklyDayRecord,
  weekKey: string,
  reference: Date = new Date()
): boolean {
  if (!isDateKeyInCurrentWeek(record.editionDate, reference)) return false;
  const recordWeekKey = record.weekKey || weekKeyFromDateKey(record.editionDate);
  return recordWeekKey === weekKey;
}

/** Merge week-level store with per-day weekly caches so earlier days are never dropped. */
async function hydrateWeekDayRecords(
  weekKey: string,
  reference: Date = new Date()
): Promise<WeeklyDayRecord[]> {
  const dayMap = new Map<string, WeeklyDayRecord>();

  const addRecord = (record: WeeklyDayRecord | null | undefined) => {
    if (!record?.articles.length) return;
    if (!recordBelongsToWeek(record, weekKey, reference)) return;
    dayMap.set(record.editionDate, mergeWeeklyDayRecord(dayMap.get(record.editionDate), record));
  };

  const weekStore = await loadWeekStore(weekKey);
  for (const record of weekStore?.dayRecords ?? []) {
    addRecord(record);
  }

  for (const editionDate of currentWeekDateKeys(reference)) {
    addRecord(await loadWeeklyDayRecord(editionDate));
    if (!dayMap.has(editionDate)) {
      addRecord(await loadDatedEditionRecord(editionDate));
    }
  }

  return [...dayMap.values()].sort((a, b) => b.editionDate.localeCompare(a.editionDate));
}

/**
 * Append unique stories from a daily edition into the persistent week archive.
 * Never replaces earlier saved weekly stories; merges and dedupes by URL/title.
 * Each successful daily save adds at most one day bucket (~20 stories).
 */
export async function appendDailyEditionToWeek(editionDate: string, briefs: Brief[]): Promise<void> {
  if (briefs.length === 0) return;

  const weekKey = weekKeyFromDateKey(editionDate);
  if (!isDateKeyInCurrentWeek(editionDate)) return;

  const incomingDay: WeeklyDayRecord = {
    editionDate,
    savedAt: new Date().toISOString(),
    weekKey,
    articles: enrichBriefs(briefs).map((brief) => briefToArchiveArticle(brief)),
  };

  const hydratedRecords = await hydrateWeekDayRecords(weekKey);
  const dayMap = new Map(hydratedRecords.map((record) => [record.editionDate, record]));
  const mergedDay = mergeWeeklyDayRecord(dayMap.get(editionDate), incomingDay);
  dayMap.set(editionDate, mergedDay);

  const store: WeeklyArchiveStore = {
    weekKey,
    updatedAt: new Date().toISOString(),
    dayRecords: [...dayMap.values()]
      .filter((record) => isDateKeyInCurrentWeek(record.editionDate))
      .sort((a, b) => b.editionDate.localeCompare(a.editionDate)),
  };

  await persistWeekStore(store);
  await mirrorDayRecord(mergedDay);
}

/** Successful daily edition save hook — merges into the current week archive. */
export async function saveDailyEditionForWeek(editionDate: string, briefs: Brief[]): Promise<void> {
  await appendDailyEditionToWeek(editionDate, briefs);
}

/** Read-only weekly archive for the current calendar week (saved dated editions only). */
export async function loadWeeklyArchive(reference: Date = new Date()): Promise<WeeklyArchivePayload> {
  const weekKey = weekKeyFromDate(reference);
  const dayRecords = await hydrateWeekDayRecords(weekKey, reference);

  if (dayRecords.length > 0) {
    const weekStore = await loadWeekStore(weekKey);
    if ((weekStore?.dayRecords.length ?? 0) < dayRecords.length) {
      await persistWeekStore({
        weekKey,
        updatedAt: new Date().toISOString(),
        dayRecords,
      });
    }
  }

  return buildWeeklyArchivePayload(dayRecords, weekKey, reference);
}
