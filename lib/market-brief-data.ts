import type { MarketBriefData } from "./types";
import { MOCK_BRIEFS } from "./articles-data";
import { buildInterviewTakeaway, buildPodcastRecap, buildTradingSessionRecap } from "./market-risk";

const mockRecapBriefs = MOCK_BRIEFS.slice(0, 8);

export const MARKET_BRIEF: MarketBriefData = {
  date: "2026-06-04",
  topStories: [
    {
      id: "aapl-earnings-q1",
      title: "Apple services revenue beats expectations in quarterly report",
      source: "Reuters",
      sentiment: "positive",
    },
    {
      id: "spy-fed-commentary",
      title: "Fed officials signal patience on rate cuts amid mixed inflation data",
      source: "Wall Street Journal",
      sentiment: "neutral",
    },
    {
      id: "tsla-delivery-update",
      title: "Tesla quarterly deliveries miss high-end analyst estimates",
      source: "Bloomberg",
      sentiment: "negative",
    },
    {
      id: "qqq-ai-spending",
      title: "Hyperscalers lift AI infrastructure capex guidance",
      source: "Financial Times",
      sentiment: "positive",
    },
    {
      id: "inflation-cpi-print",
      title: "CPI print shows modest month-over-month cooling in headline inflation",
      source: "Bureau of Labor Statistics",
      sentiment: "positive",
    },
  ],
  overallMood: "neutral",
  overallMoodLabel: "Cautiously balanced",
  overallMoodSummary:
    "Equities are mixed as strong mega-cap tech fundamentals offset higher-for-longer rate expectations. Bond yields are steady, and volatility remains moderate ahead of upcoming economic data.",
  topPositiveTheme: {
    title: "AI infrastructure investment",
    description:
      "Cloud leaders are increasing data center and chip spending, supporting semiconductor and networking names while investors weigh near-term cash flow trade-offs.",
  },
  topNegativeTheme: {
    title: "Auto demand uncertainty",
    description:
      "EV delivery misses and pricing competition are raising questions about volume growth and margin stability across the auto and battery supply chain.",
  },
  keyMacroEvents: [
    "FOMC speaker circuit continues with focus on inflation persistence",
    "May CPI release drove front-end rate repricing",
    "Q2 earnings season begins for large-cap technology",
    "OPEC+ output guidance update expected later this week",
  ],
  sectorsToWatch: [
    { name: "Technology", reason: "AI capex guides and cloud earnings revisions" },
    { name: "Consumer Discretionary", reason: "Auto deliveries and retail spending trends" },
    { name: "Financials", reason: "Rate path sensitivity and net interest margin outlook" },
    { name: "Energy", reason: "Crude inventory data and policy headlines" },
  ],
  indexMoods: [
    {
      symbol: "SPY",
      name: "S&P 500",
      dailyChangePercent: 0.24,
      sentiment: "neutral",
      note: "Broad market holding steady; leadership narrow among mega-caps",
    },
    {
      symbol: "QQQ",
      name: "Nasdaq-100",
      dailyChangePercent: 0.58,
      sentiment: "positive",
      note: "Tech strength on AI spending narrative; semiconductors outperform",
    },
    {
      symbol: "DIA",
      name: "Dow Jones",
      dailyChangePercent: -0.12,
      sentiment: "neutral",
      note: "Industrials mixed; defensives slightly firmer",
    },
    {
      symbol: "VTI",
      name: "Total US Market",
      dailyChangePercent: 0.19,
      sentiment: "neutral",
      note: "Total market tracking large-cap benchmark with modest breadth",
    },
  ],
  interviewTakeaway: buildInterviewTakeaway(mockRecapBriefs),
  tradingSessionRecap: buildTradingSessionRecap(mockRecapBriefs),
  podcastRecap: buildPodcastRecap(mockRecapBriefs),
};
