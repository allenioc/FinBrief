import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { MarketBriefClient } from "@/components/MarketBriefClient";
import { UpdateScheduleFooter } from "@/components/UpdateScheduleFooter";
import { MARKET_BRIEF } from "@/lib/market-brief-data";

export default function MarketBriefPage() {
  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Daily Market Brief"
        title="Your morning market snapshot"
        description="Top stories, overall mood, macro events, and index performance — mock data with simulated refresh for educational context."
      />

      <MarketBriefClient initialData={MARKET_BRIEF} />

      <div className="mt-10">
        <Disclaimer />
      </div>

      <UpdateScheduleFooter />
    </div>
  );
}
