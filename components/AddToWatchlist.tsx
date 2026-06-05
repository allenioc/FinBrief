"use client";

import { FormEvent, useState } from "react";
import { WATCHLIST_SUGGESTIONS } from "@/lib/watchlist-data";
import { createWatchlistItem } from "@/lib/watchlist-utils";
import { useWatchlist } from "./WatchlistProvider";

export function AddToWatchlist() {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const { addFollow, removeFollow, isFollowing } = useWatchlist();

  function addItem(symbol: string, name?: string, type?: (typeof WATCHLIST_SUGGESTIONS)[number]["type"]) {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) return;
    const label = name ? `${normalized} (${name})` : normalized;
    if (isFollowing(normalized)) {
      removeFollow(normalized);
      setMessage(`${label} removed from watchlist.`);
    } else {
      addFollow(
        createWatchlistItem({
          symbol: normalized,
          name,
          type,
        })
      );
      setMessage(`${label} added to watchlist.`);
    }
    setQuery("");
    setTimeout(() => setMessage(null), 3200);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    addItem(trimmed);
  }

  return (
    <section className="fin-panel">
      <h2 className="fin-section-title">Add to watchlist</h2>
      <p className="mt-2 text-sm text-fin-subtle">
        Search a ticker, ETF, sector, or macro topic. Mock flow — not persisted.
      </p>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. GOOGL, XLK, Energy…"
          className="flex-1 rounded-full border border-fin-border bg-fin-muted px-4 py-2.5 text-sm focus:border-fin-brand focus:outline-none focus:ring-2 focus:ring-fin-brand/20"
          aria-label="Symbol or topic to add"
        />
        <button type="submit" disabled={!query.trim()} className="fin-btn-primary disabled:opacity-50">
          Add to watchlist
        </button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {WATCHLIST_SUGGESTIONS.map((item) => (
          <button
            key={item.symbol}
            type="button"
          onClick={() => addItem(item.symbol, item.name, item.type)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            isFollowing(item.symbol)
              ? "border-status-negative/30 bg-status-negative-bg text-status-negative hover:opacity-90"
              : "border-fin-border text-fin-navy hover:border-fin-brand hover:bg-fin-brand-soft"
          }`}
          >
          {isFollowing(item.symbol) ? `Unfollow ${item.symbol}` : `Follow ${item.symbol}`}
          </button>
        ))}
      </div>

      {message && (
        <p role="status" className="mt-4 rounded-2xl bg-fin-brand-soft px-4 py-2 text-sm font-medium text-fin-brand">
          {message}
        </p>
      )}
    </section>
  );
}
