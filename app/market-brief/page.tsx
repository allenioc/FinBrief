import { PageHeader } from "@/components/PageHeader";
import { MarketBriefClient } from "@/components/MarketBriefClient";
import { getBriefs } from "@/lib/briefs";
import { buildMarketBriefFromBriefs } from "@/lib/market-brief-live";
import { getMarketSnapshot } from "@/lib/market-snapshot";
import { DAILY_BRIEF_TITLE } from "@/lib/market-brief-narrative";

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
        title={DAILY_BRIEF_TITLE}
      />

      <MarketBriefClient initialData={initialData} initialSnapshot={snapshot} />
    </div>
  );
}
