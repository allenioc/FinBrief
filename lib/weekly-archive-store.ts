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
  mergeWeeklyDayRecords,
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

  const existingStore =
    (await loadWeekStore(weekKey)) ??
    ({
      weekKey,
      updatedAt: new Date().toISOString(),
      dayRecords: [],
    } satisfies WeeklyArchiveStore);

  const dayMap = new Map(existingStore.dayRecords.map((record) => [record.editionDate, record]));
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

async function migrateLegacyDayRecords(reference: Date, weekKey: string): Promise<WeeklyDayRecord[]> {
  const dayRecords: WeeklyDayRecord[] = [];
  for (const editionDate of currentWeekDateKeys(reference)) {
    const record = await loadDatedEditionRecord(editionDate);
    if (record?.articles.length && record.weekKey === weekKey) {
      dayRecords.push(record);
    }
  }
  return mergeWeeklyDayRecords(dayRecords);
}

/** Read-only weekly archive for the current calendar week (saved dated editions only). */
export async function loadWeeklyArchive(reference: Date = new Date()): Promise<WeeklyArchivePayload> {
  const weekKey = weekKeyFromDate(reference);
  let dayRecords: WeeklyDayRecord[] = [];

  const weekStore = await loadWeekStore(weekKey);
  if (weekStore?.dayRecords.length) {
    dayRecords = weekStore.dayRecords.filter(
      (record) =>
        record.weekKey === weekKey && isDateKeyInCurrentWeek(record.editionDate, reference)
    );
  }

  // One-time migration from legacy per-day edition caches only — never live providers.
  if (dayRecords.length === 0) {
    dayRecords = await migrateLegacyDayRecords(reference, weekKey);
    if (dayRecords.length > 0) {
      await persistWeekStore({
        weekKey,
        updatedAt: new Date().toISOString(),
        dayRecords,
      });
    }
  }

  dayRecords.sort((a, b) => b.editionDate.localeCompare(a.editionDate));
  return buildWeeklyArchivePayload(dayRecords, weekKey, reference);
}
