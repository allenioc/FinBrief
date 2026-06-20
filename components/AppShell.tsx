"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Sidebar } from "./Sidebar";
import { SiteFooter } from "./SiteFooter";

const DRAWER_TRANSITION_MS = 300;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileNavVisible, setMobileNavVisible] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const openMobileNav = useCallback(() => {
    setMobileNavVisible(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setMobileNavOpen(true));
    });
  }, []);

  const closeMobileNav = useCallback(() => {
    setMobileNavOpen(false);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen && mobileNavVisible) {
      const timeout = window.setTimeout(() => setMobileNavVisible(false), DRAWER_TRANSITION_MS);
      return () => window.clearTimeout(timeout);
    }
  }, [mobileNavOpen, mobileNavVisible]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    if (!mobileNavVisible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMobileNav();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeMobileNav, mobileNavVisible]);

  return (
    <div className="flex min-h-screen bg-fin-bg">
      <div className="hidden lg:flex">
        <Suspense fallback={<div className="h-full w-[260px] border-r border-fin-border bg-fin-sidebar" />}>
          <Sidebar />
        </Suspense>
      </div>

      {mobileNavVisible && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            type="button"
            className={`absolute inset-0 bg-fin-navy/40 transition-opacity duration-300 ease-out ${
              mobileNavOpen ? "opacity-100" : "opacity-0"
            }`}
            aria-label="Close menu"
            onClick={closeMobileNav}
          />
          <div
            className={`absolute inset-y-0 left-0 flex h-[100dvh] w-[min(280px,88vw)] max-w-[280px] transition-transform duration-300 ease-out ${
              mobileNavOpen ? "translate-x-0" : "-translate-x-full"
            }`}
            style={{
              paddingTop: "env(safe-area-inset-top)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <Suspense fallback={null}>
              <Sidebar onNavigate={closeMobileNav} onClose={closeMobileNav} />
            </Suspense>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-fin-border bg-fin-surface px-4 lg:hidden">
          <button
            type="button"
            onClick={openMobileNav}
            className="rounded-xl border border-fin-border p-2 text-fin-navy"
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
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
        <SiteFooter />
      </div>
    </div>
  );
}
