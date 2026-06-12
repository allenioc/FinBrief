import { PageHeader } from "@/components/PageHeader";
import { Disclaimer } from "@/components/Disclaimer";
import { PublisherNote } from "@/components/PublisherNote";
import { WatchlistClient } from "@/components/WatchlistClient";

export default function WatchlistPage() {
  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Topics"
        title="Watchlist"
        description="Save stocks, ETFs, and macro topics you follow. Open any item to see stories from the daily edition filtered to that topic."
      />

      <WatchlistClient />

      <div className="mt-10 space-y-4">
        <PublisherNote />
        <Disclaimer />
      </div>
    </div>
  );
}
