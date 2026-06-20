import type { ArticleType, Brief } from "./types";

export type ArticleImageMode = "provider" | "fallback";

export type CachedArticleImageResolution = {
  mode: ArticleImageMode;
  imageUrl?: string;
};

const IMAGE_RESOLUTION_PREFIX = "finbrief-image-res-";

const PALETTES_BY_TYPE: Record<ArticleType, string[]> = {
  "macro news": [
    "bg-gradient-to-br from-slate-100 via-sky-100 to-blue-200",
    "bg-gradient-to-br from-indigo-50 via-slate-100 to-cyan-100",
    "bg-gradient-to-br from-blue-50 via-indigo-100 to-slate-200",
  ],
  "market news": [
    "bg-gradient-to-br from-slate-100 via-sky-100 to-blue-200",
    "bg-gradient-to-br from-zinc-100 via-blue-50 to-indigo-100",
    "bg-gradient-to-br from-sky-50 via-slate-100 to-blue-100",
  ],
  "ETF/index news": [
    "bg-gradient-to-br from-indigo-100 via-blue-100 to-cyan-100",
    "bg-gradient-to-br from-violet-100 via-indigo-50 to-blue-100",
    "bg-gradient-to-br from-blue-100 via-cyan-50 to-indigo-100",
  ],
  "sector news": [
    "bg-gradient-to-br from-emerald-100 via-cyan-50 to-blue-100",
    "bg-gradient-to-br from-teal-50 via-emerald-100 to-sky-100",
    "bg-gradient-to-br from-green-50 via-cyan-100 to-blue-50",
  ],
  "company news": [
    "bg-gradient-to-br from-fin-brand-soft via-fin-muted to-fin-bg",
    "bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100",
    "bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100",
  ],
};

const DEFAULT_PALETTES = [
  "bg-gradient-to-br from-fin-brand-soft via-fin-muted to-fin-bg",
  "bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100",
  "bg-gradient-to-br from-indigo-50 via-slate-100 to-cyan-50",
];

function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function articleTypeSlug(articleType: ArticleType | string): string {
  return articleType.replace(/\s+/g, "-").toLowerCase();
}

export function computeFallbackImageId(input: {
  id: string;
  originalUrl?: string;
  source?: string;
  articleType: ArticleType | string;
}): string {
  const seed = [input.id, input.originalUrl ?? "", input.source ?? "", input.articleType].join("|");
  const bucket = hashString(seed) % 6;
  return `${articleTypeSlug(input.articleType)}-${bucket}`;
}

export function resolveFallbackImageId(
  brief: Pick<Brief, "id" | "originalUrl" | "source" | "articleType" | "fallbackImageId">
): string {
  return (
    brief.fallbackImageId ||
    computeFallbackImageId({
      id: brief.id,
      originalUrl: brief.originalUrl,
      source: brief.source,
      articleType: brief.articleType,
    })
  );
}

export function enrichBriefImage<T extends Brief>(brief: T): T {
  const fallbackImageId = resolveFallbackImageId(brief);
  if (brief.fallbackImageId === fallbackImageId) return brief;
  return { ...brief, fallbackImageId };
}

export function gradientForFallbackImage(
  fallbackImageId: string,
  articleType?: ArticleType
): string {
  const palettes = (articleType && PALETTES_BY_TYPE[articleType]) || DEFAULT_PALETTES;
  return palettes[hashString(fallbackImageId) % palettes.length];
}

export function imageResolutionStorageKey(articleId: string): string {
  return `${IMAGE_RESOLUTION_PREFIX}${articleId}`;
}

export function readCachedImageResolution(articleId: string): CachedArticleImageResolution | null {
  if (typeof window === "undefined" || !articleId) return null;
  try {
    const raw = sessionStorage.getItem(imageResolutionStorageKey(articleId));
    if (!raw) return null;
    return JSON.parse(raw) as CachedArticleImageResolution;
  } catch {
    return null;
  }
}

export function writeCachedImageResolution(
  articleId: string,
  resolution: CachedArticleImageResolution
): void {
  if (typeof window === "undefined" || !articleId) return;
  try {
    sessionStorage.setItem(imageResolutionStorageKey(articleId), JSON.stringify(resolution));
  } catch {
    // Ignore storage errors (private mode, quota).
  }
}
