import type { Brief, MarketBriefAssetRow, MarketDirection, RiskExposureRow, RiskDriverTag } from "./types";
import { enrichMarketRisk, inferRiskDrivers } from "./market-risk";

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

export function driverPhrasesFromBriefs(briefs: Brief[]): string[] {
  return driverPhrases(briefs.map((brief) => enrichMarketRisk(brief)));
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? trimmed).trim();
}

function briefsForDrivers(briefs: Brief[], tags: RiskDriverTag[]): Brief[] {
  return briefs.filter((brief) => {
    const drivers = brief.riskDrivers ?? inferRiskDrivers(brief);
    return drivers.some((tag) => tags.includes(tag));
  });
}

export function buildSessionHeadline(assets: MarketBriefAssetRow[]): string {
  const available = assets.filter((asset) => asset.available);
  if (available.length === 0) {
    return "Market risk session brief";
  }

  const up = available.filter((asset) => asset.direction === "Up").map((asset) => asset.name);
  const down = available.filter((asset) => asset.direction === "Down").map((asset) => asset.name);

  if (up.length > 0 && down.length === 0) {
    return `${up.slice(0, 2).join(" and ")} leading firmer`;
  }
  if (down.length > 0 && up.length === 0) {
    return `${down.slice(0, 2).join(" and ")} under pressure`;
  }
  if (up.length > 0 && down.length > 0) {
    return `Mixed session: ${up[0]} up, ${down[0]} down`;
  }
  return "Benchmarks little changed across the snapshot";
}

function describeMove(asset: MarketBriefAssetRow): string {
  if (asset.direction === "Flat") {
    return `${asset.name} was little changed at ${asset.currentLevel}`;
  }
  return `${asset.name} ${asset.direction.toLowerCase()} to ${asset.currentLevel} (${asset.changeLabel})`;
}

export function buildSessionRecapParagraph(
  briefs: Brief[],
  assets: MarketBriefAssetRow[]
): string {
  const enriched = briefs.map((brief) => enrichMarketRisk(brief));
  const drivers = driverPhrases(enriched);
  const available = assets.filter((asset) => asset.available);

  if (enriched.length === 0 && available.length === 0) {
    return "Market snapshot and saved headline data are still loading for this session.";
  }

  const sentences: string[] = [];

  if (available.length > 0) {
    const leadMoves = available.slice(0, 3).map(describeMove);
    sentences.push(`What moved: ${leadMoves.join("; ")}.`);
  }

  if (drivers.length > 0) {
    sentences.push(`Likely drivers from today's saved headlines include ${drivers.slice(0, 3).join(", ")}.`);
  } else if (enriched[0]) {
    sentences.push(`The leading saved headline theme is ${enriched[0].topic.toLowerCase()}.`);
  }

  const exposures = buildRiskExposures(enriched)
    .slice(0, 2)
    .map((row) => row.category.toLowerCase());
  if (exposures.length > 0) {
    sentences.push(`Exposures to watch: ${exposures.join(" and ")}.`);
  }

  const lead = enriched[0];
  if (lead && sentences.length < 5) {
    sentences.push(
      `Headline anchor: ${firstSentence(lead.headline)} — relevant for ${lead.riskDrivers?.slice(0, 2).join(", ") || "cross-asset risk"}.`
    );
  }

  return sentences.slice(0, 5).join(" ");
}

export function buildInterviewTakeaway(
  briefs: Brief[],
  assets: MarketBriefAssetRow[]
): string {
  const enriched = briefs.map((brief) => enrichMarketRisk(brief));
  const drivers = driverPhrases(enriched);
  const available = assets.filter((asset) => asset.available);
  const monitors = buildRiskExposures(enriched)
    .slice(0, 3)
    .map((row) => row.category);

  const moveBits =
    available.length > 0
      ? available
          .slice(0, 3)
          .map((asset) => `${asset.name} ${asset.direction.toLowerCase()}`)
          .join(", ")
      : "benchmark levels still loading";

  return [
    `What happened: ${moveBits}.`,
    drivers.length > 0
      ? `Why it happened: saved drivers point to ${drivers.slice(0, 3).join(", ")}.`
      : "Why it happened: driver tags are still sparse in the saved edition.",
    monitors.length > 0
      ? `What a market risk team would monitor: ${monitors.join(", ")}.`
      : "What a market risk team would monitor: cross-asset beta, rates, and liquidity channels.",
  ].join(" ");
}

const EXPOSURE_RULES: {
  category: string;
  tags: RiskDriverTag[];
}[] = [
  { category: "Equity beta / sector exposure", tags: ["Equities", "Earnings", "AI / Technology"] },
  { category: "Duration / DV01", tags: ["Rates", "Inflation", "Central Banks"] },
  { category: "FX exposure", tags: ["FX"] },
  { category: "Commodity exposure", tags: ["Commodities", "Geopolitical Risk"] },
  { category: "Volatility / vega", tags: ["Volatility"] },
  { category: "Credit spreads / banking exposure", tags: ["Credit", "Banking"] },
  { category: "Liquidity / funding risk", tags: ["Banking", "Credit"] },
];

export function buildRiskExposures(briefs: Brief[]): RiskExposureRow[] {
  const enriched = briefs.map((brief) => enrichMarketRisk(brief));
  const rows: RiskExposureRow[] = [];
  const seen = new Set<string>();

  for (const rule of EXPOSURE_RULES) {
    if (seen.has(rule.category)) continue;
    const matches = briefsForDrivers(enriched, rule.tags);
    if (matches.length === 0) continue;

    const explanation = firstSentence(matches[0].whyItMatters || matches[0].headline);
    if (!explanation || explanation.length < 12) continue;

    rows.push({
      category: rule.category,
      explanation,
    });
    seen.add(rule.category);
  }

  return rows.slice(0, 5);
}

export function summarizeDirections(assets: MarketBriefAssetRow[]): Record<MarketDirection, number> {
  return assets.reduce(
    (acc, asset) => {
      if (!asset.available) return acc;
      acc[asset.direction] += 1;
      return acc;
    },
    { Up: 0, Down: 0, Flat: 0 } as Record<MarketDirection, number>
  );
}
