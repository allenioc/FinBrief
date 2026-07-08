import Link from "next/link";
import type { MarketBriefData } from "@/lib/types";
import { changeColorClass } from "@/lib/format";
import { DAILY_BRIEF_TITLE } from "@/lib/market-brief-narrative";

function directionClass(direction: string): string {
  if (direction === "Up") return "text-status-positive";
  if (direction === "Down") return "text-status-negative";
  return "text-fin-subtle";
}

function directionLabel(direction: string): string {
  if (direction === "Flat") return "Flat / little changed";
  return direction;
}

/** Daily Market Risk Brief panel — live snapshot + saved headline drivers. */
export function MarketBriefPanel({
  data,
  updatedLabel,
  snapshotLabel,
}: {
  data: MarketBriefData;
  updatedLabel?: string;
  snapshotLabel?: string;
}) {
  const assets = data.marketAssets.filter((asset) => asset.available);

  return (
    <div className="space-y-8">
      <section className="fin-panel border-l-4 border-l-fin-brand">
        <p className="fin-label">Daily market brief · {data.date}</p>
        {updatedLabel && <p className="mt-1 text-sm text-fin-subtle">{updatedLabel}</p>}
        {snapshotLabel && <p className="mt-1 text-xs text-fin-subtle">{snapshotLabel}</p>}
        <h2 className="fin-section-title mt-5">{data.sessionHeadline || DAILY_BRIEF_TITLE}</h2>
        <p className="mt-4 max-w-3xl fin-body text-base leading-relaxed text-fin-text">
          {data.sessionRecap}
        </p>
      </section>

      {assets.length > 0 && (
        <section className="fin-panel">
          <h2 className="fin-section-title mb-5">What moved</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-2xl border border-fin-border bg-fin-muted/30 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-bold text-fin-navy">{asset.name}</h3>
                  <span className={`shrink-0 text-xs font-bold uppercase tracking-wide ${directionClass(asset.direction)}`}>
                    {directionLabel(asset.direction)}
                  </span>
                </div>
                <p className="mt-3 font-mono text-xl font-semibold tabular-nums text-fin-navy">
                  {asset.currentLevel}
                </p>
                <p
                  className={`mt-1 font-mono text-sm tabular-nums ${changeColorClass(
                    asset.direction === "Down" ? -1 : asset.direction === "Up" ? 1 : 0
                  )}`}
                >
                  {asset.changeAmount}
                  {asset.changeLabel ? ` (${asset.changeLabel})` : ""}
                </p>
                {asset.mainDrivers.length > 0 && (
                  <p className="mt-3 text-xs leading-relaxed text-fin-subtle">
                    Related drivers: {asset.mainDrivers.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {data.keyDrivers.length > 0 && (
          <section className="fin-panel">
            <h2 className="fin-section-title mb-4">Why it moved</h2>
            <ul className="space-y-3">
              {data.keyDrivers.map((item) => (
                <li
                  key={item}
                  className="text-sm leading-relaxed text-fin-text before:mr-3 before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-fin-brand before:align-middle"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.riskExposures.length > 0 && (
          <section className="fin-panel">
            <h2 className="fin-section-title mb-4">Exposures to monitor</h2>
            <ul className="space-y-4">
              {data.riskExposures.map((exposure) => (
                <li
                  key={exposure.category}
                  className="border-b border-fin-border pb-4 last:border-0 last:pb-0"
                >
                  <p className="font-semibold text-fin-navy">{exposure.category}</p>
                  <p className="mt-1 text-sm leading-relaxed text-fin-subtle">
                    {exposure.explanation}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <section className="fin-panel border-l-4 border-l-fin-brand/60">
        <h2 className="fin-section-title">Interview takeaway</h2>
        <p className="mt-4 fin-body text-sm leading-relaxed">{data.interviewTakeaway}</p>
      </section>

      {data.topStories.length > 0 && (
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
                  <Link
                    href={`/brief/${story.id}`}
                    className="font-semibold text-fin-navy hover:text-fin-brand"
                  >
                    {story.title}
                  </Link>
                  <p className="mt-1 text-xs text-fin-subtle">{story.source}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

export const MarketBriefView = MarketBriefPanel;
