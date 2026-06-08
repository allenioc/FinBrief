import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { PublisherNote } from "@/components/PublisherNote";
import { UpdateScheduleFooter } from "@/components/UpdateScheduleFooter";
import { WatchlistClient } from "@/components/WatchlistClient";

export default function WatchlistPage() {
  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Topics"
        title="Watchlist"
        description="Save stocks and macro topics, then open each one to view a live filtered feed from /api/news."
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
