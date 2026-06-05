import { getBriefsForTopic } from "./briefs";
import { MOCK_WATCHLIST } from "./watchlist-data";
import type { TopicProfile } from "./types";
import { fromTopicSlug, toTopicSlug } from "./slug";

const TOPIC_OVERRIDES: Record<string, Partial<TopicProfile>> = {
  aapl: {
    description:
      "Apple Inc. — consumer technology leader watched for iPhone cycles, services growth, and ecosystem monetization.",
    recommendedNext: [
      { label: "QQQ", href: "/topic/qqq", kind: "etf" },
      { label: "MSFT", href: "/topic/msft", kind: "ticker" },
      { label: "Consumer tech", href: "/topic/ai-stocks", kind: "sector" },
      { label: "Earnings story", href: "/brief/aapl-earnings-q1", kind: "story" },
      { label: "China sales", href: "/topic/aapl", kind: "topic" },
    ],
  },
  spy: {
    description: "SPDR S&P 500 ETF — broad U.S. large-cap exposure and macro bellwether.",
    recommendedNext: [
      { label: "QQQ", href: "/topic/qqq", kind: "etf" },
      { label: "DIA", href: "/topic/dia", kind: "etf" },
      { label: "VTI", href: "/topic/vti", kind: "etf" },
      { label: "Interest Rates", href: "/topic/interest-rates", kind: "topic" },
      { label: "Inflation", href: "/topic/inflation", kind: "topic" },
    ],
  },
  msft: {
    description:
      "Microsoft — cloud, AI copilot, and enterprise software; key QQQ mega-cap.",
    recommendedNext: [
      { label: "QQQ", href: "/topic/qqq", kind: "etf" },
      { label: "AAPL", href: "/topic/aapl", kind: "ticker" },
      { label: "AI Stocks", href: "/topic/ai-stocks", kind: "sector" },
      { label: "AI capex", href: "/brief/qqq-ai-spending", kind: "story" },
    ],
  },
  nvda: {
    description:
      "NVIDIA — AI and data center GPU leader; closely tied to semiconductor and cloud capex cycles.",
    recommendedNext: [
      { label: "Semiconductors", href: "/topic/semiconductors", kind: "sector" },
      { label: "AI Stocks", href: "/topic/ai-stocks", kind: "sector" },
      { label: "QQQ", href: "/topic/qqq", kind: "etf" },
      { label: "AI capex story", href: "/brief/qqq-ai-spending", kind: "story" },
      { label: "Data centers", href: "/topic/qqq", kind: "topic" },
    ],
  },
};

export async function getTopicProfile(slug: string): Promise<TopicProfile | undefined> {
  const watch = MOCK_WATCHLIST.find((w) => w.topicSlug === slug);
  const symbol = watch?.symbol ?? fromTopicSlug(slug);
  const name = watch?.name ?? symbol;
  const type = watch?.type ?? "topic";
  const stories = await getBriefsForTopic(slug);
  const override = TOPIC_OVERRIDES[slug];

  if (!watch && stories.length === 0 && !override) {
    return undefined;
  }

  const primary = stories[0];

  return {
    slug,
    symbol,
    name,
    type,
    description:
      override?.description ??
      `Follow ${name} for curated FinBrief stories, sentiment context, and related market topics.`,
    latestSentiment: watch?.latestSentiment ?? primary?.sentiment ?? "neutral",
    marketImpact: watch?.marketImpact ?? primary?.marketImpact ?? "medium",
    dataSnapshot: primary?.dataSnapshot,
    recommendedNext:
      override?.recommendedNext ??
      primary?.recommendedNext ??
      stories.slice(1, 4).map((s) => ({
        label: s.headline.slice(0, 40) + "…",
        href: `/brief/${s.id}`,
        kind: "story" as const,
      })),
  };
}

export function getAllTopicSlugs(): string[] {
  const fromWatch = MOCK_WATCHLIST.map((w) => w.topicSlug);
  const fromTickers = ["aapl", "msft", "nvda", "tsla", "spy", "qqq", "vti", "dia"];
  return [...new Set([...fromWatch, ...fromTickers])];
}

export function watchlistTopicSlug(symbol: string): string {
  const item = MOCK_WATCHLIST.find(
    (w) => w.symbol.toLowerCase() === symbol.toLowerCase()
  );
  return item?.topicSlug ?? toTopicSlug(symbol);
}
