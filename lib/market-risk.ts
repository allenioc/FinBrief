import type {
  Brief,
  ImpactAssessment,
  PotentialMarketImpact,
  RelevantRiskMeasureRow,
  RiskDriverTag,
  TradingSessionRecapRow,
} from "./types";

const ALL_RISK_DRIVERS: RiskDriverTag[] = [
  "Rates",
  "Inflation",
  "Central Banks",
  "Equities",
  "Credit",
  "FX",
  "Commodities",
  "Volatility",
  "Banking",
  "Geopolitical Risk",
  "Earnings",
  "Real Estate",
  "AI / Technology",
];

type DriverRule = {
  tag: RiskDriverTag;
  patterns: RegExp[];
  weight: number;
};

const DRIVER_RULES: DriverRule[] = [
  {
    tag: "Rates",
    patterns: [
      /\brate(s)?\b/i,
      /\byield/i,
      /\btreasury/i,
      /\bduration\b/i,
      /\bdv01\b/i,
      /\bbond price/i,
    ],
    weight: 3,
  },
  {
    tag: "Inflation",
    patterns: [/\binflation\b/i, /\bcpi\b/i, /\bpce\b/i, /\bprice pressure/i, /\bcost of living/i],
    weight: 3,
  },
  {
    tag: "Central Banks",
    patterns: [
      /\bfederal reserve\b/i,
      /\bcentral bank/i,
      /\bfomc\b/i,
      /\bpowell\b/i,
      /\becb\b/i,
      /\bbank of england\b/i,
      /\bmonetary policy/i,
    ],
    weight: 3,
  },
  {
    tag: "Equities",
    patterns: [
      /\bequity\b/i,
      /\bstock(s)?\b/i,
      /\bshares\b/i,
      /\bs&p\b/i,
      /\bnasdaq\b/i,
      /\bearnings\b/i,
      /\bipo\b/i,
    ],
    weight: 2,
  },
  {
    tag: "Credit",
    patterns: [/\bcredit spread/i, /\bhigh yield/i, /\bjunk bond/i, /\bdefault risk/i, /\bbond market/i],
    weight: 3,
  },
  {
    tag: "FX",
    patterns: [
      /\bfx\b/i,
      /\bforeign exchange/i,
      /\bcurrency\b/i,
      /\bdollar index/i,
      /\beur\/usd/i,
      /\byen\b/i,
      /\bforex\b/i,
    ],
    weight: 3,
  },
  {
    tag: "Commodities",
    patterns: [
      /\boil\b/i,
      /\bcrude\b/i,
      /\bgold\b/i,
      /\bcommodit/i,
      /\bnatural gas\b/i,
      /\bcopper\b/i,
      /\bwheat\b/i,
      /\benergy market/i,
    ],
    weight: 3,
  },
  {
    tag: "Volatility",
    patterns: [/\bvolatility\b/i, /\bvix\b/i, /\bvega\b/i, /\bvar\b/i, /\boptions?\b/i, /\bimplied vol/i],
    weight: 3,
  },
  {
    tag: "Banking",
    patterns: [
      /\bbank(s|ing)?\b/i,
      /\bdeposit(s)?\b/i,
      /\blending\b/i,
      /\bfunding stress/i,
      /\bnet interest margin/i,
      /\bregional bank/i,
    ],
    weight: 2,
  },
  {
    tag: "Geopolitical Risk",
    patterns: [
      /\bgeopolit/i,
      /\bsanction/i,
      /\bwar\b/i,
      /\bconflict\b/i,
      /\btariff/i,
      /\btrade war/i,
      /\belection\b/i,
    ],
    weight: 3,
  },
  {
    tag: "Earnings",
    patterns: [/\bearnings\b/i, /\bquarterly results\b/i, /\bguidance\b/i, /\brevenue beat/i, /\bprofit warning/i],
    weight: 2,
  },
  {
    tag: "Real Estate",
    patterns: [/\breal estate\b/i, /\breit\b/i, /\bhousing market/i, /\bmortgage/i, /\bcommercial property/i],
    weight: 3,
  },
  {
    tag: "AI / Technology",
    patterns: [
      /\bartificial intelligence\b/i,
      /\bai\b/i,
      /\bsemiconductor/i,
      /\bchipmaker/i,
      /\bhyperscal/i,
      /\bdata center/i,
      /\bcloud computing/i,
    ],
    weight: 2,
  },
];

function storyText(brief: Pick<Brief, "headline" | "excerpt" | "topic" | "ticker" | "articleType">): string {
  return [brief.headline, brief.excerpt, brief.topic, brief.ticker !== "—" ? brief.ticker : ""]
    .filter(Boolean)
    .join(" ");
}

function scoreDrivers(text: string): Map<RiskDriverTag, number> {
  const scores = new Map<RiskDriverTag, number>();
  for (const rule of DRIVER_RULES) {
    let score = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) score += rule.weight;
    }
    if (score > 0) scores.set(rule.tag, score);
  }
  return scores;
}

/** Classify 1–3 risk-driver tags from saved story fields; no forced defaults. */
export function inferRiskDrivers(
  brief: Pick<Brief, "headline" | "excerpt" | "topic" | "ticker" | "articleType">
): RiskDriverTag[] {
  const text = storyText(brief);
  const scores = scoreDrivers(text);

  if (brief.articleType === "macro news") {
    scores.set("Central Banks", (scores.get("Central Banks") ?? 0) + 2);
    scores.set("Inflation", (scores.get("Inflation") ?? 0) + 1);
  }
  if (brief.articleType === "company news") {
    scores.set("Earnings", (scores.get("Earnings") ?? 0) + 2);
    scores.set("Equities", (scores.get("Equities") ?? 0) + 1);
  }
  if (brief.articleType === "ETF/index news") {
    scores.set("Equities", (scores.get("Equities") ?? 0) + 2);
  }

  const ranked = [...scores.entries()]
    .filter(([, score]) => score >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);

  return ranked.slice(0, 3);
}

function isMarketRiskRelevant(drivers: RiskDriverTag[]): boolean {
  return drivers.length > 0;
}

function sentimentToImpact(sentiment: Brief["sentiment"]): ImpactAssessment {
  if (sentiment === "positive") return "positive";
  if (sentiment === "negative") return "negative";
  if (sentiment === "mixed") return "mixed";
  return "uncertain";
}

/** Educational market-risk lens — separate from FinBrief summary copy. */
export function buildMarketRiskLens(
  brief: Pick<Brief, "headline" | "excerpt" | "topic" | "ticker" | "sentiment" | "articleType">,
  drivers: RiskDriverTag[]
): string | null {
  if (!isMarketRiskRelevant(drivers)) return null;

  const parts: string[] = [];
  const entity = brief.ticker !== "—" ? brief.ticker : brief.topic;

  if (drivers.includes("Rates") || drivers.includes("Inflation") || drivers.includes("Central Banks")) {
    parts.push(
      "This story sits in the rates and inflation complex, where bond prices, duration, and rate expectations often move together. Fixed-income portfolios with longer duration can be more sensitive to shifts in the policy path, while front-end yields react quickly to central-bank guidance."
    );
  }
  if (drivers.includes("Equities") || drivers.includes("Earnings")) {
    parts.push(
      `For equity risk, headlines like this one can influence sector beta and earnings expectations${entity ? ` for names such as ${entity}` : ""}. Risk teams often map the theme to index or single-name exposure rather than treating it as isolated news flow.`
    );
  }
  if (drivers.includes("FX")) {
    parts.push(
      "Currency markets may reprice if the story changes growth, policy, or capital-flow assumptions. FX exposure matters for multinationals, importers, and any portfolio with unhedged foreign assets."
    );
  }
  if (drivers.includes("Commodities")) {
    parts.push(
      "Commodity-linked assets — energy, metals, or agriculture — can reflect supply, demand, or geopolitical shocks described in the reporting. This is a materials and inflation-input channel rather than a pure equity headline."
    );
  }
  if (drivers.includes("Volatility")) {
    parts.push(
      "Volatility-focused readers may consider how options markets, vega, and tail-risk measures respond when uncertainty rises. Higher implied volatility often signals demand for hedges even before spot markets fully reprice."
    );
  }
  if (drivers.includes("Credit") || drivers.includes("Banking")) {
    parts.push(
      "Credit and banking angles tie to funding conditions, deposit flows, and spread widening. Stress in lending or bank balance sheets can transmit to broader risk assets through tighter financial conditions."
    );
  }
  if (drivers.includes("Geopolitical Risk")) {
    parts.push(
      "Geopolitical headlines can widen risk premia across equities, commodities, and FX as investors demand compensation for event uncertainty. The market lens here is about risk sentiment rather than a single company outcome."
    );
  }
  if (drivers.includes("Real Estate")) {
    parts.push(
      "Real-estate and mortgage channels matter because property values and REIT cash flows respond to rates, occupancy, and financing costs cited in the story."
    );
  }
  if (drivers.includes("AI / Technology")) {
    parts.push(
      "Technology and AI themes often carry high equity beta and capex sensitivity. The market read-through is sector concentration, supply-chain demand, and whether growth expectations are being revised."
    );
  }

  if (parts.length === 0) {
    return `The saved reporting touches ${drivers.join(", ")}, which helps frame how risk managers might tag exposure — without implying a specific trade or forecast.`;
  }

  return parts.slice(0, 2).join(" ");
}

/** Conceptual asset-class impact labels from saved story metadata only. */
export function buildPotentialMarketImpact(
  brief: Pick<Brief, "sentiment" | "articleType">,
  drivers: RiskDriverTag[]
): PotentialMarketImpact | null {
  if (!isMarketRiskRelevant(drivers)) return null;

  const label = sentimentToImpact(brief.sentiment);
  const impact: PotentialMarketImpact = {};

  if (drivers.some((d) => ["Equities", "Earnings", "AI / Technology"].includes(d))) {
    impact.equities = label;
  }
  if (drivers.some((d) => ["Rates", "Inflation", "Central Banks"].includes(d))) {
    impact.ratesBonds = brief.sentiment === "positive" ? "lower" : brief.sentiment === "negative" ? "higher" : "uncertain";
  }
  if (drivers.includes("FX")) {
    impact.fx = label;
  }
  if (drivers.includes("Commodities")) {
    impact.commodities = label;
  }
  if (drivers.includes("Volatility")) {
    impact.volatility = brief.sentiment === "negative" || brief.sentiment === "mixed" ? "higher" : "uncertain";
  }
  if (drivers.some((d) => ["Credit", "Banking"].includes(d))) {
    impact.creditBanking = label;
  }

  return Object.keys(impact).length > 0 ? impact : null;
}

/** Risk measures to monitor — educational labels tied to inferred drivers only. */
export function buildRelevantRiskMeasures(drivers: RiskDriverTag[]): RelevantRiskMeasureRow[] {
  if (!isMarketRiskRelevant(drivers)) return [];

  const rows: RelevantRiskMeasureRow[] = [];

  if (drivers.some((d) => ["Equities", "Earnings", "AI / Technology"].includes(d))) {
    rows.push({
      category: "Equities",
      measures: ["Beta", "Sector exposure", "Notional exposure"],
    });
  }
  if (drivers.some((d) => ["Rates", "Inflation", "Central Banks"].includes(d))) {
    rows.push({
      category: "Rates/Bonds",
      measures: ["Duration", "DV01", "Yield curve exposure"],
    });
  }
  if (drivers.includes("FX")) {
    rows.push({ category: "FX", measures: ["Currency exposure"] });
  }
  if (drivers.includes("Commodities")) {
    rows.push({ category: "Commodities", measures: ["Commodity price exposure"] });
  }
  if (drivers.includes("Volatility")) {
    rows.push({ category: "Options/Volatility", measures: ["Vega", "Gamma", "VaR"] });
  }
  if (drivers.some((d) => ["Credit", "Banking"].includes(d))) {
    rows.push({
      category: "Credit/Banking",
      measures: ["Credit spreads", "Funding risk", "Counterparty exposure"],
    });
  }
  if (drivers.includes("Real Estate")) {
    rows.push({
      category: "Real Estate",
      measures: ["Rate sensitivity", "Occupancy and financing exposure"],
    });
  }
  if (drivers.includes("Geopolitical Risk")) {
    rows.push({
      category: "Geopolitical",
      measures: ["Tail-risk premium", "Cross-asset correlation stress"],
    });
  }

  return rows;
}

export function enrichMarketRisk<T extends Brief>(brief: T): T {
  const drivers = inferRiskDrivers(brief);
  return {
    ...brief,
    riskDrivers: drivers,
    marketRiskLens: buildMarketRiskLens(brief, drivers),
    potentialMarketImpact: buildPotentialMarketImpact(brief, drivers),
    relevantRiskMeasures: buildRelevantRiskMeasures(drivers),
  };
}

function driverPhrases(briefs: Brief[]): string[] {
  const counts = new Map<RiskDriverTag, number>();
  for (const brief of briefs) {
    for (const tag of brief.riskDrivers ?? inferRiskDrivers(brief)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);
}

function aggregateSentiment(briefs: Brief[]): "positive" | "negative" | "mixed" | "unchanged" | "uncertain" {
  if (briefs.length === 0) return "uncertain";
  let score = 0;
  for (const brief of briefs) {
    if (brief.sentiment === "positive") score += 1;
    if (brief.sentiment === "negative") score -= 1;
  }
  if (score >= 2) return "positive";
  if (score <= -2) return "negative";
  if (score === 0) return "unchanged";
  return "mixed";
}

function briefsForDrivers(briefs: Brief[], tags: RiskDriverTag[]): Brief[] {
  return briefs.filter((brief) => {
    const drivers = brief.riskDrivers ?? inferRiskDrivers(brief);
    return drivers.some((tag) => tags.includes(tag));
  });
}

function formatMoveLabel(value: ReturnType<typeof aggregateSentiment>): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Daily Trading Session Recap rows from saved stories only — no invented price levels. */
export function buildTradingSessionRecap(briefs: Brief[]): TradingSessionRecapRow[] {
  const enriched = briefs.map((b) => enrichMarketRisk(b));
  const rows: TradingSessionRecapRow[] = [];

  const equityBriefs = briefsForDrivers(enriched, ["Equities", "Earnings", "AI / Technology"]);
  if (equityBriefs.length > 0) {
    rows.push({
      assetClass: "Equities",
      currentLevel: "Level unavailable",
      whatMoved: formatMoveLabel(aggregateSentiment(equityBriefs)),
      mainDrivers: driverPhrases(equityBriefs).slice(0, 3),
    });
  }

  const ratesBriefs = briefsForDrivers(enriched, ["Rates", "Inflation", "Central Banks"]);
  if (ratesBriefs.length > 0) {
    const move =
      aggregateSentiment(ratesBriefs) === "positive"
        ? "Lower"
        : aggregateSentiment(ratesBriefs) === "negative"
          ? "Higher"
          : "Mixed";
    rows.push({
      assetClass: "Bonds / Rates",
      currentLevel: "Level unavailable",
      whatMoved: `${move} rate-pressure theme`,
      mainDrivers: driverPhrases(ratesBriefs).slice(0, 3),
    });
  }

  const commodityBriefs = briefsForDrivers(enriched, ["Commodities", "Geopolitical Risk"]);
  if (commodityBriefs.length > 0) {
    rows.push({
      assetClass: "Commodities",
      currentLevel: "Level unavailable",
      whatMoved: formatMoveLabel(aggregateSentiment(commodityBriefs)),
      mainDrivers: driverPhrases(commodityBriefs).slice(0, 3),
    });
  }

  const fxBriefs = briefsForDrivers(enriched, ["FX"]);
  if (fxBriefs.length > 0) {
    rows.push({
      assetClass: "FX",
      currentLevel: "Level unavailable",
      whatMoved: formatMoveLabel(aggregateSentiment(fxBriefs)),
      mainDrivers: driverPhrases(fxBriefs).slice(0, 3),
    });
  }

  const volBriefs = briefsForDrivers(enriched, ["Volatility"]);
  if (volBriefs.length > 0) {
    rows.push({
      assetClass: "Volatility",
      currentLevel: "Level unavailable",
      whatMoved: formatMoveLabel(aggregateSentiment(volBriefs)),
      mainDrivers: driverPhrases(volBriefs).slice(0, 3),
    });
  }

  return rows;
}

function monitorListFromDrivers(drivers: string[]): string[] {
  const monitors: string[] = [];
  if (drivers.some((d) => ["Rates", "Inflation", "Central Banks"].includes(d))) {
    monitors.push("duration and DV01");
  }
  if (drivers.some((d) => ["Equities", "Earnings", "AI / Technology"].includes(d))) {
    monitors.push("equity beta and sector exposure");
  }
  if (drivers.includes("FX")) monitors.push("currency exposure");
  if (drivers.includes("Commodities")) monitors.push("commodity price exposure");
  if (drivers.includes("Volatility")) monitors.push("volatility, vega, and tail-risk");
  if (drivers.some((d) => ["Credit", "Banking"].includes(d))) {
    monitors.push("credit spreads and funding conditions");
  }
  if (drivers.includes("Geopolitical Risk")) monitors.push("stress-test and correlation assumptions");
  return monitors.slice(0, 4);
}

export function buildInterviewTakeaway(briefs: Brief[]): string {
  const enriched = briefs.map((b) => enrichMarketRisk(b));
  if (enriched.length === 0) {
    return "No saved daily stories are available yet to summarize today's market-risk drivers.";
  }

  const drivers = driverPhrases(enriched);
  const mood = aggregateSentiment(enriched);
  const lead = enriched[0];
  const monitors = monitorListFromDrivers(drivers);

  return [
    `What happened: today's saved edition reads ${formatMoveLabel(mood).toLowerCase()} across the themes in the daily risk brief.`,
    drivers.length > 0
      ? `Why it happened: the main risk drivers in saved stories include ${drivers.join(", ")}${lead ? `, led by reporting on ${lead.topic.toLowerCase()}` : ""}.`
      : "Why it happened: driver tags are sparse, so the session read stays tied to the headline mix only.",
    monitors.length > 0
      ? `What a market risk team would monitor: ${monitors.join(", ")}.`
      : "What a market risk team would monitor: headline-driven sentiment shifts until more cross-asset tags appear.",
    "Built from saved FinBrief stories for interview prep — not live prices or trading advice.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildPodcastRecap(briefs: Brief[]): string {
  const enriched = briefs.map((b) => enrichMarketRisk(b));
  if (enriched.length < 2) {
    return "Today's saved edition is still light. Once more daily stories are saved, FinBrief will produce a fuller spoken-style market risk recap across equities, rates, commodities, and FX.";
  }

  const recap = buildTradingSessionRecap(enriched);
  const drivers = driverPhrases(enriched);
  const mood = aggregateSentiment(enriched);

  const sentences: string[] = [
    `Here's your FinBrief market risk recap from today's saved stories — overall tone looks ${formatMoveLabel(mood).toLowerCase()} across the edition.`,
  ];

  const equity = recap.find((row) => row.assetClass === "Equities");
  if (equity) {
    sentences.push(
      `On equities, the saved narrative is ${equity.whatMoved.toLowerCase()}, with drivers such as ${equity.mainDrivers.join(", ") || "earnings and sector themes"}.`
    );
  }

  const rates = recap.find((row) => row.assetClass === "Bonds / Rates");
  if (rates) {
    sentences.push(
      `Bonds and rates channels show ${rates.whatMoved.toLowerCase()}, which matters for duration, DV01, and rate-sensitive equity beta.`
    );
  }

  const commodities = recap.find((row) => row.assetClass === "Commodities");
  const fx = recap.find((row) => row.assetClass === "FX");
  if (commodities || fx) {
    sentences.push(
      `${commodities ? `Commodity exposure themes appear ${commodities.whatMoved.toLowerCase()}. ` : ""}${fx ? `FX-related headlines point to ${fx.whatMoved.toLowerCase()} currency-risk sentiment.` : ""}`.trim()
    );
  }

  if (drivers.includes("Volatility") || recap.some((row) => row.assetClass === "Volatility")) {
    sentences.push(
      "Volatility and hedging angles — vega, options demand, and tail-risk — are worth watching if uncertainty persists."
    );
  } else if (drivers.includes("Credit") || drivers.includes("Banking")) {
    sentences.push(
      "Credit and banking stress markers in the saved set highlight funding and spread risk rather than a single asset move."
    );
  } else {
    sentences.push(
      `The cross-asset lens today is driven mainly by ${drivers.slice(0, 3).join(", ") || "the top saved headlines"}.`
    );
  }

  sentences.push(
    "All of this is built from saved FinBrief editions for risk awareness — not live prices or trading advice."
  );

  return sentences.slice(0, 6).join(" ");
}

export const RISK_DRIVER_OPTIONS = ALL_RISK_DRIVERS;
