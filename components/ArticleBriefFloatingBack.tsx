"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  peekDashboardReturnHref,
  readDashboardScroll,
} from "@/lib/dashboard-scroll-restore";

const MOBILE_MEDIA = "(max-width: 767px)";
const NEAR_TOP_PX = 48;
const SCROLLED_IN_PX = 96;
const SCROLL_UP_DELTA = -6;
const SCROLL_DOWN_DELTA = 6;

function ChevronLeftIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function ArticleBriefFloatingBack({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const handleBack = useCallback(() => {
    const returnHref = peekDashboardReturnHref(fallbackHref);
    const savedReturn = readDashboardScroll();

    if (savedReturn) {
      router.push(returnHref);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(returnHref);
  }, [fallbackHref, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(MOBILE_MEDIA);
    const syncEnabled = () => setEnabled(media.matches);
    syncEnabled();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncEnabled);
    } else {
      media.addListener(syncEnabled);
    }

    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", syncEnabled);
      } else {
        media.removeListener(syncEnabled);
      }
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return;
    }

    let lastScrollY = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const delta = scrollY - lastScrollY;

        if (scrollY <= NEAR_TOP_PX) {
          setVisible(false);
        } else if (scrollY >= SCROLLED_IN_PX) {
          if (delta <= SCROLL_UP_DELTA) {
            setVisible(true);
          } else if (delta >= SCROLL_DOWN_DELTA) {
            setVisible(false);
          }
        }

        lastScrollY = scrollY;
        ticking = false;
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <button
      type="button"
      aria-label="Back"
      onClick={handleBack}
      className={`fixed z-50 flex h-11 w-11 items-center justify-center rounded-full border border-fin-border/80 bg-fin-surface/92 text-fin-navy shadow-[var(--shadow-float)] backdrop-blur-md transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fin-brand md:hidden ${
        visible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-1 opacity-0"
      }`}
      style={{
        left: "max(1rem, env(safe-area-inset-left))",
        // When visible, the shell nav has scrolled away; sticky TopBar/search is ~4.5rem
        top: "calc(env(safe-area-inset-top, 0px) + 4.75rem)",
      }}
    >
      <ChevronLeftIcon />
    </button>
  );
}
