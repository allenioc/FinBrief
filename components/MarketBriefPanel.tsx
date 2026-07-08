import Link from "next/link";
import type { MarketBriefData } from "@/lib/types";
import { ANALYSIS_LABEL_TOOLTIPS } from "@/lib/analysis-tooltips";
import { changeColorClass, formatPercent } from "@/lib/format";
import { SentimentBadge } from "./SentimentBadge";
import { TooltipLabel } from "./Tooltip";

/** Daily market risk briefing panel */
export function MarketBriefPanel({
  data,
  updatedLabel,
}: {
  data: MarketBriefData;
  updatedLabel?: string;
}) {
  return (
    <div className="space-y-8">
      <section className="fin-panel">
        <p className="fin-label">Daily Market Risk Brief · {data.date}</p>
        {updatedLabel && (
          <p className="mt-1 text-sm text-fin-subtle">{updatedLabel}</p>
        )}
        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="fin-section-title">{data.overallMoodLabel}</h2>
            <p className="mt-3 max-w-2xl fin-body">{data.overallMoodSummary}</p>
            <p className="mt-3 max-w-2xl text-sm text-fin-subtle">
              What moved, why it moved, and which exposures matter — from saved daily stories only.
            </p>
          </div>
          <div className="space-y-2">
            <TooltipLabel label="Sentiment" content={ANALYSIS_LABEL_TOOLTIPS.sentiment} />
            <SentimentBadge sentiment={data.overallMood} />
          </div>
        </div>
      </section>

      <section className="fin-panel border-l-4 border-l-fin-brand">
        <h2 className="fin-section-title">Interview takeaway</h2>
        <p className="mt-2 text-sm text-fin-subtle">
          What happened in markets today, why did it happen, and what would a market risk team
          monitor?
        </p>
        <p className="mt-4 fin-body text-sm leading-relaxed">{data.interviewTakeaway}</p>
      </section>

      {data.tradingSessionRecap.length > 0 && (
        <section className="fin-panel">
          <h2 className="fin-section-title mb-2">What moved</h2>
          <p className="mb-5 text-sm text-fin-subtle">
            Session recap by asset class from saved risk-driver stories — levels shown only when
            available.
          </p>
          <div className="space-y-4">
            {data.tradingSessionRecap.map((row) => (
              <div
                key={row.assetClass}
                className="rounded-2xl border border-fin-border bg-fin-muted/30 p-5"
              >
                <h3 className="text-base font-bold text-fin-navy">{row.assetClass}</h3>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="fin-label">Current level</dt>
                    <dd className="mt-1 text-fin-text">{row.currentLevel ?? "Level unavailable"}</dd>
                  </div>
                  <div>
                    <dt className="fin-label">What moved</dt>
                    <dd className="mt-1 text-fin-text">{row.whatMoved}</dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="fin-label">Main drivers</dt>
                    <dd className="mt-1 text-fin-text">
                      {row.mainDrivers.length > 0 ? row.mainDrivers.join(", ") : "—"}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="fin-panel">
          <h2 className="fin-section-title mb-4">Why it moved — session drivers</h2>
          <ul className="space-y-3">
            {data.keyMacroEvents.map((event) => (
              <li
                key={event}
                className="flex gap-3 text-sm text-fin-text before:mt-2 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-fin-brand"
              >
                {event}
              </li>
            ))}
          </ul>
        </section>
        <section className="fin-panel">
          <h2 className="fin-section-title mb-4">Exposures to monitor</h2>
          <ul className="space-y-4">
            {data.sectorsToWatch.map((sector) => (
              <li key={sector.name} className="border-b border-fin-border pb-4 last:border-0 last:pb-0">
                <p className="font-semibold text-fin-navy">{sector.name}</p>
                <p className="mt-1 text-sm text-fin-subtle">{sector.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="fin-panel">
        <h2 className="fin-section-title mb-5">Today&apos;s top risk-driver stories</h2>
        <ol className="space-y-3">
          {data.topStories.map((story, i) => (
            <li
              key={story.id}
              className="flex gap-4 rounded-2xl border border-fin-border bg-fin-muted/40 p-4 transition-colors hover:border-fin-brand/40 hover:bg-fin-brand-soft/30"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fin-brand text-sm font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/brief/${story.id}`} className="font-semibold text-fin-navy hover:text-fin-brand">
                  {story.title}
                </Link>
                <p className="mt-1 text-xs text-fin-subtle">{story.source}</p>
              </div>
              <SentimentBadge sentiment={story.sentiment} />
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-panel border border-status-positive/20 bg-status-positive-bg/40 p-6">
          <h3 className="text-sm font-bold text-status-positive">Strongest risk-on driver</h3>
          <p className="mt-2 text-lg font-semibold text-fin-navy">{data.topPositiveTheme.title}</p>
          <p className="mt-2 fin-body text-sm">{data.topPositiveTheme.description}</p>
        </section>
        <section className="rounded-panel border border-status-negative/20 bg-status-negative-bg/40 p-6">
          <h3 className="text-sm font-bold text-status-negative">Strongest risk-off driver</h3>
          <p className="mt-2 text-lg font-semibold text-fin-navy">{data.topNegativeTheme.title}</p>
          <p className="mt-2 fin-body text-sm">{data.topNegativeTheme.description}</p>
        </section>
      </div>

      <section className="fin-panel">
        <h2 className="fin-section-title mb-2">Cross-asset sentiment read</h2>
        <p className="mb-5 text-sm text-fin-subtle">
          Narrative sentiment from saved stories — not live index quotes.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {data.indexMoods.map((index) => (
            <div
              key={index.symbol}
              className="rounded-2xl border border-fin-border bg-fin-muted/30 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-sm font-bold text-fin-navy">{index.symbol}</p>
                  <p className="text-xs text-fin-subtle">{index.name}</p>
                </div>
                <span
                  className={`font-mono text-sm font-bold tabular-nums ${changeColorClass(index.dailyChangePercent)}`}
                >
                  {formatPercent(index.dailyChangePercent)}
                </span>
              </div>
              <div className="mt-3">
                <SentimentBadge sentiment={index.sentiment} />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-fin-subtle">{index.note}</p>
              <Link href={`/topic/${index.symbol.toLowerCase()}`} className="fin-link mt-3 inline-block text-xs">
                View briefings →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="fin-panel bg-fin-brand-soft/20">
        <h2 className="fin-section-title">Podcast-style recap</h2>
        <p className="mt-4 fin-body text-sm leading-relaxed italic text-fin-text">{data.podcastRecap}</p>
      </section>
    </div>
  );
}

export const MarketBriefView = MarketBriefPanel;
