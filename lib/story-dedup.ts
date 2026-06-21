import type { Brief } from "./types";

export type StoryDedupDebug = {
  rawArticleCount: number;
  dedupedArticleCount: number;
  duplicatesRemoved: number;
};

const TRACKING_QUERY_PREFIXES = ["utm_", "mc_", "pk_", "ga_"];
const TRACKING_QUERY_KEYS = new Set([
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "msclkid",
  "ref",
  "source",
  "campaign",
  "affiliate",
  "ocid",
]);

const SECURITIES_TEMPLATE_MARKERS = [
  /class\s+action/i,
  /securities\s+fraud/i,
  /investor\s+deadline/i,
  /lead\s+plaintiff/i,
  /rosen[\s,]+(law|llp|trusted)/i,
  /shareholder\s+alert/i,
  /lawsuit/i,
];

const WIRE_SOURCE_MARKERS = [/pr\s*newswire/i, /prnewswire/i, /globe\s*newswire/i, /business\s*wire/i];

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArticleUrl(url: string): string {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (
        TRACKING_QUERY_KEYS.has(lower) ||
        TRACKING_QUERY_PREFIXES.some((prefix) => lower.startsWith(prefix))
      ) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    const search = parsed.searchParams.toString();
    return `${parsed.protocol}//${parsed.hostname}${pathname}${search ? `?${search}` : ""}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

function normalizeSource(source: string): string {
  return source.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function titleWordSet(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(" ")
      .filter((word) => word.length > 3)
  );
}

function titleWordOverlapRatio(a: string, b: string): number {
  const left = titleWordSet(a);
  const right = titleWordSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  left.forEach((word) => {
    if (right.has(word)) overlap += 1;
  });
  return overlap / Math.min(left.size, right.size);
}

export function areSimilarTitles(a: string, b: string): boolean {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const prefixLength = Math.min(50, left.length, right.length);
  if (prefixLength >= 30) {
    if (left.startsWith(right.slice(0, prefixLength)) || right.startsWith(left.slice(0, prefixLength))) {
      return true;
    }
  }

  return titleWordOverlapRatio(a, b) >= 0.85;
}

function areSameSourceSimilarHeadlines(a: Brief, b: Brief): boolean {
  const sourceA = normalizeSource(a.source);
  const sourceB = normalizeSource(b.source);
  if (!sourceA || sourceA !== sourceB) return false;

  const left = normalizeTitle(a.headline);
  const right = normalizeTitle(b.headline);
  if (!left || !right) return false;
  if (left === right) return true;

  const prefixLength = Math.min(40, left.length, right.length);
  if (prefixLength >= 24) {
    if (left.startsWith(right.slice(0, prefixLength)) || right.startsWith(left.slice(0, prefixLength))) {
      return true;
    }
  }

  return titleWordOverlapRatio(a.headline, b.headline) >= 0.72;
}

function isSecuritiesLawsuitTemplate(brief: Brief): boolean {
  const haystack = `${brief.headline} ${brief.excerpt} ${brief.source}`.toLowerCase();
  const fromWireSource = WIRE_SOURCE_MARKERS.some((pattern) => pattern.test(haystack));
  const hasTemplateMarker = SECURITIES_TEMPLATE_MARKERS.some((pattern) => pattern.test(haystack));
  return fromWireSource && hasTemplateMarker;
}

function securitiesLawsuitClusterKey(brief: Brief): string | null {
  if (!isSecuritiesLawsuitTemplate(brief)) return null;

  if (brief.ticker && brief.ticker !== "—") {
    return `securities-template::${brief.ticker.toUpperCase()}`;
  }

  const headline = normalizeTitle(brief.headline);
  const encouragesMatch = headline.match(
    /(?:encourages|reminds|announces|investigates|alerts)\s+([a-z0-9\s]{3,40}?)\s+(?:investors|stockholders|shareholders)/
  );
  if (encouragesMatch?.[1]) {
    return `securities-template::${encouragesMatch[1].trim()}`;
  }

  const againstMatch = headline.match(/against\s+([a-z0-9\s]{3,40}?)(?:\s+investors|\s+class|\s+to)/);
  if (againstMatch?.[1]) {
    return `securities-template::${againstMatch[1].trim()}`;
  }

  return null;
}

export function isHardDuplicate(a: Brief, b: Brief): boolean {
  if (a.id === b.id) return true;

  const urlA = normalizeArticleUrl(a.originalUrl);
  const urlB = normalizeArticleUrl(b.originalUrl);
  return Boolean(urlA && urlB && urlA === urlB);
}

export function isSameStory(a: Brief, b: Brief): boolean {
  if (isHardDuplicate(a, b)) return true;

  const clusterA = securitiesLawsuitClusterKey(a);
  const clusterB = securitiesLawsuitClusterKey(b);
  if (clusterA && clusterB && clusterA === clusterB) return true;

  if (areSimilarTitles(a.headline, b.headline)) return true;

  if (areSameSourceSimilarHeadlines(a, b)) return true;

  return false;
}

function hasProviderImage(brief: Brief): boolean {
  return Boolean(brief.imageUrl?.trim() && brief.imageDisplay !== "fallback");
}

function titleClarityScore(headline: string): number {
  const normalized = normalizeTitle(headline);
  if (!normalized) return 0;
  let score = Math.min(normalized.length, 120) / 10;
  if (/^[a-z0-9\s]+$/.test(normalized)) score += 2;
  if (/\b(class action|investor deadline|shareholder alert)\b/i.test(headline)) score -= 4;
  return score;
}

function sourceMetadataScore(brief: Brief): number {
  let score = 0;
  if (brief.author?.trim()) score += 2;
  if (brief.excerpt?.trim().length > 80) score += 1;
  if (brief.originalUrl?.trim()) score += 1;
  if (brief.thirtySecondVersion?.trim()) score += 1;
  return score;
}

function publishedTime(iso: string): number {
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : 0;
}

/** Higher score wins when two stories are duplicates. */
export function scoreStoryQuality(brief: Brief): number {
  let score = 0;
  if (hasProviderImage(brief)) score += 8;
  score += titleClarityScore(brief.headline);
  score += sourceMetadataScore(brief);
  score += publishedTime(brief.publishedAt) / 1e13;
  if (brief.marketImpact === "high") score += 1;
  return score;
}

export function filterUniqueStories(stories: Brief[], excluded: Brief[] = []): Brief[] {
  const kept: Brief[] = [];
  for (const story of stories) {
    if (excluded.some((item) => isSameStory(story, item))) continue;
    if (kept.some((item) => isSameStory(story, item))) continue;
    kept.push(story);
  }
  return kept;
}

export function dedupeStories(stories: Brief[]): { stories: Brief[] } & StoryDedupDebug {
  const rawArticleCount = stories.length;
  const sorted = [...stories].sort((a, b) => scoreStoryQuality(b) - scoreStoryQuality(a));
  const kept: Brief[] = [];

  for (const story of sorted) {
    if (kept.some((item) => isSameStory(story, item))) continue;
    kept.push(story);
  }

  const dedupedArticleCount = kept.length;
  return {
    stories: kept,
    rawArticleCount,
    dedupedArticleCount,
    duplicatesRemoved: rawArticleCount - dedupedArticleCount,
  };
}
