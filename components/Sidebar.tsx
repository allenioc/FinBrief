"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { BRAND, SIDEBAR_NAV } from "@/lib/theme";
import { useWatchlist } from "./WatchlistProvider";

function isActive(pathname: string, href: string, searchParams: URLSearchParams): boolean {
  if (href.startsWith("/?q=")) {
    const url = new URL(href, "http://localhost");
    const topic = url.searchParams.get("q");
    return pathname === "/" && searchParams.get("q") === topic;
  }
  if (href === "/") return pathname === "/" && !searchParams.get("q");
  const base = href.split("?")[0];
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function Sidebar({
  onNavigate,
  onClose,
}: {
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { items } = useWatchlist();

  const followingItems = items.map((item) => ({
    label: item.symbol,
    href: `/?q=${encodeURIComponent(item.symbol)}`,
  }));

  const navSections = [
    ...SIDEBAR_NAV,
    ...(followingItems.length > 0
      ? [{ label: "Following", items: followingItems }]
      : []),
  ];

  return (
    <aside className="flex h-full w-full shrink-0 flex-col border-r border-fin-border bg-fin-sidebar shadow-float lg:w-[260px]">
      <div className="relative border-b border-fin-border px-5 py-5 pr-14">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-xl border border-fin-border bg-fin-surface p-2 text-fin-navy shadow-sm transition-colors hover:bg-fin-muted"
            aria-label="Close navigation menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <Link href="/" className="flex items-center gap-3" onClick={onNavigate}>
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl border border-fin-border bg-fin-surface shadow-sm">
            <Image
              src="/finbrief-logo-square.svg"
              alt="FinBrief logo"
              width={40}
              height={40}
              className="h-full w-full object-cover"
              priority
            />
          </span>
          <div>
            <span className="block text-lg font-bold tracking-tight text-fin-navy">
              {BRAND.name}
            </span>
            <span className="block text-xs text-fin-subtle">{BRAND.tagline}</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
        {navSections.map((section) => (
          <div key={section.label} className="mb-5">
            <p className="mb-2 px-3 fin-label">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href, searchParams);
                return (
                  <li key={`${section.label}-${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={`block rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-fin-sidebar-active text-fin-brand"
                          : "text-fin-text hover:bg-fin-muted hover:text-fin-navy"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-fin-border px-5 py-4">
        <p className="text-xs leading-relaxed text-fin-subtle">
          Educational summaries only. Not investment advice.
        </p>
      </div>
    </aside>
  );
}
