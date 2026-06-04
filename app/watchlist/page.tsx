import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { PublisherNote } from "@/components/PublisherNote";
import { UpdateScheduleFooter } from "@/components/UpdateScheduleFooter";
import { WatchlistClient } from "@/components/WatchlistClient";

export default function WatchlistPage() {
  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Following"
        title="Watchlist"
        description="Track stocks, ETFs, indexes, sectors, and macro topics. Feed timestamps and new-story counts refresh on demand — mock data until live APIs are connected."
      />

      <WatchlistClient />

      <div className="mt-10 space-y-4">
        <PublisherNote />
        <Disclaimer />
      </div>

      <UpdateScheduleFooter />
    </div>
  );
}
