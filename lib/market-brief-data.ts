import type { MarketBriefData } from "./types";
import { MOCK_BRIEFS } from "./articles-data";
import { buildMarketBriefFromBriefs } from "./market-brief-live";

export const MARKET_BRIEF: MarketBriefData = buildMarketBriefFromBriefs(MOCK_BRIEFS.slice(0, 8), null);
