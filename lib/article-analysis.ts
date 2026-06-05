import type { MarketImpact, Sentiment } from "./types";

const POSITIVE_WORDS = [
  "beat",
  "growth",
  "strong",
  "surge",
  "gain",
  "upgraded",
  "improved",
  "rally",
  "outperform",
  "cooling",
  "easing",
];

const NEGATIVE_WORDS = [
  "miss",
  "decline",
  "drop",
  "down",
  "cut",
  "warning",
  "risk",
  "concern",
  "lawsuit",
  "downgrade",
  "pressure",
  "sticky",
];

const HIGH_IMPACT_TERMS = [
  "federal reserve",
  "fed",
  "cpi",
  "inflation",
  "interest rates",
  "jobs report",
  "gdp",
  "nasdaq",
  "s&p 500",
  "earnings",
];

const MEDIUM_IMPACT_TERMS = [
  "guidance",
  "delivery",
  "etf",
  "sector",
  "forecast",
  "outlook",
  "policy",
  "bond yields",
];

const KEY_TERM_DEFINITIONS: Record<string, string> = {
  earnings: "A company's profit results reported for a quarter or year.",
  inflation: "The rate at which prices rise across the economy.",
  cpi: "Consumer Price Index, a common measure of inflation.",
  fed: "The U.S. Federal Reserve, which sets monetary policy.",
  guidance: "Management's outlook for future performance.",
  valuation: "How expensive an asset looks relative to earnings or growth.",
  etf: "Exchange-traded fund, a basket of assets traded like a stock.",
  "interest rates": "The cost of borrowing money, heavily influenced by central banks.",
  "bond yields": "Returns investors earn from bonds; they move with rates and inflation expectations.",
  revenue: "Total sales generated before subtracting expenses.",
  "market cap": "Total market value of a company (share price x shares outstanding).",
};

const DEFAULT_KEY_TERMS = ["earnings", "guidance", "valuation", "inflation", "interest rates"];

function scoreText(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  return words.reduce((sum, word) => sum + (lower.includes(word) ? 1 : 0), 0);
}

export function estimateSentiment(text: string): {
  sentiment: Sentiment;
  confidence: number;
} {
  const positive = scoreText(text, POSITIVE_WORDS);
  const negative = scoreText(text, NEGATIVE_WORDS);
  const delta = positive - negative;
  if (positive > 0 && negative > 0 && Math.abs(delta) <= 1) {
    return { sentiment: "mixed", confidence: 68 };
  }
  if (delta >= 2) return { sentiment: "positive", confidence: Math.min(90, 70 + delta * 4) };
  if (delta <= -2) return { sentiment: "negative", confidence: Math.min(90, 70 + Math.abs(delta) * 4) };
  return { sentiment: "neutral", confidence: 64 };
}

export function estimateMarketImpact(text: string): MarketImpact {
  const lower = text.toLowerCase();
  const highScore = scoreText(lower, HIGH_IMPACT_TERMS);
  if (highScore >= 2) return "high";
  const mediumScore = scoreText(lower, MEDIUM_IMPACT_TERMS);
  if (highScore >= 1 || mediumScore >= 2) return "medium";
  return "low";
}

export function inferArticleType(text: string): "company" | "market" | "macro" | "etf" | "sector" {
  const lower = text.toLowerCase();
  if (/\b(etf|index|nasdaq|s&p 500|dow jones|qqq|spy|dia|vti)\b/.test(lower)) return "etf";
  if (/\b(cpi|inflation|federal reserve|fed|interest rates|macro|treasury|jobs)\b/.test(lower))
    return "macro";
  if (/\b(sector|industrials|energy|technology|financials|health care)\b/.test(lower))
    return "sector";
  if (/\b(markets|stocks|futures|wall street)\b/.test(lower)) return "market";
  return "company";
}

export function extractKeyTerms(text: string): { term: string; definition: string }[] {
  const lower = text.toLowerCase();
  const found = Object.entries(KEY_TERM_DEFINITIONS)
    .filter(([term]) => lower.includes(term))
    .slice(0, 5)
    .map(([term, definition]) => ({ term, definition }));

  if (found.length > 0) return found;
  return DEFAULT_KEY_TERMS.slice(0, 4).map((term) => ({
    term,
    definition: KEY_TERM_DEFINITIONS[term],
  }));
}

export function buildThirtySecondVersion(headline: string, excerpt: string): string {
  const base = excerpt || headline;
  const shortened = base.length > 220 ? `${base.slice(0, 217).trimEnd()}...` : base;
  return `${headline}. ${shortened}`.slice(0, 320);
}

export function buildEducationalSummary(headline: string, excerpt: string, query: string): string {
  const scope = query ? `for ${query}` : "for the broader market";
  return [
    `${headline}. This report highlights a development that may matter ${scope}.`,
    `In plain language, the story points to potential effects on company expectations, sector positioning, or macro sentiment depending on how future data confirms the trend.`,
    `FinBrief's educational view focuses on context: what changed, what is uncertain, and which assets may be sensitive if related updates continue.`,
  ].join(" ");
}

export function buildLongSummary(headline: string, excerpt: string, query: string): string {
  const focus = query || "market participants";
  const paragraph1 = `${headline}. ${excerpt || "The source article highlights a timely development with potential financial relevance."} FinBrief summarizes the key point in educational terms rather than reproducing publisher text.`;
  const paragraph2 = `Why it matters: this update can influence expectations for investors focused on ${focus}, especially if it changes outlook, policy assumptions, or demand trends in related assets.`;
  const paragraph3 = `Uncertainty remains important. Early headlines can be revised by follow-up guidance, economic releases, or company disclosures, so readers should monitor confirmation signals before drawing strong conclusions.`;
  return `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`;
}
