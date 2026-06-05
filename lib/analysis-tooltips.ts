import type { MarketImpact, Sentiment } from "./types";

export const ANALYSIS_LABEL_TOOLTIPS = {
  sentiment:
    "Sentiment estimates whether the news is generally positive, negative, neutral, or mixed for the related company, ETF, index, sector, or market topic.",
  marketImpact:
    "Market impact estimates how important the story may be to investors or markets: low, medium, or high.",
  confidence:
    "Confidence shows how sure FinBrief is about its analysis. Lower confidence means the story may be more uncertain or harder to classify.",
  articleType:
    "Article type shows what kind of finance story this is, such as company news, macro news, ETF/index news, or sector news.",
} as const;

export const SENTIMENT_TOOLTIPS: Record<Sentiment, string> = {
  positive:
    "Positive means the story may be supportive for the related company, ETF, index, sector, or topic. This is not a buy recommendation.",
  negative:
    "Negative means the story may raise concerns or risks for the related asset/topic. This is not a sell recommendation.",
  neutral:
    "Neutral means the story is mostly informational, balanced, or does not clearly lean positive or negative.",
  mixed: "Mixed means the story has both positive and negative interpretations.",
};

export const IMPACT_TOOLTIPS: Record<MarketImpact, string> = {
  low: "Low impact means the story is useful context but unlikely to strongly affect markets by itself.",
  medium:
    "Medium impact means the story is worth watching and may affect a company, sector, ETF, or topic.",
  high: "High impact means the story could affect broader markets, major indexes, sectors, or investor expectations.",
};
