/**
 * Server-only article lookup for /brief/[id].
 *
 * On Vercel, the page and /api/news can run on different lambda instances
 * that do not share memory or /tmp, so the lookup asks the API route (which
 * owns the saved editions and article index) over HTTP instead of relying on
 * this process's local cache alone.
 *
 * Resolution order:
 * 1. This process's article index (works in dev / warm same-instance cases).
 * 2. /api/news?articleId=... — searches the saved index, editions, and last
 *    good payload. Never calls live providers.
 * 3. Mock/demo articles.
 * 4. The current daily edition via /api/news (normal cache rules, no
 *    fresh/nocache params), searched unfiltered.
 */
import type { Brief } from "./types";
import { cacheGet } from "./news-cache";
import { MOCK_BRIEFS } from "./articles-data";

function apiBaseUrl(): string {
  const envBase =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  return envBase || `http://localhost:${process.env.PORT ?? "3000"}`;
}

async function fetchArticleFromApi(id: string): Promise<Brief | undefined> {
  try {
    const url = `${apiBaseUrl()}/api/news?articleId=${encodeURIComponent(id)}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as { found: boolean; article?: Brief };
    return payload.found ? payload.article : undefined;
  } catch {
    return undefined;
  }
}

async function fetchFromCurrentEdition(id: string): Promise<Brief | undefined> {
  try {
    const params = new URLSearchParams({ timeRange: "week", limit: "20", page: "1" });
    const response = await fetch(`${apiBaseUrl()}/api/news?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as { briefs?: Brief[] };
    return payload.briefs?.find((brief) => brief.id === id);
  } catch {
    return undefined;
  }
}

export async function findArticleById(id: string): Promise<Brief | undefined> {
  const indexed = await cacheGet<Brief>(`article::${id}`);
  if (indexed) return indexed.value;

  const viaApi = await fetchArticleFromApi(id);
  if (viaApi) return viaApi;

  const mock = MOCK_BRIEFS.find((brief) => brief.id === id);
  if (mock) return mock;

  return fetchFromCurrentEdition(id);
}
