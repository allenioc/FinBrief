"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ArticleType } from "@/lib/types";

interface ArticleThumbnailProps {
  src: string;
  alt: string;
  fallbackLabel: string;
  fallbackSub?: string;
  fallbackTitle?: string;
  fallbackKind?: ArticleType;
  priority?: boolean;
  sizes?: string;
  className?: string;
}

type LoadState = "loading" | "loaded" | "fallback";

const FALLBACK_TIMEOUT_MS = 2800;
const SAFE_EXTERNAL_IMAGE_HOSTS = new Set([
  "s.yimg.com",
  "media.zenfs.com",
  "image.cnbcfm.com",
  "images.wsj.net",
  "images.barrons.com",
  "images.marketwatch.com",
  "static.seekingalpha.com",
  "www.reuters.com",
  "images.reuters.com",
  "www.bloomberg.com",
  "assets.bwbx.io",
  "images.unsplash.com",
]);
const SAFE_EXTERNAL_IMAGE_HOST_SUFFIXES = [
  ".yimg.com",
  ".reuters.com",
  ".bloomberg.com",
];

function isSafeRemoteImageSource(value: string): boolean {
  if (!value) return false;
  if (value.startsWith("/")) return true;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const hostname = parsed.hostname.toLowerCase();
    if (SAFE_EXTERNAL_IMAGE_HOSTS.has(hostname)) return true;
    return SAFE_EXTERNAL_IMAGE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  } catch {
    return false;
  }
}

function gradientClass(kind?: ArticleType): string {
  if (kind === "macro news" || kind === "market news") {
    return "bg-gradient-to-br from-slate-100 via-sky-100 to-blue-200";
  }
  if (kind === "ETF/index news") {
    return "bg-gradient-to-br from-indigo-100 via-blue-100 to-cyan-100";
  }
  if (kind === "sector news") {
    return "bg-gradient-to-br from-emerald-100 via-cyan-50 to-blue-100";
  }
  return "bg-gradient-to-br from-fin-brand-soft via-fin-muted to-fin-bg";
}

export function ArticleThumbnail({
  src,
  alt,
  fallbackLabel,
  fallbackSub,
  fallbackTitle,
  fallbackKind,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
  className = "object-cover transition-transform duration-500 group-hover:scale-[1.03]",
}: ArticleThumbnailProps) {
  const [state, setState] = useState<LoadState>("loading");
  const timerRef = useRef<number | null>(null);
  const hasSetFallback = useRef(false);
  const isMissingSource = !src || !src.trim();
  const isSafeSource = isSafeRemoteImageSource(src.trim());
  const stableGradient = useMemo(() => gradientClass(fallbackKind), [fallbackKind]);

  useEffect(() => {
    hasSetFallback.current = false;
    setState(isMissingSource || !isSafeSource ? "fallback" : "loading");
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isMissingSource && isSafeSource) {
      timerRef.current = window.setTimeout(() => {
        hasSetFallback.current = true;
        setState("fallback");
      }, FALLBACK_TIMEOUT_MS);
    }
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [src, isMissingSource, isSafeSource]);

  if (state === "fallback") {
    return (
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center px-6 text-center ${stableGradient}`}
        role="img"
        aria-label={alt}
      >
        <span className="font-mono text-sm font-bold uppercase tracking-wider text-fin-brand">
          {fallbackLabel}
        </span>
        {fallbackSub && (
          <span className="mt-2 max-w-xs text-xs text-fin-subtle">{fallbackSub}</span>
        )}
        {fallbackTitle && <span className="mt-3 line-clamp-2 max-w-xs text-sm font-medium text-fin-navy">{fallbackTitle}</span>}
      </div>
    );
  }

  return (
    <>
      <Image
        src={src}
        alt={alt}
        fill
        className={`${className} transition-opacity duration-300 ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
        sizes={sizes}
        priority={priority}
        onError={() => {
          if (hasSetFallback.current) return;
          hasSetFallback.current = true;
          setState("fallback");
        }}
        onLoad={(event) => {
          const img = event.currentTarget as HTMLImageElement;
          if (!img.naturalWidth || !img.naturalHeight) {
            hasSetFallback.current = true;
            setState("fallback");
            return;
          }
          if (timerRef.current) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          if (!hasSetFallback.current) {
            setState("loaded");
          }
        }}
      />
      {state === "loading" && (
        <div className={`absolute inset-0 ${stableGradient}`} aria-hidden />
      )}
    </>
  );
}
