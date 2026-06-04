import type { DataSnapshot as Snapshot } from "@/lib/types";
import { changeColorClass, formatPercent } from "@/lib/format";
import { MarketImpactBadge } from "./MarketImpactBadge";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-fin-border py-3 last:border-0">
      <dt className="text-sm text-fin-subtle">{label}</dt>
      <dd className="text-right text-sm font-semibold text-fin-navy">{value}</dd>
    </div>
  );
}

export function DataSnapshotPanel({ snapshot }: { snapshot: Snapshot }) {
  return (
    <aside className="fin-panel">
      <h2 className="fin-section-title mb-1">Data snapshot</h2>
      <p className="mb-4 text-xs text-fin-subtle">Mock market data for educational context.</p>
      <dl>
        {snapshot.kind === "stock" && (
          <>
            <Row label="Price" value={snapshot.price} />
            <Row
              label="Daily change"
              value={
                <span className={changeColorClass(snapshot.dailyChangePercent)}>
                  {snapshot.dailyChange} ({formatPercent(snapshot.dailyChangePercent)})
                </span>
              }
            />
            <Row label="Market cap" value={snapshot.marketCap} />
            <Row label="P/E ratio" value={snapshot.peRatio} />
            <Row label="Volume" value={snapshot.volume} />
            <Row label="Sector" value={snapshot.sector} />
            <Row label="Earnings" value={snapshot.earningsDate} />
          </>
        )}
        {snapshot.kind === "etf" && (
          <>
            <Row label="Tracks" value={snapshot.tracks} />
            <Row
              label="Daily change"
              value={
                <span className={changeColorClass(snapshot.dailyChangePercent)}>
                  {snapshot.dailyChange} ({formatPercent(snapshot.dailyChangePercent)})
                </span>
              }
            />
            <Row label="Expense ratio" value={snapshot.expenseRatio} />
            <Row
              label="Top holdings"
              value={
                <span className="max-w-[140px] font-mono text-xs leading-snug">
                  {snapshot.topHoldings.join(", ")}
                </span>
              }
            />
            <Row label="Related sectors" value={snapshot.relatedSectors.join(", ")} />
            <Row
              label="Macro factors"
              value={
                <ul className="list-inside list-disc text-right text-xs">
                  {snapshot.macroFactors.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              }
            />
          </>
        )}
        {snapshot.kind === "macro" && (
          <>
            <Row label="Related indicators" value={snapshot.relatedIndicators.join(", ")} />
            <Row label="Affected sectors" value={snapshot.affectedSectors.join(", ")} />
            <Row label="Affected indexes" value={snapshot.affectedIndexes.join(", ")} />
            <Row
              label="Market sensitivity"
              value={<MarketImpactBadge impact={snapshot.marketSensitivity} />}
            />
          </>
        )}
      </dl>
    </aside>
  );
}
