export type Sentiment = "positive" | "neutral" | "negative" | "mixed";
export type MarketImpact = "low" | "medium" | "high";

export type RiskDriverTag =
  | "Rates"
  | "Inflation"
  | "Central Banks"
  | "Equities"
  | "Credit"
  | "FX"
  | "Commodities"
  | "Volatility"
  | "Banking"
  | "Geopolitical Risk"
  | "Earnings"
  | "Real Estate"
  | "AI / Technology";

export type ImpactAssessment =
  | "positive"
  | "negative"
  | "mixed"
  | "higher"
  | "lower"
  | "uncertain";

export interface PotentialMarketImpact {
  equities?: ImpactAssessment;
  ratesBonds?: ImpactAssessment;
  fx?: ImpactAssessment;
  commodities?: ImpactAssessment;
  volatility?: ImpactAssessment;
  creditBanking?: ImpactAssessment;
}

export interface TradingSessionRecapRow {
  assetClass: string;
  currentLevel: string | null;
  whatMoved: string;
  mainDrivers: string[];
}

export type ArticleType =
  | "company news"
  | "market news"
  | "macro news"
  | "ETF/index news"
  | "sector news";

export interface KeyTerm {
  term: string;
  definition: string;
}

export interface RelatedAsset {
  symbol: string;
  name: string;
  type: "stock" | "etf" | "index" | "sector" | "macro";
}

export interface SourceLink {
  name: string;
  url: string;
}

export interface RecommendedItem {
  label: string;
  href: string;
  kind: "ticker" | "etf" | "sector" | "topic" | "story";
}

export interface StockSnapshot {
  kind: "stock";
  price: string;
  dailyChange: string;
  dailyChangePercent: number;
  marketCap: string;
  peRatio: string;
  volume: string;
  sector: string;
  earningsDate: string;
}

export interface ETFSnapshot {
  kind: "etf";
  tracks: string;
  topHoldings: string[];
  expenseRatio: string;
  dailyChange: string;
  dailyChangePercent: number;
  relatedSectors: string[];
  macroFactors: string[];
}

export interface MacroSnapshot {
  kind: "macro";
  relatedIndicators: string[];
  affectedSectors: string[];
  affectedIndexes: string[];
  marketSensitivity: MarketImpact;
}

export type DataSnapshot = StockSnapshot | ETFSnapshot | MacroSnapshot;

export interface Brief {
  id: string;
  headline: string;
  source: string;
  author?: string;
  publishedAt: string;
  imageUrl: string;
  imageAlt: string;
  /** Stable FinBrief fallback palette id when provider image is unavailable. */
  fallbackImageId?: string;
  /** Whether the saved edition expects a provider image or FinBrief fallback visual. */
  imageDisplay?: "provider" | "fallback";
  originalUrl: string;
  excerpt: string;
  summary: string;
  thirtySecondVersion: string;
  whatHappened: string;
  whyItMatters: string;
  whoIsAffected: string;
  ticker: string;
  topic: string;
  sentiment: Sentiment;
  sentimentConfidence: number;
  marketImpact: MarketImpact;
  articleType: ArticleType;
  keyAffectedAssets: string[];
  relatedAssets: RelatedAsset[];
  keyTerms: KeyTerm[];
  bullCase: string;
  bearCase: string;
  neutralView: string;
  risks: string[];
  thingsToWatch: string[];
  dataSnapshot: DataSnapshot;
  recommendedNext: RecommendedItem[];
  sourceLinks: SourceLink[];
  /** Market-risk layer — derived at display time from saved story fields. */
  riskDrivers?: RiskDriverTag[];
  marketRiskLens?: string | null;
  potentialMarketImpact?: PotentialMarketImpact | null;
}

export type WatchlistItemType = "stock" | "etf" | "index" | "sector" | "topic";

export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  type: WatchlistItemType;
  addedAt: string;
  lastUpdated: string;
  latestSentiment: Sentiment;
  marketImpact: MarketImpact;
  relatedStoriesCount: number;
  topicSlug: string;
}

/** Watchlist row with per-symbol feed refresh metadata (mock / future API). */
export interface WatchlistFeedItem extends WatchlistItem {
  feedLastUpdatedAt: string;
  newStoriesCount: number;
}

export interface FeedMeta {
  lastUpdatedAt: string;
  refreshCount: number;
}

export interface TopicProfile {
  slug: string;
  symbol: string;
  name: string;
  type: WatchlistItemType;
  description: string;
  latestSentiment: Sentiment;
  marketImpact: MarketImpact;
  dataSnapshot?: DataSnapshot;
  recommendedNext: RecommendedItem[];
}

export interface BriefResponse {
  query: string;
  briefs: Brief[];
  provider?: string;
}

export interface IndexMood {
  symbol: string;
  name: string;
  dailyChangePercent: number;
  sentiment: Sentiment;
  note: string;
}

export interface MarketBriefData {
  date: string;
  topStories: { id: string; title: string; source: string; sentiment: Sentiment }[];
  overallMood: Sentiment;
  overallMoodLabel: string;
  overallMoodSummary: string;
  topPositiveTheme: { title: string; description: string };
  topNegativeTheme: { title: string; description: string };
  keyMacroEvents: string[];
  sectorsToWatch: { name: string; reason: string }[];
  indexMoods: IndexMood[];
  interviewTakeaway: string;
  tradingSessionRecap: TradingSessionRecapRow[];
  podcastRecap: string;
}
