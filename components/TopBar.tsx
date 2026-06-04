"use client";

import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { pageTitle } from "@/lib/theme";
import { ThemeToggle } from "./ThemeToggle";

export function TopBar({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const title = pageTitle(pathname);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-fin-border bg-fin-surface/90 backdrop-blur-md">
      <div className="flex h-[72px] flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="min-w-0 flex-1 lg:max-w-[200px]">
          <p className="fin-label hidden sm:block">Current view</p>
          <h1 className="truncate text-lg font-bold text-fin-navy sm:text-xl">{title}</h1>
        </div>

        <form
          onSubmit={onSearch}
          className="order-3 w-full lg:order-none lg:mx-4 lg:max-w-md lg:flex-1"
          role="search"
        >
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tickers, ETFs, topics…"
              className="w-full rounded-full border border-fin-border bg-fin-muted py-2.5 pl-10 pr-4 text-sm text-fin-navy placeholder:text-fin-subtle focus:border-fin-brand focus:outline-none focus:ring-2 focus:ring-fin-brand/20"
              aria-label="Search FinBrief"
            />
            <svg
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fin-subtle"
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
        </form>

        <div className="flex items-center gap-2">
          {children}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
