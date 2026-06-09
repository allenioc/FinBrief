import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { MarketBriefClient } from "@/components/MarketBriefClient";
import { UpdateScheduleFooter } from "@/components/UpdateScheduleFooter";
import { getBriefs } from "@/lib/briefs";
import { MARKET_BRIEF } from "@/lib/market-brief-data";
import { buildMarketBriefFromBriefs } from "@/lib/market-brief-live";

export default async function MarketBriefPage() {
  const liveBriefs = await getBriefs("");
  const initialData = liveBriefs.length > 0 ? buildMarketBriefFromBriefs(liveBriefs) : MARKET_BRIEF;

  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Daily Market Brief"
        title="Your morning market snapshot"
        description="Top stories, overall mood, macro events, and index performance from today's edition. Daily market brief updates once per day."
      />

      <MarketBriefClient initialData={initialData} />

      <div className="mt-10">
        <Disclaimer />
      </div>

      <UpdateScheduleFooter />
    </div>
  );
}
