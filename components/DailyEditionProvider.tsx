"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Brief } from "@/lib/types";
import { countArticlesWithImageUrl } from "@/lib/article-image";
import { enrichBrief, SUMMARY_COPY_VERSION } from "@/lib/article-analysis";
import { DAILY_EDITION_ARTICLE_LIMIT, DAILY_EDITION_REPLACEMENT_MIN } from "@/lib/news-constants";
import {
  dailyEditionDateKey,
  dailyEditionRequestKey,
  isTrustedEditionSnapshot,
  readBootstrapSnapshot,
  readEditionSnapshot,
  writeEditionSnapshot,
  type DailyEditionSnapshot,
  type EditionDataSource,
} from "@/lib/daily-edition-client";
import { isLiveEditionProvider, isEditionFetchedOnDate, isWithinSuccessFetchCooldown, shouldUpgradeEdition } from "@/lib/daily-edition";

type DailyEditionDebug = {
  source: EditionDataSource;
  savedArticleCount: number;
  articlesWithImageUrl: number;
  cacheStatus?: string;
};

type DailyEditionContextValue = {
  editionBriefs: Brief[];
  ready: boolean;
  syncing: boolean;
  fetchedAt: string | null;
  hasMore: boolean;
  page: number;
  debug: DailyEditionDebug;
  syncEdition: (options?: { background?: boolean }) => Promise<void>;
  appendPage: (briefs: Brief[], hasMore: boolean, nextPage: number) => void;
};

const DailyEditionContext = createContext<DailyEditionContextValue | null>(null);

let memorySnapshot: DailyEditionSnapshot | null = null;

function enrichBriefs(briefs: Brief[]): Brief[] {
  return briefs.map(enrichBrief);
}

function snapshotFromBriefs(
  briefs: Brief[],
  source: EditionDataSource,
  fetchedAt: string,
  hasMore: boolean,
  cacheStatus?: string,
  provider?: string
): DailyEditionSnapshot {
  const enriched = enrichBriefs(briefs);
  return {
    editionDateKey: dailyEditionDateKey(),
    briefs: enriched,
    fetchedAt,
    hasMore,
    savedArticleCount: enriched.length,
    articlesWithImageUrl: countArticlesWithImageUrl(enriched),
    source,
    cacheStatus,
    provider,
    copyVersion: SUMMARY_COPY_VERSION,
  };
}

function applySnapshot(snapshot: DailyEditionSnapshot): DailyEditionSnapshot {
  memorySnapshot = snapshot;
  writeEditionSnapshot(snapshot);
  return snapshot;
}

function msUntilNextLocalMidnight(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(1000, next.getTime() - now.getTime());
}

function trustedMemorySnapshot(): DailyEditionSnapshot | null {
  if (memorySnapshot && isTrustedEditionSnapshot(memorySnapshot)) {
    return memorySnapshot;
  }
  return null;
}

function resolveBootstrapSnapshot(): DailyEditionSnapshot | null {
  return trustedMemorySnapshot() ?? readBootstrapSnapshot();
}

function snapshotToDebug(snapshot: DailyEditionSnapshot, source: EditionDataSource): DailyEditionDebug {
  return {
    source,
    savedArticleCount: snapshot.savedArticleCount,
    articlesWithImageUrl: snapshot.articlesWithImageUrl,
    cacheStatus: snapshot.cacheStatus,
  };
}

export function DailyEditionProvider({ children }: { children: React.ReactNode }) {
  const todayKey = dailyEditionDateKey();
  const initialBootstrapRef = useRef<DailyEditionSnapshot | null>(resolveBootstrapSnapshot());
  const bootstrapSnapshot = initialBootstrapRef.current;

  const [editionBriefs, setEditionBriefs] = useState<Brief[]>(() =>
    bootstrapSnapshot ? enrichBriefs(bootstrapSnapshot.briefs) : []
  );
  const [ready, setReady] = useState(() => Boolean(bootstrapSnapshot));
  const [syncing, setSyncing] = useState(() => !bootstrapSnapshot);
  const [fetchedAt, setFetchedAt] = useState<string | null>(() => bootstrapSnapshot?.fetchedAt ?? null);
  const [hasMore, setHasMore] = useState(() => bootstrapSnapshot?.hasMore ?? false);
  const [page, setPage] = useState(1);
  const [debug, setDebug] = useState<DailyEditionDebug>(() =>
    bootstrapSnapshot
      ? snapshotToDebug(bootstrapSnapshot, "cache")
      : {
          source: "cache",
          savedArticleCount: 0,
          articlesWithImageUrl: 0,
        }
  );
  const briefsRef = useRef(editionBriefs);
  const syncingRef = useRef(false);
  const bootstrappedRef = useRef(Boolean(bootstrapSnapshot));
  const loadAttemptedRef = useRef(false);

  useEffect(() => {
    briefsRef.current = editionBriefs;
  }, [editionBriefs]);

  const commitSnapshot = useCallback((snapshot: DailyEditionSnapshot) => {
    applySnapshot(snapshot);
    setEditionBriefs(snapshot.briefs);
    setFetchedAt(snapshot.fetchedAt);
    setHasMore(snapshot.hasMore);
    setDebug(snapshotToDebug(snapshot, snapshot.source));
    setReady(true);
  }, []);

  const restoreFromCache = useCallback((): boolean => {
    const cached = memorySnapshot ?? readBootstrapSnapshot();
    if (!cached?.briefs.length) return false;
    bootstrappedRef.current = true;
    commitSnapshot({
      ...cached,
      briefs: enrichBriefs(cached.briefs),
      copyVersion: SUMMARY_COPY_VERSION,
      source: cached.source ?? "cache",
    });
    return true;
  }, [commitSnapshot]);

  const finalizeSync = useCallback(() => {
    syncingRef.current = false;
    setSyncing(false);
    if (briefsRef.current.length > 0) {
      setReady(true);
      return;
    }
    if (restoreFromCache()) return;
    if (loadAttemptedRef.current) {
      setReady(true);
    }
  }, [restoreFromCache]);

  const syncEdition = useCallback(
    async (options?: { background?: boolean }) => {
      if (syncingRef.current) return;
      const background = options?.background ?? false;

      const cachedSnapshot = memorySnapshot ?? readBootstrapSnapshot();
      if (
        cachedSnapshot &&
        cachedSnapshot.briefs.length > 0 &&
        isLiveEditionProvider(cachedSnapshot.provider) &&
        isEditionFetchedOnDate(cachedSnapshot.fetchedAt, todayKey) &&
        isWithinSuccessFetchCooldown(cachedSnapshot.fetchedAt, todayKey) &&
        (cachedSnapshot.briefs.length >= DAILY_EDITION_REPLACEMENT_MIN ||
          briefsRef.current.length === 0)
      ) {
        if (!bootstrappedRef.current || briefsRef.current.length === 0) {
          bootstrappedRef.current = true;
          commitSnapshot({
            ...cachedSnapshot,
            briefs: enrichBriefs(cachedSnapshot.briefs),
            copyVersion: SUMMARY_COPY_VERSION,
            source: cachedSnapshot.source ?? "cache",
          });
        }
        setSyncing(false);
        setReady(true);
        return;
      }

      const cachedFetchedToday =
        cachedSnapshot && isEditionFetchedOnDate(cachedSnapshot.fetchedAt, todayKey);

      if (!background && briefsRef.current.length > 0 && bootstrappedRef.current && cachedFetchedToday) {
        setReady(true);
        return;
      }

      syncingRef.current = true;
      loadAttemptedRef.current = true;
      if (!background || briefsRef.current.length === 0) {
        setSyncing(true);
      }

      const params = new URLSearchParams();
      params.set("timeRange", "week");
      params.set("limit", String(DAILY_EDITION_ARTICLE_LIMIT));
      params.set("page", "1");
      params.set("edition", dailyEditionRequestKey());

      try {
        const response = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          briefs?: Brief[];
          fetchedAt?: string;
          hasMore?: boolean;
          savedEditionArticleCount?: number;
          articlesWithImageUrl?: number;
          cacheStatus?: string;
          provider?: string;
        };
        const apiBriefs = enrichBriefs(payload.briefs ?? []);
        const isMockPayload = payload.provider === "mock" || payload.provider === "error";

        if (isMockPayload) {
          return;
        }

        if (apiBriefs.length === 0) {
          setDebug((prev) => ({
            ...prev,
            cacheStatus: payload.cacheStatus ?? prev.cacheStatus,
          }));
          return;
        }

        const currentSnapshot = memorySnapshot ?? readEditionSnapshot() ?? readBootstrapSnapshot();
        const currentBriefs = currentSnapshot?.briefs ?? briefsRef.current;
        const currentBriefCount = currentBriefs.length;
        const currentFetchedToday = isEditionFetchedOnDate(currentSnapshot?.fetchedAt, todayKey);
        if (
          currentFetchedToday &&
          currentBriefCount >= DAILY_EDITION_REPLACEMENT_MIN &&
          apiBriefs.length < DAILY_EDITION_REPLACEMENT_MIN
        ) {
          return;
        }
        if (
          currentFetchedToday &&
          currentBriefCount >= DAILY_EDITION_REPLACEMENT_MIN &&
          apiBriefs.length < currentBriefCount
        ) {
          return;
        }

        const currentBriefIds = currentBriefs.map((item) => item.id).join(",");
        const nextBriefIds = apiBriefs.map((item) => item.id).join(",");
        if (
          briefsRef.current.length > 0 &&
          currentSnapshot &&
          !shouldUpgradeEdition({
            currentBriefIds,
            nextBriefIds,
            currentBriefCount,
            nextBriefCount: apiBriefs.length,
            currentCacheStatus: currentSnapshot.cacheStatus,
            currentProvider: currentSnapshot.provider,
            nextCacheStatus: payload.cacheStatus,
            nextProvider: payload.provider,
            currentFetchedAt: currentSnapshot.fetchedAt,
            nextFetchedAt: payload.fetchedAt,
            todayKey,
          })
        ) {
          return;
        }

        const snapshot = snapshotFromBriefs(
          apiBriefs,
          "daily_edition",
          payload.fetchedAt ?? new Date().toISOString(),
          Boolean(payload.hasMore),
          payload.cacheStatus,
          payload.provider
        );
        bootstrappedRef.current = true;
        commitSnapshot(snapshot);
        setPage(1);
      } finally {
        finalizeSync();
      }
    },
    [commitSnapshot, finalizeSync, todayKey]
  );

  const appendPage = useCallback((briefs: Brief[], nextHasMore: boolean, nextPage: number) => {
    if (briefs.length === 0) {
      setHasMore(nextHasMore);
      setPage(nextPage);
      return;
    }
    setEditionBriefs((prev) => {
      const existing = new Set(prev.map((item) => item.id));
      const additions = enrichBriefs(briefs).filter((item) => !existing.has(item.id));
      const merged = [...prev, ...additions];
      const snapshot = snapshotFromBriefs(
        merged,
        memorySnapshot?.source ?? "daily_edition",
        memorySnapshot?.fetchedAt ?? new Date().toISOString(),
        nextHasMore,
        memorySnapshot?.cacheStatus,
        memorySnapshot?.provider
      );
      applySnapshot(snapshot);
      setDebug(snapshotToDebug(snapshot, snapshot.source));
      briefsRef.current = merged;
      return merged;
    });
    setHasMore(nextHasMore);
    setPage(nextPage);
  }, []);

  useEffect(() => {
    if (bootstrapSnapshot) {
      bootstrappedRef.current = true;
      return;
    }
    if (restoreFromCache()) return;
    void syncEdition({ background: false });
    // Mount-only bootstrap when no synchronous snapshot was available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stored = readBootstrapSnapshot();
    if (
      stored &&
      stored.briefs.length >= DAILY_EDITION_REPLACEMENT_MIN &&
      isWithinSuccessFetchCooldown(stored.fetchedAt, todayKey)
    ) {
      return;
    }
    if (briefsRef.current.length > 0 && bootstrappedRef.current) {
      void syncEdition({ background: true });
    }
  }, [syncEdition, todayKey]);

  useEffect(() => {
    let midnightTimer: number | undefined;
    const scheduleMidnightRefresh = () => {
      midnightTimer = window.setTimeout(async () => {
        memorySnapshot = null;
        bootstrappedRef.current = false;
        loadAttemptedRef.current = false;
        setReady(false);
        setSyncing(true);
        await syncEdition();
        scheduleMidnightRefresh();
      }, msUntilNextLocalMidnight());
    };
    scheduleMidnightRefresh();
    return () => {
      if (midnightTimer) window.clearTimeout(midnightTimer);
    };
  }, [syncEdition]);

  const value = useMemo<DailyEditionContextValue>(
    () => ({
      editionBriefs,
      ready,
      syncing,
      fetchedAt,
      hasMore,
      page,
      debug,
      syncEdition,
      appendPage,
    }),
    [editionBriefs, ready, syncing, fetchedAt, hasMore, page, debug, syncEdition, appendPage]
  );

  return <DailyEditionContext.Provider value={value}>{children}</DailyEditionContext.Provider>;
}

export function useDailyEdition() {
  const context = useContext(DailyEditionContext);
  if (!context) {
    throw new Error("useDailyEdition must be used inside DailyEditionProvider");
  }
  return context;
}
