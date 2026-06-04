"use client";

import Image from "next/image";
import { useState } from "react";

interface ArticleThumbnailProps {
  src: string;
  alt: string;
  fallbackLabel: string;
  fallbackSub?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}

export function ArticleThumbnail({
  src,
  alt,
  fallbackLabel,
  fallbackSub,
  priority = false,
  sizes = "(max-width: 768px) 100vw, 50vw",
  className = "object-cover transition-transform duration-500 group-hover:scale-[1.03]",
}: ArticleThumbnailProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-fin-brand-soft via-fin-muted to-fin-bg px-6 text-center"
        role="img"
        aria-label={alt}
      >
        <span className="font-mono text-sm font-bold uppercase tracking-wider text-fin-brand">
          {fallbackLabel}
        </span>
        {fallbackSub && (
          <span className="mt-2 max-w-xs text-xs text-fin-subtle">{fallbackSub}</span>
        )}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className={className}
      sizes={sizes}
      priority={priority}
      onError={() => setFailed(true)}
    />
  );
}
