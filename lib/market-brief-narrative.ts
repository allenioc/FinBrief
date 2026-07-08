import type { Brief, MarketBriefAssetRow, MarketDirection, RiskExposureRow, RiskDriverTag } from "./types";
import { enrichMarketRisk, inferRiskDrivers } from "./market-risk";

export const DAILY_BRIEF_TITLE = "Today's market brief";

const US_EQUITY_IDS = new Set(["sp500", "nasdaq"]);
const CA_EQUITY_IDS = new Set(["tsx"]);

function driverPhrases(briefs: Brief[]): RiskDriverTag[] {
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

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? trimmed).trim();
}

function sanitizeCopy(text: string): string {
  return text
    .replace(/\bFinBrief\b/gi, "")
    .replace(/which stock to buy/gi, "")
    .replace(/this adds a new layer of detail/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function briefsForDrivers(briefs: Brief[], tags: RiskDriverTag[]): Brief[] {
  return briefs.filter((brief) => {
    const drivers = brief.riskDrivers ?? inferRiskDrivers(brief);
    return drivers.some((tag) => tags.includes(tag));
  });
}

function moveVerb(asset: MarketBriefAssetRow): string {
  if (asset.direction === "Up") return "rose";
  if (asset.direction === "Down") return "fell";
  return "was little changed";
}

function formatMoveClause(asset: MarketBriefAssetRow): string {
  const name = asset.name;
  if (asset.direction === "Flat") {
    return `${name} was little changed at ${asset.currentLevel}`;
  }
  const change = asset.changeLabel.replace(/^\+/, "");
  return `${name} ${moveVerb(asset)} ${change} to ${asset.currentLevel}`;
}

function buildOverallToneSentence(available: MarketBriefAssetRow[]): string {
  if (available.length === 0) {
    return "Cross-asset benchmark data is limited in the current snapshot.";
  }

  const us = available.filter((asset) => US_EQUITY_IDS.has(asset.id));
  const tsx = available.find((asset) => asset.id === "tsx");
  const usDown = us.filter((asset) => asset.direction === "Down").length;
  const usUp = us.filter((asset) => asset.direction === "Up").length;

  if (usDown > 0 && usUp === 0 && tsx?.direction === "Up") {
    return "Markets were mixed today, with U.S. equities weaker while Canadian equities finished higher.";
  }
  if (usUp > 0 && usDown === 0 && tsx?.direction === "Down") {
    return "Markets were mixed today, with U.S. equities firmer while Canadian equities lagged.";
  }
  if (usDown > usUp) {
    return "The session leaned risk-off in equities, with more benchmarks lower than higher in the snapshot.";
  }
  if (usUp > usDown) {
    return "The session leaned risk-on in equities, with more benchmarks higher than lower in the snapshot.";
  }

  const flatCount = available.filter((asset) => asset.direction === "Flat").length;
  if (flatCount === available.length) {
    return "Markets were broadly quiet, with major benchmarks little changed in the snapshot.";
  }

  return "Markets were mixed today across the available benchmark set.";
}

function buildMoveDetailSentence(available: MarketBriefAssetRow[]): string | null {
  const priority = ["sp500", "nasdaq", "tsx", "us10y", "vix"];
  const picked = priority
    .map((id) => available.find((asset) => asset.id === id))
    .filter((asset): asset is MarketBriefAssetRow => asset != null)
    .slice(0, 4);

  if (picked.length === 0) return null;

  const clauses = picked.map(formatMoveClause);
  if (clauses.length === 1) return `${clauses[0]}.`;
  if (clauses.length === 2) return `${clauses[0]}, while ${clauses[1]}.`;
  return `${clauses.slice(0, -1).join(", ")}, while ${clauses[clauses.length - 1]}.`;
}

function formatExposureList(categories: string[]): string {
  if (categories.length === 1) return categories[0];
  if (categories.length === 2) return `${categories[0]} and ${categories[1]}`;
  return `${categories.slice(0, -1).join(", ")}, and ${categories[categories.length - 1]}`;
}

/** One polished daily market brief paragraph (3–5 sentences). */
export function buildSessionRecapParagraph(
  briefs: Brief[],
  assets: MarketBriefAssetRow[]
): string {
  const enriched = briefs.map((brief) => enrichMarketRisk(brief));
  const drivers = driverPhrases(enriched);
  const available = assets.filter((asset) => asset.available);
  const exposures = buildRiskExposures(enriched);

  const sentences: string[] = [];

  sentences.push(buildOverallToneSentence(available));

  const moveDetail = buildMoveDetailSentence(available);
  if (moveDetail) sentences.push(moveDetail);

  if (drivers.length > 0) {
    sentences.push(
      `Related drivers from today's saved stories include ${drivers.slice(0, 3).join(", ")}.`
    );
  } else if (enriched.length > 0) {
    sentences.push(
      "Today's saved headline mix is still building a clearer cross-asset driver set."
    );
  }

  if (exposures.length > 0) {
    sentences.push(
      `From a market risk perspective, the key exposures to monitor are ${formatExposureList(
        exposures.slice(0, 3).map((row) => row.category.toLowerCase())
      )}.`
    );
  }

  return sentences.slice(0, 5).join(" ");
}

export function buildInterviewTakeaway(
  briefs: Brief[],
  assets: MarketBriefAssetRow[]
): string {
  const recap = buildSessionRecapParagraph(briefs, assets);
  const drivers = driverPhrases(briefs.map((brief) => enrichMarketRisk(brief))).slice(0, 3);
  const monitors = buildRiskExposures(briefs.map((brief) => enrichMarketRisk(brief)))
    .slice(0, 3)
    .map((row) => row.category);

  const monitorLine =
    monitors.length > 0
      ? `A market risk team would watch ${formatExposureList(monitors.map((m) => m.toLowerCase()))}.`
      : "A market risk team would watch beta, rates, and liquidity channels.";

  const driverLine =
    drivers.length > 0
      ? `Drivers in focus: ${drivers.join(", ")}.`
      : "Driver tags are still sparse in the saved edition.";

  return `${recap} ${driverLine} ${monitorLine}`;
}

const EXPOSURE_RULES: {
  category: string;
  tags: RiskDriverTag[];
  fallback: string;
}[] = [
  {
    category: "Equity beta / sector exposure",
    tags: ["Equities", "Earnings", "AI / Technology"],
    fallback: "Saved equity and earnings stories may shift sector beta and single-name risk.",
  },
  {
    category: "Duration / DV01",
    tags: ["Rates", "Inflation", "Central Banks"],
    fallback: "Rates and inflation headlines can affect duration and front-end yield sensitivity.",
  },
  {
    category: "FX exposure",
    tags: ["FX"],
    fallback: "Currency-related stories may matter for unhedged FX and translation risk.",
  },
  {
    category: "Commodity exposure",
    tags: ["Commodities", "Geopolitical Risk"],
    fallback: "Commodity and geopolitical themes can flow through energy and materials exposure.",
  },
  {
    category: "Volatility / vega",
    tags: ["Volatility"],
    fallback: "Volatility-linked headlines may affect hedging demand and tail-risk measures.",
  },
  {
    category: "Credit spreads / banking exposure",
    tags: ["Credit", "Banking"],
    fallback: "Credit and banking stories may relate to spread widening and funding conditions.",
  },
  {
    category: "Liquidity / funding risk",
    tags: ["Banking", "Credit"],
    fallback: "Banking stress themes can tighten liquidity and funding availability.",
  },
];

export function buildRiskExposures(briefs: Brief[]): RiskExposureRow[] {
  const enriched = briefs.map((brief) => enrichMarketRisk(brief));
  const rows: RiskExposureRow[] = [];
  const seen = new Set<string>();

  for (const rule of EXPOSURE_RULES) {
    if (seen.has(rule.category)) continue;
    const matches = briefsForDrivers(enriched, rule.tags);
    if (matches.length === 0) continue;

    const fromWhy = sanitizeCopy(firstSentence(matches[0].whyItMatters));
    const explanation =
      fromWhy.length >= 24 && fromWhy.length <= 180 && !fromWhy.toLowerCase().includes("finbrief")
        ? fromWhy
        : rule.fallback;

    rows.push({ category: rule.category, explanation });
    seen.add(rule.category);
  }

  return rows.slice(0, 5);
}

/** 2–4 driver summaries for “Why it moved” — categories, not raw headlines. */
export function buildWhyItMovedItems(briefs: Brief[]): string[] {
  const enriched = briefs.map((brief) => enrichMarketRisk(brief));
  const drivers = driverPhrases(enriched).slice(0, 4);

  if (drivers.length === 0) {
    return enriched.length > 0
      ? [
          "Today's saved edition is still building a clearer driver set across asset classes.",
        ]
      : [];
  }

  return drivers.map((driver) => {
    const matches = enriched.filter((brief) => brief.riskDrivers?.includes(driver));
    const topics = [...new Set(matches.map((brief) => brief.topic))].slice(0, 2);
    const topicPhrase =
      topics.length > 0
        ? ` with ${topics.join(" and ").toLowerCase()} coverage in today's edition`
        : " in today's saved stories";
    return `${driver} — related drivers from today's stories include this theme${topicPhrase}.`;
  });
}

export function summarizeDirections(
  assets: MarketBriefAssetRow[]
): Record<MarketDirection, number> {
  return assets.reduce(
    (acc, asset) => {
      if (!asset.available) return acc;
      acc[asset.direction] += 1;
      return acc;
    },
    { Up: 0, Down: 0, Flat: 0 } as Record<MarketDirection, number>
  );
}
