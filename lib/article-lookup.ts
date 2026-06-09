/**
 * Server-only article lookup for /brief/[id].
 *
 * Resolution order:
 * 1. The per-article index written by /api/news whenever it saves an edition.
 * 2. Mock/demo articles (for demo cards).
 * 3. The current saved daily edition (same source as the Dashboard; this read
 *    goes through /api/news cache rules and never forces a fresh provider call).
 */
import type { Brief } from "./types";
import { cacheGet } from "./news-cache";
import { MOCK_BRIEFS } from "./articles-data";
import { getBriefs } from "./briefs";

export async function findArticleById(id: string): Promise<Brief | undefined> {
  const indexed = await cacheGet<Brief>(`article::${id}`);
  if (indexed) return indexed.value;

  const mock = MOCK_BRIEFS.find((brief) => brief.id === id);
  if (mock) return mock;

  const editionBriefs = await getBriefs("");
  return editionBriefs.find((brief) => brief.id === id);
}
