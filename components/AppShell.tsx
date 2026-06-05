"use client";

import { useState } from "react";
import Image from "next/image";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-fin-bg">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-fin-navy/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-[260px] shadow-float">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-fin-border bg-fin-surface px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-xl border border-fin-border p-2 text-fin-navy"
            aria-label="Open navigation menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex h-7 w-7 overflow-hidden rounded-lg border border-fin-border bg-fin-surface">
              <Image
                src="/finbrief-logo-square.svg"
                alt="FinBrief logo"
                width={28}
                height={28}
                className="h-full w-full object-cover"
              />
            </span>
            <span className="font-bold text-fin-navy">FinBrief</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
