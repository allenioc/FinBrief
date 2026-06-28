"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Brief } from "@/lib/types";
import { enrichBrief, stripSavedExplanationFields } from "@/lib/article-analysis";
import { peekDashboardReturnHref } from "@/lib/dashboard-scroll-restore";
import { ArticleDetail } from "./ArticleDetail";
import { ArticleBriefFloatingBack } from "./ArticleBriefFloatingBack";

/**
 * Resolves the clicked article in the browser. Server caches on Vercel are
 * per-instance, so the most reliable sources are:
 * 1. sessionStorage (stashed by the Dashboard card the user clicked),
 * 2. the saved article index / editions via /api/news?articleId=...,
 * 3. the current daily edition (normal cache rules; no fresh/nocache params).
 */
export function ArticleBriefClient({
  id,
  initialArticle,
}: {
  id: string;
  initialArticle: Brief | null;
}) {
  const [article, setArticle] = useState<Brief | null>(() =>
    initialArticle ? enrichBrief(stripSavedExplanationFields(initialArticle)) : null
  );
  const [resolved, setResolved] = useState<boolean>(Boolean(initialArticle));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    if (article) return;
    let cancelled = false;

    const finish = (found: Brief | null) => {
      if (cancelled) return;
      if (found) setArticle(enrichBrief(stripSavedExplanationFields(found)));
      setResolved(true);
    };

    const resolve = async () => {
      try {
        const stashed = sessionStorage.getItem(`finbrief-article-${id}`);
        if (stashed) {
          finish(JSON.parse(stashed) as Brief);
          return;
        }
      } catch {
        // Ignore storage errors and fall through to the API.
      }

      try {
        const response = await fetch(`/api/news?articleId=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        if (response.ok) {
          const payload = (await response.json()) as { found: boolean; article?: Brief };
          if (payload.found && payload.article) {
            finish(payload.article);
            return;
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
          finish(payload.briefs?.find((brief) => brief.id === id) ?? null);
          return;
        }
      } catch {
        // Nothing else to try.
      }
      finish(null);
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [article, id]);

  if (!article && !resolved) {
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
    </div>
  );
}
