import type { Brief, BriefResponse } from "./types";
import { MOCK_BRIEFS } from "./articles-data";
import { fromTopicSlug, toTopicSlug } from "./slug";

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
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

export function getBriefById(id: string): Brief | undefined {
  return MOCK_BRIEFS.find((b) => b.id === id);
}

export function getBriefsForTopic(slug: string): Brief[] {
  const symbol = fromTopicSlug(slug);
  const q = symbol.toLowerCase();
  const results = MOCK_BRIEFS.filter(
    (b) =>
      b.ticker.toLowerCase() === q ||
      b.topic.toLowerCase().includes(q) ||
      b.keyAffectedAssets.some((a) => a.toLowerCase() === q || a.toLowerCase().includes(q)) ||
      toTopicSlug(b.ticker) === slug ||
      toTopicSlug(b.topic) === slug
  );
  return results.length > 0 ? results : searchBriefs(symbol);
}

export async function fetchBriefsFromApi(query: string): Promise<BriefResponse | null> {
  try {
    const params = new URLSearchParams({ q: query || "" });
    const res = await fetch(`/api/brief?${params}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as BriefResponse;
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
  if (api?.briefs?.length && api.briefs.every(isEnrichedBrief)) {
    return api.briefs;
  }
  return searchBriefs(query);
}
