"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { MOCK_WATCHLIST } from "@/lib/watchlist-data";
import { sortWatchlistItems, WATCHLIST_STORAGE_KEY } from "@/lib/watchlist-utils";
import type { WatchlistItem } from "@/lib/types";

interface WatchlistContextValue {
  items: WatchlistItem[];
  ready: boolean;
  isFollowing: (symbol: string) => boolean;
  addFollow: (item: WatchlistItem) => void;
  removeFollow: (symbol: string) => void;
  toggleFollow: (item: WatchlistItem) => void;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WatchlistItem[]>(MOCK_WATCHLIST);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WatchlistItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(parsed);
        }
      }
    } catch {
      // Ignore bad local storage payloads and continue with mock defaults.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(sortWatchlistItems(items)));
  }, [items, ready]);

  const sortedItems = useMemo(() => sortWatchlistItems(items), [items]);

  const value = useMemo<WatchlistContextValue>(
    () => ({
      items: sortedItems,
      ready,
      isFollowing: (symbol) => {
        const key = normalize(symbol);
        return items.some((item) => normalize(item.symbol) === key);
      },
      addFollow: (item) => {
        const key = normalize(item.symbol);
        setItems((prev) => {
          if (prev.some((existing) => normalize(existing.symbol) === key)) return prev;
          return [item, ...prev];
        });
      },
      removeFollow: (symbol) => {
        const key = normalize(symbol);
        setItems((prev) => prev.filter((item) => normalize(item.symbol) !== key));
      },
      toggleFollow: (item) => {
        const key = normalize(item.symbol);
        setItems((prev) => {
          const exists = prev.some((existing) => normalize(existing.symbol) === key);
          if (exists) return prev.filter((existing) => normalize(existing.symbol) !== key);
          return [item, ...prev];
        });
      },
    }),
    [sortedItems, items, ready]
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error("useWatchlist must be used inside WatchlistProvider");
  }
  return context;
}
