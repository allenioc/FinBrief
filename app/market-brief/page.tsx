import { PageHeader } from "@/components/PageHeader";
import { MarketBriefClient } from "@/components/MarketBriefClient";
import { getBriefs } from "@/lib/briefs";
import { MARKET_BRIEF } from "@/lib/market-brief-data";
import { buildMarketBriefFromBriefs } from "@/lib/market-brief-live";

export default async function MarketBriefPage() {
  const liveBriefs = await getBriefs("");
  const initialData = liveBriefs.length > 0 ? buildMarketBriefFromBriefs(liveBriefs) : MARKET_BRIEF;

  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Daily market risk brief"
        title="Market risk recap for today's edition"
        description="Understand what moved, why it moved, and which risk drivers matter — built from saved daily stories only."
      />

      <MarketBriefClient initialData={initialData} />
    </div>
  );
}
