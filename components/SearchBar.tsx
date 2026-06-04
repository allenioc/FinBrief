"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function SearchBar({
  placeholder = "Search ticker or topic — AAPL, SPY, inflation, interest rates…",
  trending = [] as string[],
}: {
  placeholder?: string;
  trending?: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  function searchTrending(term: string) {
    setQuery(term);
    router.push(`/?q=${encodeURIComponent(term)}`);
  }

  return (
    <div className="fin-panel w-full">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-full border border-fin-border bg-fin-muted py-3 pl-11 pr-4 text-sm text-fin-navy placeholder:text-fin-subtle focus:border-fin-brand focus:outline-none focus:ring-2 focus:ring-fin-brand/20"
            aria-label="Search ticker or topic"
          />
          <svg
            className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fin-subtle"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <button type="submit" className="fin-btn-primary shrink-0 px-8">
          Get briefings
        </button>
      </form>
      {trending.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-fin-border pt-4">
          <span className="fin-label">Popular</span>
          {trending.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => searchTrending(term)}
              className="rounded-full border border-fin-border bg-fin-surface px-3 py-1 font-mono text-xs font-medium text-fin-navy transition-colors hover:border-fin-brand hover:bg-fin-brand-soft hover:text-fin-brand"
            >
              {term}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
