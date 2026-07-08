import { PageHeader } from "@/components/PageHeader";
import { MarketBriefClient } from "@/components/MarketBriefClient";
import { getBriefs } from "@/lib/briefs";
import { buildMarketBriefFromBriefs } from "@/lib/market-brief-live";
import { getMarketSnapshot } from "@/lib/market-snapshot";

export default async function MarketBriefPage() {
  const [liveBriefs, snapshot] = await Promise.all([
    getBriefs(""),
    getMarketSnapshot().catch(() => null),
  ]);
  const initialData = buildMarketBriefFromBriefs(liveBriefs, snapshot);

  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Daily Market Risk Brief"
        title="Live market snapshot and risk-driver recap"
        description="Current levels and direction across major benchmarks, linked to today's saved headline drivers."
      />

      <MarketBriefClient initialData={initialData} initialSnapshot={snapshot} />
    </div>
  );
}
