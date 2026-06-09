import type { Brief, BriefResponse } from "./types";
import { MOCK_BRIEFS } from "./articles-data";
import { fromTopicSlug, toTopicSlug } from "./slug";

const liveBriefCache = new Map<string, Brief>();

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function dailyEditionKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `business-news-feed-${yyyy}-${mm}-${dd}`;
}

function matchesBrief(brief: Brief, query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;

  const haystack = [
    brief.ticker,
    brief.topic,
    brief.headline,
    brief.summary,
    brief.excerpt,
    brief.id,
    ...brief.keyAffectedAssets,
  ]
    .join(" ")
    .toLowerCase();

  const aliases: Record<string, string[]> = {
    inflation: ["inflation", "cpi"],
    "interest rates": ["interest", "rates", "fed", "spy"],
    rates: ["interest", "rates", "fed"],
    tech: ["technology", "xlk", "ai", "qqq"],
    xlk: ["technology", "xlk", "sector"],
    nvda: ["nvidia", "nvda", "semiconductor", "ai"],
    nvidia: ["nvidia", "nvda"],
  };

  const terms = aliases[q] ?? [q];
  return terms.some((term) => haystack.includes(term));
}

export function searchBriefs(query: string): Brief[] {
  const q = normalizeQuery(query);
  if (!q) return MOCK_BRIEFS;
  const filtered = MOCK_BRIEFS.filter((b) => matchesBrief(b, q));
  return filtered.length > 0 ? filtered : MOCK_BRIEFS.slice(0, 3);
}

function cacheBriefs(briefs: Brief[]) {
  briefs.forEach((brief) => liveBriefCache.set(brief.id, brief));
}

function localBriefById(id: string): Brief | undefined {
  return liveBriefCache.get(id) ?? MOCK_BRIEFS.find((b) => b.id === id);
}

export async function getBriefById(id: string): Promise<Brief | undefined> {
  const existing = localBriefById(id);
  if (existing) return existing;

  const queries = ["", "aapl", "tsla", "spy", "qqq", "inflation", "interest rates"];
  for (const query of queries) {
    const briefs = await getBriefs(query);
    const match = briefs.find((brief) => brief.id === id);
    if (match) return match;
  }

  return undefined;
}

export async function getBriefsForTopic(slug: string): Promise<Brief[]> {
  const symbol = fromTopicSlug(slug);
  const q = symbol.toLowerCase();
  const localResults = MOCK_BRIEFS.filter(
    (b) =>
      b.ticker.toLowerCase() === q ||
      b.topic.toLowerCase().includes(q) ||
      b.keyAffectedAssets.some((a) => a.toLowerCase() === q || a.toLowerCase().includes(q)) ||
      toTopicSlug(b.ticker) === slug ||
      toTopicSlug(b.topic) === slug
  );
  const live = await getBriefs(symbol);
  const merged = [...live];
  localResults.forEach((item) => {
    if (!merged.some((brief) => brief.id === item.id)) merged.push(item);
  });
  cacheBriefs(merged);
  return merged.length > 0 ? merged : searchBriefs(symbol);
}

export async function fetchBriefsFromApi(query: string): Promise<BriefResponse | null> {
  try {
    const params = new URLSearchParams({ q: query || "" });
    params.set("limit", "24");
    params.set("page", "1");
    params.set("edition", dailyEditionKey());
    const localhostBase = `http://localhost:${process.env.PORT ?? "3000"}`;
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const resolvedBase =
      baseUrl || (typeof window === "undefined" ? localhostBase : "");
    const url = resolvedBase ? `${resolvedBase}/api/news?${params}` : `/api/news?${params}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const payload = (await res.json()) as { query: string; briefs: Brief[]; provider?: string };
    return { query: payload.query, briefs: payload.briefs, provider: payload.provider };
  } catch {
    return null;
  }
}

function isEnrichedBrief(brief: Brief): boolean {
  return Boolean(
    brief.imageUrl &&
      brief.imageAlt &&
      brief.thirtySecondVersion &&
      brief.recommendedNext?.length
  );
}

export async function getBriefs(query: string): Promise<Brief[]> {
  const api = await fetchBriefsFromApi(query);
  if (api) {
    const briefs = api.briefs.filter(isEnrichedBrief);
    if (briefs.length > 0) {
      cacheBriefs(briefs);
    }
    // Trust live provider responses (including empty results) so we don't silently
    // fall back to stale demo cards when the provider is online.
    if (api.provider && api.provider !== "mock") {
      return briefs;
    }
    if (briefs.length > 0) {
      return briefs;
    }
  }
  const fallback = searchBriefs(query);
  cacheBriefs(fallback);
  return fallback;
}
