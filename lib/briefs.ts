import type { Brief, BriefResponse } from "./types";
import { MOCK_BRIEFS } from "./articles-data";
import { DAILY_EDITION_ARTICLE_LIMIT } from "./news-constants";
import { enrichBriefImage } from "./article-image";
import { fromTopicSlug } from "./slug";
import { filterBriefsForTopic } from "./topic-stories";

const liveBriefCache = new Map<string, Brief>();

function dailyEditionKey(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `business-news-feed-${yyyy}-${mm}-${dd}`;
}

function cacheBriefs(briefs: Brief[]) {
  briefs.forEach((brief) => liveBriefCache.set(brief.id, brief));
}

function isEnrichedBrief(brief: Brief): boolean {
  return Boolean(brief.thirtySecondVersion && brief.recommendedNext?.length && brief.headline);
}

function normalizeBriefs(briefs: Brief[]): Brief[] {
  const enriched = briefs.map(enrichBriefImage);
  const filtered = enriched.filter(isEnrichedBrief);
  return filtered.length > 0 ? filtered : enriched;
}

export async function fetchBroadEditionFromApi(): Promise<BriefResponse | null> {
  try {
    const params = new URLSearchParams();
    params.set("timeRange", "week");
    params.set("limit", String(DAILY_EDITION_ARTICLE_LIMIT));
    params.set("page", "1");
    params.set("edition", dailyEditionKey());
    const localhostBase = `http://localhost:${process.env.PORT ?? "3000"}`;
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const resolvedBase = baseUrl || (typeof window === "undefined" ? localhostBase : "");
    const url = resolvedBase ? `${resolvedBase}/api/news?${params}` : `/api/news?${params}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const payload = (await res.json()) as { query: string; briefs: Brief[]; provider?: string };
    return { query: payload.query, briefs: payload.briefs, provider: payload.provider };
  } catch {
    return null;
  }
}

export async function getBriefsForTopic(slug: string): Promise<Brief[]> {
  const topicQuery = fromTopicSlug(slug);
  return getBriefs(topicQuery);
}

export async function getBriefs(query: string): Promise<Brief[]> {
  const api = await fetchBroadEditionFromApi();
  if (api) {
    const briefs = normalizeBriefs(api.briefs);
    if (briefs.length > 0) {
      cacheBriefs(briefs);
    }
    if (api.provider && api.provider !== "mock") {
      return query.trim() ? filterBriefsForTopic(briefs, query) : briefs;
    }
    if (briefs.length > 0) {
      return query.trim() ? filterBriefsForTopic(briefs, query) : briefs;
    }
  }

  const fallback = query.trim() ? filterBriefsForTopic(MOCK_BRIEFS, query) : MOCK_BRIEFS;
  cacheBriefs(fallback);
  return fallback.map(enrichBriefImage);
}

export async function fetchBriefsFromApi(): Promise<BriefResponse | null> {
  return fetchBroadEditionFromApi();
}

export function searchBriefs(query: string): Brief[] {
  return filterBriefsForTopic(MOCK_BRIEFS, query, MOCK_BRIEFS.length);
}
