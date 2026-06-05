"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BRAND, SIDEBAR_NAV } from "@/lib/theme";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href.includes("focus=search")) return pathname === "/";
  const base = href.split("?")[0];
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-fin-border bg-fin-sidebar">
      <div className="border-b border-fin-border px-5 py-5">
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
        {SIDEBAR_NAV.map((section) => (
          <div key={section.label} className="mb-5">
            <p className="mb-2 px-3 fin-label">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href + item.label}>
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
