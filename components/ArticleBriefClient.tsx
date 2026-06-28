"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Brief } from "@/lib/types";
import { hydrateArticleBrief } from "@/lib/article-analysis";
import {
  EXPLANATION_COPY_VERSION,
  clearArticleBriefSessionStash,
  migrateArticleBriefExplanationCache,
} from "@/lib/explanation-cache";
import { peekDashboardReturnHref } from "@/lib/dashboard-scroll-restore";
import { ArticleDetail } from "./ArticleDetail";
import { ArticleBriefFloatingBack } from "./ArticleBriefFloatingBack";

async function fetchArticleFromApi(id: string): Promise<Brief | null> {
  try {
    const response = await fetch(`/api/news?articleId=${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (response.ok) {
      const payload = (await response.json()) as { found: boolean; article?: Brief };
      if (payload.found && payload.article) {
        return payload.article;
      }
    }
  } catch {
    // Fall through to the edition lookup.
  }

  try {
    const params = new URLSearchParams({ timeRange: "week", limit: "20", page: "1" });
    const response = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as { briefs?: Brief[] };
      return payload.briefs?.find((brief) => brief.id === id) ?? null;
    }
  } catch {
    // Nothing else to try.
  }

  return null;
}

/**
 * Resolves the clicked article in the browser. Server caches on Vercel are
 * per-instance, so the most reliable sources are:
 * 1. the saved article index / editions via /api/news?articleId=...,
 * 2. the current daily edition (normal cache rules; no fresh/nocache params),
 * 3. the server-rendered local lookup fallback.
 *
 * sessionStorage stashes are cleared on load and never used for explanation copy.
 */
export function ArticleBriefClient({
  id,
  initialArticle,
}: {
  id: string;
  initialArticle: Brief | null;
}) {
  const [article, setArticle] = useState<Brief | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    const finish = (found: Brief | null) => {
      if (cancelled) return;
      setArticle(found ? hydrateArticleBrief(found) : null);
      setResolved(true);
    };

    const resolve = async () => {
      migrateArticleBriefExplanationCache();
      clearArticleBriefSessionStash(id);

      const apiArticle = await fetchArticleFromApi(id);
      if (cancelled) return;
      if (apiArticle) {
        finish(apiArticle);
        return;
      }

      if (initialArticle) {
        finish(initialArticle);
        return;
      }

      finish(null);
    };

    setResolved(false);
    void resolve();
    return () => {
      cancelled = true;
    };
  }, [id, initialArticle]);

  if (!resolved) {
    return (
      <p className="fin-panel py-12 text-center text-sm text-fin-subtle">Loading brief…</p>
    );
  }

  if (!article) {
    return (
      <div className="fin-panel py-12 text-center">
        <h2 className="text-lg font-bold text-fin-navy">Briefing not found</h2>
        <p className="mt-2 text-sm text-fin-subtle">
          This story may have been removed or the link is incorrect.
        </p>
        <Link href="/" className="fin-link mt-4 inline-block text-sm">
          Return to dashboard
        </Link>
      </div>
    );
  }

  const backHref = peekDashboardReturnHref(
    article.ticker !== "—" ? `/?q=${encodeURIComponent(article.ticker)}` : "/"
  );

  return (
    <div>
      <Link href={backHref} className="fin-link text-sm">
        ← Back
      </Link>
      <ArticleBriefFloatingBack fallbackHref={backHref} />
      <div className="mt-6">
        <ArticleDetail article={article} />
      </div>
      <p className="sr-only" data-explanation-version={EXPLANATION_COPY_VERSION}>
        Article Brief explanation version {article.explanationVersion ?? "legacy"}
      </p>
    </div>
  );
}
