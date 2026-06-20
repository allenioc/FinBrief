"use client";

import Link from "next/link";
import type { Brief } from "@/lib/types";
import { ANALYSIS_LABEL_TOOLTIPS } from "@/lib/analysis-tooltips";
import { formatDateTime, formatPublishedTimeLabel } from "@/lib/format";
import { toTopicSlug } from "@/lib/slug";
import { watchlistItemFromBrief } from "@/lib/watchlist-utils";
import { enrichBriefImage } from "@/lib/article-image";
import { ArticleThumbnail } from "./ArticleThumbnail";
import { ArticleTypeBadge } from "./ArticleTypeBadge";
import { AssetTags } from "./AssetTags";
import { ConfidenceScore } from "./ConfidenceScore";
import { FollowToggleButton } from "./FollowToggleButton";
import { MarketImpactBadge } from "./MarketImpactBadge";
import { SentimentBadge } from "./SentimentBadge";
import { TooltipLabel } from "./Tooltip";

export function ArticleCard({
  article,
  variant = "standard",
  priorityImage = false,
}: {
  article: Brief;
  variant?: "hero" | "standard" | "compact";
  priorityImage?: boolean;
}) {
  const enriched = enrichBriefImage(article);
  const fallbackLabel = enriched.ticker !== "—" ? enriched.ticker : enriched.topic;
  const fallbackImageId = enriched.fallbackImageId;
  const imageDisplay = enriched.imageDisplay;
  const isHero = variant === "hero";
  const isCompact = variant === "compact";
  const watchlistItem = watchlistItemFromBrief(article);
  const imageAspect = isHero ? "aspect-[2/1]" : isCompact ? "aspect-[3/2]" : "aspect-[16/10]";
  const imageInset = isHero ? "inset-2 sm:inset-3" : isCompact ? "inset-2" : "inset-2 sm:inset-3";
  const imageSizes = isHero
    ? "(max-width: 768px) 100vw, 66vw"
    : isCompact
      ? "(max-width: 768px) 50vw, 240px"
      : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw";

  // Stash the full article so /brief/[id] can render it instantly without
  // depending on server-side caches (which are per-instance on Vercel).
  const stashArticle = () => {
    try {
      sessionStorage.setItem(`finbrief-article-${enriched.id}`, JSON.stringify(enriched));
    } catch {
      // Storage may be unavailable (private mode); the brief page has API fallbacks.
    }
  };

  return (
    <article
      className={`group fin-card fin-card-hover flex flex-col overflow-hidden ${
        isHero ? "sm:col-span-2" : ""
      }`}
    >
      <Link
        href={`/brief/${article.id}`}
        onClick={stashArticle}
        className={`relative block overflow-hidden bg-fin-muted ${imageAspect}`}
      >
        <div className={`absolute ${imageInset} overflow-hidden rounded-image`}>
          <ArticleThumbnail
            articleId={enriched.id}
            src={enriched.imageUrl}
            imageDisplay={imageDisplay}
            fallbackImageId={fallbackImageId}
            alt={enriched.imageAlt || enriched.headline}
            fallbackLabel={fallbackLabel}
            fallbackSub={article.source}
            fallbackTitle={article.headline}
            fallbackKind={article.articleType}
            priority={priorityImage}
            sizes={imageSizes}
            className="rounded-image object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      </Link>

      <div
        className={`flex flex-1 flex-col ${
          isHero ? "gap-5 p-6 sm:p-7" : isCompact ? "gap-3 p-4 sm:p-5" : "gap-4 p-5 sm:p-6"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ArticleTypeBadge type={article.articleType} />
            {article.ticker !== "—" && (
              <Link
                href={`/topic/${toTopicSlug(article.ticker)}`}
                className="rounded-full bg-fin-brand-soft px-2.5 py-0.5 font-mono text-xs font-semibold text-fin-brand hover:underline"
              >
                {article.ticker}
              </Link>
            )}
          </div>
          <time
            className="text-xs font-medium text-fin-subtle"
            dateTime={article.publishedAt}
            title={formatDateTime(article.publishedAt)}
          >
            {formatPublishedTimeLabel(article.publishedAt)}
          </time>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-fin-subtle">
            {article.source}
            {article.author ? ` · ${article.author}` : ""}
          </p>
          <Link href={`/brief/${article.id}`} onClick={stashArticle}>
            <h3
              className={`mt-2 font-bold leading-snug text-fin-navy transition-colors group-hover:text-fin-brand line-clamp-2 ${
                isHero ? "text-xl sm:text-2xl" : "text-lg"
              }`}
            >
              {article.headline}
            </h3>
          </Link>
          <p className="mt-2 text-sm leading-relaxed text-fin-subtle line-clamp-2">
            {article.excerpt}
          </p>
        </div>

        <p className="flex-1 text-sm leading-relaxed text-fin-text line-clamp-3">
          {article.summary}
        </p>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-fin-subtle">
            <TooltipLabel label="Sentiment" content={ANALYSIS_LABEL_TOOLTIPS.sentiment} />
            <TooltipLabel label="Market impact" content={ANALYSIS_LABEL_TOOLTIPS.marketImpact} />
          </div>
          <div className="flex flex-wrap gap-2">
            <SentimentBadge sentiment={article.sentiment} />
            <MarketImpactBadge impact={article.marketImpact} />
          </div>
          <ConfidenceScore score={article.sentimentConfidence} />
          <AssetTags assets={article.keyAffectedAssets} max={isHero ? 6 : 4} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Link href={`/brief/${article.id}`} onClick={stashArticle} className="fin-link text-sm font-semibold">
            Read FinBrief summary →
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={article.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="fin-link text-xs font-semibold"
            >
              Read source ↗
            </a>
            <FollowToggleButton item={watchlistItem} />
          </div>
        </div>
      </div>
    </article>
  );
}

export const BriefCard = ArticleCard;
