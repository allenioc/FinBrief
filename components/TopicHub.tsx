import Link from "next/link";
import type { Brief, TopicProfile } from "@/lib/types";
import { watchlistItemFromTopic } from "@/lib/watchlist-utils";
import { ArticleCard } from "./ArticleCard";
import { DataSnapshotPanel } from "./DataSnapshot";
import { FollowToggleButton } from "./FollowToggleButton";
import { MarketImpactBadge } from "./MarketImpactBadge";
import { RecommendedNext } from "./RecommendedNext";
import { SentimentBadge } from "./SentimentBadge";

const typeLabels: Record<TopicProfile["type"], string> = {
  stock: "Stock",
  etf: "ETF",
  index: "Index",
  sector: "Sector",
  topic: "Macro topic",
};

export function TopicHub({
  profile,
  stories,
}: {
  profile: TopicProfile;
  stories: Brief[];
}) {
  const watchlistItem = watchlistItemFromTopic(profile);

  return (
    <div className="space-y-8">
      <header className="fin-panel">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-fin-border bg-fin-muted px-3 py-0.5 text-xs font-semibold text-fin-subtle">
            {typeLabels[profile.type]}
          </span>
          <SentimentBadge sentiment={profile.latestSentiment} />
          <MarketImpactBadge impact={profile.marketImpact} />
        </div>
        <h1 className="mt-4 font-mono text-4xl font-bold text-fin-navy">{profile.symbol}</h1>
        <p className="mt-1 text-xl text-fin-subtle">{profile.name}</p>
        <p className="mt-4 max-w-2xl fin-body">{profile.description}</p>
        <p className="mt-3 text-sm text-fin-subtle">
          {stories.length} related {stories.length === 1 ? "briefing" : "briefings"}
        </p>
        <div className="mt-4">
          <FollowToggleButton item={watchlistItem} />
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <section>
            <h2 className="fin-section-title mb-5">Latest briefings</h2>
            {stories.length === 0 ? (
              <p className="fin-panel py-12 text-center text-sm text-fin-subtle">
                No stories yet. Try the{" "}
                <Link href="/" className="fin-link">
                  dashboard
                </Link>
                .
              </p>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                {stories.map((story, i) => (
                  <ArticleCard
                    key={story.id}
                    article={story}
                    variant={i === 0 ? "hero" : "standard"}
                  />
                ))}
              </div>
            )}
          </section>
          <RecommendedNext items={profile.recommendedNext} title="Explore related" />
        </div>
        {profile.dataSnapshot && (
          <div className="lg:sticky lg:top-28 lg:self-start">
            <DataSnapshotPanel snapshot={profile.dataSnapshot} />
          </div>
        )}
      </div>
    </div>
  );
}
