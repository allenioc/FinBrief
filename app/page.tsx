import { Suspense } from "react";
import Link from "next/link";
import { DashboardFeed } from "@/components/DashboardFeed";
import { PageHeader } from "@/components/PageHeader";
import { RecommendedTopics } from "@/components/RecommendedTopics";
import { PublisherNote } from "@/components/PublisherNote";
import { Disclaimer } from "@/components/Disclaimer";
import { UpdateScheduleFooter } from "@/components/UpdateScheduleFooter";
import { SearchBar } from "@/components/SearchBar";
import { WatchlistHighlights } from "@/components/WatchlistHighlights";
import { getBriefs } from "@/lib/briefs";
import { TRENDING_SEARCHES } from "@/lib/mock-data";
import { BRAND } from "@/lib/theme";

interface HomeProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function HomePage({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const initialBriefs = await getBriefs(query);

  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow={BRAND.tagline}
        title="Understand markets with clarity"
        description="Search any stock, ETF, index, or macro topic. FinBrief delivers structured, educational summaries with sentiment, impact, and source context."
      >
        <Suspense fallback={<div className="h-28 animate-pulse rounded-panel bg-fin-muted" />}>
          <SearchBar trending={TRENDING_SEARCHES} />
        </Suspense>
      </PageHeader>

      <section className="mb-10">
        <Link
          href="/market-brief"
          className="fin-panel fin-card-hover flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="fin-label text-fin-brand">Today&apos;s Market Brief</p>
            <p className="mt-2 text-lg font-semibold text-fin-navy">
              Morning overview · mood, macro events & index snapshot
            </p>
          </div>
          <span className="fin-btn-primary shrink-0">Open brief →</span>
        </Link>
      </section>

      <RecommendedTopics />

      <section className="mb-12">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="fin-section-title">Quick Brief</h2>
          <Link href="/market-brief" className="fin-link text-sm">
            Full market brief →
          </Link>
        </div>
        <DashboardFeed initialBriefs={initialBriefs} query={query} />
      </section>

      <section className="mb-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="fin-section-title">Watchlist highlights</h2>
          <Link href="/watchlist" className="fin-link text-sm">
            Manage watchlist →
          </Link>
        </div>
        <WatchlistHighlights />
      </section>

      <div className="space-y-4">
        <PublisherNote />
        <Disclaimer />
      </div>

      <UpdateScheduleFooter />
    </div>
  );
}
