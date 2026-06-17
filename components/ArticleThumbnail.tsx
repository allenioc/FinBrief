"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isDisplayableRemoteImage,
  isOptimizableRemoteImage,
} from "@/lib/image-remote-hosts";
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

function FallbackVisual({
  alt,
  fallbackLabel,
  fallbackSub,
  fallbackTitle,
  gradient,
}: {
  alt: string;
  fallbackLabel: string;
  fallbackSub?: string;
  fallbackTitle?: string;
  gradient: string;
}) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center px-6 text-center ${gradient}`}
      role="img"
      aria-label={alt}
    >
      <span className="font-mono text-sm font-bold uppercase tracking-wider text-fin-brand">
        {fallbackLabel}
      </span>
      {fallbackSub && <span className="mt-2 max-w-xs text-xs text-fin-subtle">{fallbackSub}</span>}
      {fallbackTitle && (
        <span className="mt-3 line-clamp-2 max-w-xs text-sm font-medium text-fin-navy">
          {fallbackTitle}
        </span>
      )}
    </div>
  );
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
  const trimmedSrc = src?.trim() ?? "";
  const canDisplay = isDisplayableRemoteImage(trimmedSrc);
  const useNextImage = canDisplay && isOptimizableRemoteImage(trimmedSrc);
  const stableGradient = useMemo(() => gradientClass(fallbackKind), [fallbackKind]);
  const loadingClass = `${className} transition-opacity duration-300 ${
    state === "loaded" ? "opacity-100" : "opacity-0"
  }`;

  const showFallback = useCallback(() => {
    if (hasSetFallback.current) return;
    hasSetFallback.current = true;
    setState("fallback");
  }, []);

  const markLoaded = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!hasSetFallback.current) {
      setState("loaded");
    }
  }, []);

  const handleImageLoad = useCallback(
    (naturalWidth: number, naturalHeight: number) => {
      if (!naturalWidth || !naturalHeight) {
        showFallback();
        return;
      }
      markLoaded();
    },
    [markLoaded, showFallback]
  );

  useEffect(() => {
    hasSetFallback.current = false;
    if (!canDisplay) {
      setState("fallback");
      return;
    }
    setState("loading");
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    timerRef.current = window.setTimeout(showFallback, FALLBACK_TIMEOUT_MS);
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [canDisplay, showFallback, trimmedSrc]);

  if (state === "fallback") {
    return (
      <FallbackVisual
        alt={alt}
        fallbackLabel={fallbackLabel}
        fallbackSub={fallbackSub}
        fallbackTitle={fallbackTitle}
        gradient={stableGradient}
      />
    );
  }

  if (useNextImage) {
    return (
      <>
        <Image
          src={trimmedSrc}
          alt={alt}
          fill
          className={loadingClass}
          sizes={sizes}
          priority={priority}
          onError={showFallback}
          onLoad={(event) => {
            const img = event.currentTarget;
            handleImageLoad(img.naturalWidth, img.naturalHeight);
          }}
        />
        {state === "loading" && <div className={`absolute inset-0 ${stableGradient}`} aria-hidden />}
      </>
    );
  }

  return (
    <>
      <img
        src={trimmedSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={`absolute inset-0 h-full w-full ${loadingClass}`}
        sizes={sizes}
        onError={showFallback}
        onLoad={(event) => {
          handleImageLoad(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
        }}
      />
      {state === "loading" && <div className={`absolute inset-0 ${stableGradient}`} aria-hidden />}
    </>
  );
}
