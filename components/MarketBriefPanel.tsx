import Link from "next/link";
import type { MarketBriefData } from "@/lib/types";
import { changeColorClass } from "@/lib/format";

function directionClass(direction: string): string {
  if (direction === "Up") return "text-status-positive";
  if (direction === "Down") return "text-status-negative";
  return "text-fin-subtle";
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
      <section className="fin-panel">
        <p className="fin-label">Daily Market Risk Brief · {data.date}</p>
        {updatedLabel && <p className="mt-1 text-sm text-fin-subtle">{updatedLabel}</p>}
        {snapshotLabel && <p className="mt-1 text-xs text-fin-subtle">{snapshotLabel}</p>}
        <h2 className="fin-section-title mt-5">{data.sessionHeadline}</h2>
        <p className="mt-4 max-w-3xl fin-body text-sm leading-relaxed">{data.sessionRecap}</p>
      </section>

      {assets.length > 0 && (
        <section className="fin-panel">
          <h2 className="fin-section-title mb-2">What moved</h2>
          <p className="mb-5 text-sm text-fin-subtle">
            Live benchmark snapshot with direction and change. Drivers tie to today&apos;s saved
            headline tags.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-2xl border border-fin-border bg-fin-muted/30 p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-fin-navy">{asset.name}</h3>
                    <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-fin-navy">
                      {asset.currentLevel}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${directionClass(asset.direction)}`}>
                    {asset.direction === "Flat" ? "Flat / little changed" : asset.direction}
                  </span>
                </div>
                <p className={`mt-2 font-mono text-sm tabular-nums ${changeColorClass(
                  asset.direction === "Down" ? -1 : asset.direction === "Up" ? 1 : 0
                )}`}>
                  {asset.changeAmount} ({asset.changeLabel})
                </p>
                {asset.mainDrivers.length > 0 && (
                  <p className="mt-3 text-xs text-fin-subtle">
                    Drivers: {asset.mainDrivers.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="fin-panel border-l-4 border-l-fin-brand">
        <h2 className="fin-section-title">Interview takeaway</h2>
        <p className="mt-2 text-sm text-fin-subtle">
          What happened, why it happened, and what a market risk team would monitor.
        </p>
        <p className="mt-4 fin-body text-sm leading-relaxed">{data.interviewTakeaway}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {data.keyDrivers.length > 0 && (
          <section className="fin-panel">
            <h2 className="fin-section-title mb-4">Why it moved — headline drivers</h2>
            <ul className="space-y-3">
              {data.keyDrivers.map((event) => (
                <li
                  key={event}
                  className="flex gap-3 text-sm text-fin-text before:mt-2 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-fin-brand"
                >
                  {event}
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
                <li key={exposure.category} className="border-b border-fin-border pb-4 last:border-0 last:pb-0">
                  <p className="font-semibold text-fin-navy">{exposure.category}</p>
                  <p className="mt-1 text-sm text-fin-subtle">{exposure.explanation}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
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
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export const MarketBriefView = MarketBriefPanel;
