import Link from "next/link";
import type { Brief } from "@/lib/types";
import { ANALYSIS_LABEL_TOOLTIPS } from "@/lib/analysis-tooltips";
import { parseThirtySecondBullets } from "@/lib/article-analysis";
import { formatDateTime } from "@/lib/format";
import { toTopicSlug } from "@/lib/slug";
import { watchlistItemFromBrief } from "@/lib/watchlist-utils";
import { enrichBriefImage } from "@/lib/article-image";
import { enrichArticleCopy } from "@/lib/article-analysis";
import { ArticleThumbnail } from "./ArticleThumbnail";
import { ArticleTypeBadge } from "./ArticleTypeBadge";
import { AssetTags } from "./AssetTags";
import { ConfidenceScore } from "./ConfidenceScore";
import { DataSnapshotPanel } from "./DataSnapshot";
import { FollowToggleButton } from "./FollowToggleButton";
import { MarketImpactBadge } from "./MarketImpactBadge";
import { RecommendedNext } from "./RecommendedNext";
import { SentimentBadge } from "./SentimentBadge";
import { TooltipLabel } from "./Tooltip";

function Section({
  title,
  children,
  variant = "default",
}: {
  title: string;
  children: React.ReactNode;
  variant?: "default" | "bull" | "bear" | "neutral" | "highlight";
}) {
  const border =
    variant === "bull"
      ? "border-l-status-positive"
      : variant === "bear"
        ? "border-l-status-negative"
        : variant === "neutral"
          ? "border-l-status-neutral"
          : variant === "highlight"
            ? "border-l-fin-brand"
            : "border-l-fin-border-strong";

  return (
    <section className={`fin-panel border-l-4 ${border}`}>
      <h2 className="mb-3 text-lg font-bold text-fin-navy">{title}</h2>
      <div className="fin-body text-sm">{children}</div>
    </section>
  );
}

export function ArticleDetail({ article }: { article: Brief }) {
  const enriched = enrichArticleCopy(enrichBriefImage(article));
  const fallbackLabel = enriched.ticker !== "—" ? enriched.ticker : enriched.topic;
  const fallbackImageId = enriched.fallbackImageId;
  const imageDisplay = enriched.imageDisplay;
  const watchlistItem = watchlistItemFromBrief(article);
  const quickBullets = parseThirtySecondBullets(enriched.thirtySecondVersion);

  return (
    <div className="space-y-8">
      <article className="fin-card overflow-hidden">
        <div className="relative aspect-[2/1] w-full min-h-[220px] sm:min-h-[320px]">
          <div className="absolute inset-4 h-full w-full overflow-hidden rounded-image sm:inset-6">
            <ArticleThumbnail
              articleId={enriched.id}
              src={enriched.imageUrl}
              imageDisplay={imageDisplay}
              fallbackImageId={fallbackImageId}
              alt={enriched.imageAlt || enriched.headline}
              fallbackLabel={fallbackLabel}
              fallbackSub={`${article.source} · ${article.topic}`}
              fallbackKind={article.articleType}
              priority
              sizes="100vw"
              className="rounded-image object-cover"
            />
          </div>
        </div>

        <div className="border-t border-fin-border px-6 py-8 sm:px-10">
          <div className="mx-auto max-w-article">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <ArticleTypeBadge type={article.articleType} />
              {article.ticker !== "—" && (
                <Link
                  href={`/topic/${toTopicSlug(article.ticker)}`}
                  className="rounded-full bg-fin-brand-soft px-3 py-0.5 font-mono text-sm font-bold text-fin-brand hover:underline"
                >
                  {article.ticker}
                </Link>
              )}
              <Link
                href={`/topic/${toTopicSlug(article.topic)}`}
                className="text-sm font-medium text-fin-subtle hover:text-fin-brand"
              >
                {article.topic}
              </Link>
            </div>

            <h1 className="text-3xl font-bold leading-tight tracking-tight text-fin-navy sm:text-4xl text-balance">
              {article.headline}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fin-subtle">
              <span className="font-semibold text-fin-navy">{article.source}</span>
              {article.author && <span>· {article.author}</span>}
              <time dateTime={article.publishedAt}>
                · {formatDateTime(article.publishedAt)}
              </time>
            </div>

            <div className="mt-5">
              <p className="fin-label mb-2">Related assets</p>
              <AssetTags assets={article.keyAffectedAssets} max={8} />
            </div>

            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-fin-subtle">
                <TooltipLabel label="Sentiment" content={ANALYSIS_LABEL_TOOLTIPS.sentiment} />
                <TooltipLabel label="Market impact" content={ANALYSIS_LABEL_TOOLTIPS.marketImpact} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <SentimentBadge sentiment={article.sentiment} />
                <MarketImpactBadge impact={article.marketImpact} />
                <ConfidenceScore score={article.sentimentConfidence} />
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href={article.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="fin-btn-primary"
              >
                Read full article at source ↗
              </a>
              <FollowToggleButton item={watchlistItem} className="fin-btn-secondary" />
            </div>
          </div>
        </div>
      </article>

      <blockquote className="fin-panel mx-auto max-w-article border-l-4 border-l-fin-brand italic text-fin-subtle">
        <p className="text-base leading-relaxed">&ldquo;{enriched.excerpt}&rdquo;</p>
        <footer className="mt-2 text-xs not-italic text-fin-subtle">
          Short excerpt from {article.source} — not the full article
        </footer>
      </blockquote>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6 fin-prose mx-auto max-w-full xl:max-w-none">
          <Section title="FinBrief summary" variant="highlight">
            <p className="whitespace-pre-line">{enriched.summary}</p>
            <div className="mt-5 rounded-2xl bg-fin-brand-soft/50 p-5 not-italic">
              <p className="fin-label text-fin-brand">The 30-second version</p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-base font-medium text-fin-navy">
                {quickBullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            </div>
          </Section>

          <Section title="Why it matters">{enriched.whyItMatters}</Section>
          <Section title="Who is affected?">{article.whoIsAffected}</Section>

          <div className="space-y-4">
            <h2 className="fin-section-title">Analysis</h2>
            <Section title="Bullish interpretation" variant="bull">
              {article.bullCase}
            </Section>
            <Section title="Bearish interpretation" variant="bear">
              {article.bearCase}
            </Section>
            <Section title="Neutral / uncertain view" variant="neutral">
              {article.neutralView}
            </Section>
            <Section title="Key risks">
              <ul className="list-inside list-disc space-y-2">
                {article.risks.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Section>
            <Section title="Things to watch next">
              <ul className="list-inside list-disc space-y-2">
                {article.thingsToWatch.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </Section>
          </div>

          <section className="fin-panel">
            <h2 className="fin-section-title mb-5">Key terms explained</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              {article.keyTerms.map((item) => (
                <div
                  key={item.term}
                  className="rounded-2xl border border-fin-border bg-fin-muted/40 p-4"
                >
                  <dt className="font-mono text-sm font-bold text-fin-navy">{item.term}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-fin-subtle">
                    {item.definition}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <RecommendedNext items={article.recommendedNext} />

          <section className="fin-panel">
            <h2 className="fin-section-title mb-4">Sources & citation</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="fin-label">Original publisher</dt>
                <dd className="mt-1 font-medium text-fin-navy">{article.source}</dd>
              </div>
              <div>
                <dt className="fin-label">Published</dt>
                <dd className="mt-1 text-fin-text">{formatDateTime(article.publishedAt)}</dd>
              </div>
              <div>
                <dt className="fin-label">Original article</dt>
                <dd className="mt-1">
                  <a
                    href={article.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fin-btn-primary mt-2 inline-flex text-sm"
                  >
                    Read full article at source ↗
                  </a>
                  <p className="mt-3 break-all text-xs text-fin-subtle">{article.originalUrl}</p>
                </dd>
              </div>
            </dl>
            {article.sourceLinks.length > 1 && (
              <ul className="mt-4 space-y-2 border-t border-fin-border pt-4">
                <li className="fin-label">Related sources</li>
                {article.sourceLinks.map((link) => (
                  <li key={link.url}>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="fin-link text-sm">
                      {link.name} ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="xl:sticky xl:top-28 xl:self-start">
          <DataSnapshotPanel snapshot={article.dataSnapshot} />
        </div>
      </div>
    </div>
  );
}
