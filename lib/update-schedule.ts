/**
 * Documented update cadence for FinBrief feeds.
 * Replace mock refresh hooks with real API polling when backends are connected.
 */

export type FeedKind = "article" | "market-brief" | "watchlist" | "deep-dive";

export const FEED_STATUS = {
  label: "Demo feed",
  shortLabel: "Live mock feed",
  description: "Simulated updates for demonstration. Not connected to live market data.",
} as const;

export interface UpdateScheduleItem {
  feed: FeedKind;
  title: string;
  cadence: string;
  productionNote: string;
}

export const UPDATE_SCHEDULE: UpdateScheduleItem[] = [
  {
    feed: "market-brief",
    title: "Market Brief",
    cadence: "Once every morning (before U.S. market open).",
    productionNote: "Will be generated from overnight macro and futures data.",
  },
  {
    feed: "watchlist",
    title: "Watchlist brief",
    cadence: "Throughout U.S. market hours (mock: on demand via refresh).",
    productionNote: "Will poll per-symbol news for saved watchlist items.",
  },
  {
    feed: "article",
    title: "Article feed",
    cadence: "Every 15–30 minutes during market hours (mock: manual refresh).",
    productionNote: "Will map to a news ingestion API with deduplication.",
  },
  {
    feed: "deep-dive",
    title: "Deep Dive summary",
    cadence: "Generated when you open a story.",
    productionNote: "Will call an explanation service with source metadata only.",
  },
];

export const MOCK_DATA_NOTICE =
  "This build uses mock articles and simulated refresh. Real publishers remain the source of full stories.";
