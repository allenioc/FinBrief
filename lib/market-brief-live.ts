import type { Brief, MarketBriefData, Sentiment } from "./types";
import {
  buildInterviewTakeaway,
  buildPodcastRecap,
  buildTradingSessionRecap,
  enrichMarketRisk,
} from "./market-risk";

function moodLabel(sentiment: Sentiment): string {
  if (sentiment === "positive") return "Risk-on tone";
  if (sentiment === "negative") return "Cautious tone";
  if (sentiment === "mixed") return "Mixed conviction";
  return "Cautiously balanced";
}

function summarizeMood(briefs: Brief[]): Sentiment {
  const score = briefs.reduce((acc, brief) => {
    if (brief.sentiment === "positive") return acc + 1;
    if (brief.sentiment === "negative") return acc - 1;
    return acc;
  }, 0);
  if (score >= 2) return "positive";
  if (score <= -2) return "negative";
  if (Math.abs(score) <= 1) return "neutral";
  return "mixed";
}

function topThemeBySentiment(briefs: Brief[], sentiment: "positive" | "negative") {
  const found = briefs.find((brief) => brief.sentiment === sentiment);
  if (!found) {
    return {
      title: sentiment === "positive" ? "Selective strength" : "Risk watch",
      description:
        sentiment === "positive"
          ? "Markets are finding pockets of support across earnings and macro surprises."
          : "Investors are monitoring downside risks from policy, valuation, and growth uncertainty.",
    };
  }
  return {
    title: found.topic,
    description: found.whyItMatters,
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function buildMarketBriefFromBriefs(briefs: Brief[]): MarketBriefData {
  const enriched = briefs.map((brief) => enrichMarketRisk(brief));
  const ordered = [...enriched].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
  const overallMood = summarizeMood(ordered);

  const topStories = ordered.slice(0, 5).map((story) => ({
    id: story.id,
    title: story.headline,
    source: story.source,
    sentiment: story.sentiment,
  }));

  const macroEvents = unique(
    ordered
      .filter((brief) => brief.articleType === "macro news" || brief.topic.toLowerCase().includes("rate"))
      .map((brief) => brief.headline)
  ).slice(0, 5);

  const sectors = unique(
    ordered
      .flatMap((brief) => brief.keyAffectedAssets)
      .filter((asset) => asset.length > 2 && !/^[A-Z]{1,5}$/.test(asset))
  ).slice(0, 4);

  const sectorsToWatch = (sectors.length > 0 ? sectors : ["Technology", "Financials", "Energy", "Industrials"]).map(
    (name, index) => ({
      name,
      reason:
        ordered[index]?.whyItMatters ??
        "Recent headlines suggest meaningful shifts in sentiment and positioning.",
    })
  );

  const indexSymbols = [
    { symbol: "SPY", name: "S&P 500" },
    { symbol: "QQQ", name: "Nasdaq-100" },
    { symbol: "DIA", name: "Dow Jones" },
    { symbol: "VTI", name: "Total US Market" },
  ];

  const indexMoods = indexSymbols.map((index, idx) => {
    const linked = ordered.find((brief) =>
      [brief.ticker, ...brief.keyAffectedAssets].some((asset) => asset.toUpperCase() === index.symbol)
    );
    const sentiment = linked?.sentiment ?? overallMood;
    const direction = sentiment === "positive" ? 0.42 : sentiment === "negative" ? -0.38 : 0.05;
    return {
      symbol: index.symbol,
      name: index.name,
      dailyChangePercent: Number((direction + idx * 0.03).toFixed(2)),
      sentiment,
      note:
        linked?.whyItMatters ??
        "Index sentiment reflects the latest blend of earnings, macro releases, and policy commentary.",
    };
  });

  return {
    date: new Date().toISOString().slice(0, 10),
    topStories,
    overallMood,
    overallMoodLabel: moodLabel(overallMood),
    overallMoodSummary:
      ordered[0]?.summary ??
      "Live briefings are being assembled from current finance and business headlines.",
    topPositiveTheme: topThemeBySentiment(ordered, "positive"),
    topNegativeTheme: topThemeBySentiment(ordered, "negative"),
    keyMacroEvents:
      macroEvents.length > 0
        ? macroEvents
        : [
            "Tracking inflation and interest-rate updates from central bank commentary",
            "Monitoring cross-asset reaction to earnings and guidance revisions",
          ],
    sectorsToWatch,
    indexMoods,
    interviewTakeaway: buildInterviewTakeaway(ordered),
    tradingSessionRecap: buildTradingSessionRecap(ordered),
    podcastRecap: buildPodcastRecap(ordered),
  };
}

