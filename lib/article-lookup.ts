/**
 * Server-only best-effort article lookup for /brief/[id].
 *
 * Checks this process's saved article index (written by /api/news when an
 * edition is saved) and the mock/demo articles. On Vercel, caches are
 * per-instance, so a miss here is normal — the client component then resolves
 * the article from sessionStorage or the API. Never calls live providers.
 */
import type { Brief } from "./types";
import { enrichBrief, stripSavedExplanationFields } from "./article-analysis";
import { cacheGet } from "./news-cache";
import { MOCK_BRIEFS } from "./articles-data";

export async function findArticleLocally(id: string): Promise<Brief | null> {
  const indexed = await cacheGet<Brief>(`article::${id}`);
  if (indexed) return enrichBrief(stripSavedExplanationFields(indexed.value));
  const mock = MOCK_BRIEFS.find((brief) => brief.id === id);
  return mock ? enrichBrief(stripSavedExplanationFields(mock)) : null;
}
