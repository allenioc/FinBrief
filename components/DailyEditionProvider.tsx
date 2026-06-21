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
import { enrichBriefImage, countArticlesWithImageUrl } from "@/lib/article-image";
import { DAILY_EDITION_ARTICLE_LIMIT } from "@/lib/news-constants";
import { shouldUpgradeEdition } from "@/lib/daily-edition";
import {
  dailyEditionDateKey,
  dailyEditionRequestKey,
  readEditionSnapshot,
  writeEditionSnapshot,
  type DailyEditionSnapshot,
  type EditionDataSource,
} from "@/lib/daily-edition-client";

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
  hydrateFromServer: (briefs: Brief[]) => void;
  syncEdition: (options?: { background?: boolean }) => Promise<void>;
  appendPage: (briefs: Brief[], hasMore: boolean, nextPage: number) => void;
};

const DailyEditionContext = createContext<DailyEditionContextValue | null>(null);

let memorySnapshot: DailyEditionSnapshot | null = null;

function enrichBriefs(briefs: Brief[]): Brief[] {
  return briefs.map(enrichBriefImage);
}

function idsSignature(items: Brief[]): string {
  return items.map((item) => item.id).join("|");
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

export function DailyEditionProvider({ children }: { children: React.ReactNode }) {
  const todayKey = dailyEditionDateKey();
  const initialSnapshot =
    memorySnapshot && memorySnapshot.editionDateKey === todayKey && memorySnapshot.briefs.length > 0
      ? memorySnapshot
      : null;

  const [editionBriefs, setEditionBriefs] = useState<Brief[]>(() =>
    initialSnapshot ? enrichBriefs(initialSnapshot.briefs) : []
  );
  const [ready, setReady] = useState(() => Boolean(initialSnapshot));
  const [syncing, setSyncing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(() => initialSnapshot?.fetchedAt ?? null);
  const [hasMore, setHasMore] = useState(() => initialSnapshot?.hasMore ?? false);
  const [page, setPage] = useState(1);
  const [debug, setDebug] = useState<DailyEditionDebug>(() =>
    initialSnapshot
      ? {
          source: "cache",
          savedArticleCount: initialSnapshot.savedArticleCount,
          articlesWithImageUrl: initialSnapshot.articlesWithImageUrl,
          cacheStatus: initialSnapshot.cacheStatus,
        }
      : {
          source: "cache",
          savedArticleCount: 0,
          articlesWithImageUrl: 0,
        }
  );
  const briefsRef = useRef(editionBriefs);
  const syncingRef = useRef(false);
  const bootstrappedRef = useRef(Boolean(initialSnapshot));

  useEffect(() => {
    briefsRef.current = editionBriefs;
  }, [editionBriefs]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    const stored = readEditionSnapshot();
    if (stored && stored.editionDateKey === todayKey) {
      bootstrappedRef.current = true;
      applySnapshot(stored);
      setEditionBriefs(enrichBriefs(stored.briefs));
      setFetchedAt(stored.fetchedAt);
      setHasMore(stored.hasMore);
      setDebug({
        source: "session_storage",
        savedArticleCount: stored.savedArticleCount,
        articlesWithImageUrl: stored.articlesWithImageUrl,
        cacheStatus: stored.cacheStatus,
      });
      setReady(true);
    }
  }, [todayKey]);

  const commitSnapshot = useCallback((snapshot: DailyEditionSnapshot) => {
    applySnapshot(snapshot);
    setEditionBriefs(snapshot.briefs);
    setFetchedAt(snapshot.fetchedAt);
    setHasMore(snapshot.hasMore);
    setDebug({
      source: snapshot.source,
      savedArticleCount: snapshot.savedArticleCount,
      articlesWithImageUrl: snapshot.articlesWithImageUrl,
      cacheStatus: snapshot.cacheStatus,
    });
    setReady(true);
  }, []);

  const hydrateFromServer = useCallback(
    (briefs: Brief[]) => {
      if (briefs.length === 0) return;
      if (briefsRef.current.length > 0 && bootstrappedRef.current) return;
      const snapshot = snapshotFromBriefs(
        briefs,
        "daily_edition",
        new Date().toISOString(),
        false,
        "server_hydrate"
      );
      bootstrappedRef.current = true;
      commitSnapshot(snapshot);
    },
    [commitSnapshot]
  );

  const syncEdition = useCallback(
    async (options?: { background?: boolean }) => {
      if (syncingRef.current) return;
      const background = options?.background ?? false;
      if (!background && briefsRef.current.length > 0 && bootstrappedRef.current) {
        return;
      }
      syncingRef.current = true;
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
        if (!response.ok) return;
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
        if (apiBriefs.length === 0 && briefsRef.current.length > 0) {
          setDebug((prev) => ({
            ...prev,
            cacheStatus: payload.cacheStatus ?? prev.cacheStatus,
          }));
          return;
        }
        if (apiBriefs.length === 0) return;

        const currentSnapshot = memorySnapshot;
        const prevSig = idsSignature(briefsRef.current);
        const nextSig = idsSignature(apiBriefs);
        const upgrade = shouldUpgradeEdition({
          currentBriefIds: prevSig,
          nextBriefIds: nextSig,
          currentCacheStatus: currentSnapshot?.cacheStatus,
          currentProvider: currentSnapshot?.provider,
          nextCacheStatus: payload.cacheStatus,
          nextProvider: payload.provider,
        });
        const snapshot = snapshotFromBriefs(
          apiBriefs,
          "daily_edition",
          payload.fetchedAt ?? new Date().toISOString(),
          Boolean(payload.hasMore),
          payload.cacheStatus,
          payload.provider
        );
        bootstrappedRef.current = true;
        if (upgrade) {
          commitSnapshot(snapshot);
        } else {
          setDebug({
            source: "daily_edition",
            savedArticleCount: snapshot.savedArticleCount,
            articlesWithImageUrl: snapshot.articlesWithImageUrl,
            cacheStatus: snapshot.cacheStatus,
          });
          setReady(true);
        }
        setPage(1);
      } finally {
        syncingRef.current = false;
        setSyncing(false);
      }
    },
    [commitSnapshot]
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
        memorySnapshot?.cacheStatus
      );
      applySnapshot(snapshot);
      setDebug({
        source: snapshot.source,
        savedArticleCount: snapshot.savedArticleCount,
        articlesWithImageUrl: snapshot.articlesWithImageUrl,
        cacheStatus: snapshot.cacheStatus,
      });
      briefsRef.current = merged;
      return merged;
    });
    setHasMore(nextHasMore);
    setPage(nextPage);
  }, []);

  useEffect(() => {
    const hasCachedEdition = bootstrappedRef.current && briefsRef.current.length > 0;
    void syncEdition({ background: hasCachedEdition });
  }, [syncEdition]);

  useEffect(() => {
    let midnightTimer: number | undefined;
    const scheduleMidnightRefresh = () => {
      midnightTimer = window.setTimeout(async () => {
        memorySnapshot = null;
        bootstrappedRef.current = false;
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
      hydrateFromServer,
      syncEdition,
      appendPage,
    }),
    [
      editionBriefs,
      ready,
      syncing,
      fetchedAt,
      hasMore,
      page,
      debug,
      hydrateFromServer,
      syncEdition,
      appendPage,
    ]
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
