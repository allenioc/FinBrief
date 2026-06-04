import Link from "next/link";
import type { Brief } from "@/lib/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { toTopicSlug } from "@/lib/slug";
import { ArticleThumbnail } from "./ArticleThumbnail";
import { ArticleTypeBadge } from "./ArticleTypeBadge";
import { AssetTags } from "./AssetTags";
import { ConfidenceScore } from "./ConfidenceScore";
import { MarketImpactBadge } from "./MarketImpactBadge";
import { SentimentBadge } from "./SentimentBadge";

export function ArticleCard({
  article,
  variant = "standard",
}: {
  article: Brief;
  variant?: "hero" | "standard" | "compact";
}) {
  const fallbackLabel = article.ticker !== "—" ? article.ticker : article.topic;
  const isHero = variant === "hero";

  return (
    <article
      className={`group fin-card fin-card-hover flex flex-col overflow-hidden ${
        isHero ? "sm:col-span-2" : ""
      }`}
    >
      <Link
        href={`/brief/${article.id}`}
        className={`relative block overflow-hidden bg-fin-muted ${
          isHero ? "aspect-[16/10]" : "aspect-[16/10]"
        }`}
      >
        <div className="absolute inset-2 overflow-hidden rounded-image sm:inset-3">
          <ArticleThumbnail
            src={article.imageUrl}
            alt={article.imageAlt}
            fallbackLabel={fallbackLabel}
            fallbackSub={article.source}
            sizes={
              isHero
                ? "(max-width: 768px) 100vw, 66vw"
                : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            }
            className="rounded-image object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      </Link>

      <div className={`flex flex-1 flex-col ${isHero ? "gap-5 p-6 sm:p-7" : "gap-4 p-5 sm:p-6"}`}>
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
            {formatRelativeTime(article.publishedAt)}
          </time>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-fin-subtle">
            {article.source}
          </p>
          <Link href={`/brief/${article.id}`}>
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
          <div className="flex flex-wrap gap-2">
            <SentimentBadge sentiment={article.sentiment} />
            <MarketImpactBadge impact={article.marketImpact} />
          </div>
          <ConfidenceScore score={article.sentimentConfidence} />
          <AssetTags assets={article.keyAffectedAssets} max={isHero ? 6 : 4} />
        </div>

        <Link href={`/brief/${article.id}`} className="fin-link text-sm font-semibold">
          Read FinBrief summary →
        </Link>
      </div>
    </article>
  );
}

export const BriefCard = ArticleCard;
