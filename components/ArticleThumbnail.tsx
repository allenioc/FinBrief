"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { gradientForFallbackImage } from "@/lib/article-image";
import type { ArticleImageMode } from "@/lib/article-image";
import {
  isDisplayableRemoteImage,
  isOptimizableRemoteImage,
} from "@/lib/image-remote-hosts";
import type { ArticleType } from "@/lib/types";

interface ArticleThumbnailProps {
  articleId: string;
  src: string;
  alt: string;
  imageDisplay?: ArticleImageMode;
  fallbackImageId?: string;
  fallbackLabel: string;
  fallbackSub?: string;
  fallbackTitle?: string;
  fallbackKind?: ArticleType;
  priority?: boolean;
  sizes?: string;
  className?: string;
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
  articleId,
  src,
  alt,
  imageDisplay = "provider",
  fallbackImageId,
  fallbackLabel,
  fallbackSub,
  fallbackTitle,
  fallbackKind,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
  className = "object-cover transition-transform duration-500 group-hover:scale-[1.03]",
}: ArticleThumbnailProps) {
  const trimmedSrc = src?.trim() ?? "";
  const tryProvider = imageDisplay !== "fallback" && isDisplayableRemoteImage(trimmedSrc);
  const stableFallbackId = fallbackImageId || articleId;
  const stableGradient = useMemo(
    () => gradientForFallbackImage(stableFallbackId, fallbackKind),
    [stableFallbackId, fallbackKind]
  );
  const useNextImage = tryProvider && isOptimizableRemoteImage(trimmedSrc);
  const [providerVisible, setProviderVisible] = useState(false);

  useEffect(() => {
    setProviderVisible(false);
  }, [articleId, trimmedSrc, imageDisplay]);

  const onProviderLoad = useCallback((naturalWidth: number, naturalHeight: number) => {
    if (naturalWidth > 0 && naturalHeight > 0) {
      setProviderVisible(true);
    }
  }, []);

  const onProviderError = useCallback(() => {
    setProviderVisible(false);
  }, []);

  const overlayClass = `${className} transition-opacity duration-300 ${
    providerVisible ? "opacity-100" : "opacity-0 pointer-events-none"
  }`;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <FallbackVisual
        alt={alt}
        fallbackLabel={fallbackLabel}
        fallbackSub={fallbackSub}
        fallbackTitle={fallbackTitle}
        gradient={stableGradient}
      />
      {tryProvider && useNextImage && (
        <Image
          src={trimmedSrc}
          alt={alt}
          fill
          className={overlayClass}
          sizes={sizes}
          priority={priority}
          onError={onProviderError}
          onLoad={(event) => {
            const img = event.currentTarget;
            onProviderLoad(img.naturalWidth, img.naturalHeight);
          }}
        />
      )}
      {tryProvider && !useNextImage && (
        <img
          src={trimmedSrc}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className={`absolute inset-0 h-full w-full ${overlayClass}`}
          sizes={sizes}
          onError={onProviderError}
          onLoad={(event) => {
            onProviderLoad(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
          }}
        />
      )}
    </div>
  );
}
