import { Suspense } from "react";
import Link from "next/link";
import { DashboardTabs } from "@/components/DashboardTabs";
import { PageHeader } from "@/components/PageHeader";
import { RecommendedTopics } from "@/components/RecommendedTopics";
import { NewsletterWaitlist } from "@/components/NewsletterWaitlist";
import { SearchBar } from "@/components/SearchBar";
import { WatchlistHighlights } from "@/components/WatchlistHighlights";
import { BRAND } from "@/lib/theme";

interface HomeProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function HomePage({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const isTopicView = query.length > 0;
  const title = isTopicView ? `${query} risk drivers` : "Understand what moved, why it moved, and what risks matter";
  const description = isTopicView
    ? `Saved stories and risk drivers for ${query} from this week's archive.`
    : "Daily market risk briefings from saved finance headlines — educational context, not investment advice.";

  return (
    <div className="mx-auto max-w-shell px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow={BRAND.tagline}
        title={title}
        description={description}
      >
        <Suspense fallback={<div className="h-28 animate-pulse rounded-panel bg-fin-muted" />}>
          <SearchBar />
        </Suspense>
      </PageHeader>

      <section className="mb-10">
        <Link
          href="/market-brief"
          className="fin-panel fin-card-hover flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="fin-label text-fin-brand">Daily market risk brief</p>
            <p className="mt-2 text-lg font-semibold text-fin-navy">
              Session recap · risk drivers · asset-class lens
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
            Full daily risk brief →
          </Link>
        </div>
        <Suspense fallback={<div className="fin-panel h-48 animate-pulse rounded-panel bg-fin-muted" />}>
          <DashboardTabs query={query} />
        </Suspense>
      </section>

      <section className="mb-12">
        <NewsletterWaitlist />
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
    </div>
  );
}
