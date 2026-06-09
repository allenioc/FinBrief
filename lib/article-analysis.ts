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

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripQuotes(text: string): string {
  return text.replace(/^["'""]+|["'""]+$/g, "").trim();
}

function firstSentence(text: string): string {
  const cleaned = normalizeWhitespace(text);
  const match = cleaned.match(/^[^.!?]+[.!?]?/);
  return match ? normalizeWhitespace(match[0]) : cleaned;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trimEnd()}...`;
}

function isWeakTopic(value: string): boolean {
  const topic = normalizeWhitespace(value);
  if (topic.length < 2) return true;
  if (/\.{2,}/.test(topic) || /["']/.test(topic)) return true;
  const words = topic.split(/\s+/);
  if (words.length <= 2) {
    const first = words[0]?.toLowerCase() ?? "";
    if (/^(the|a|an|of|in|on|at|to|for|with|from|confident|new|how|why|what|watch|live|breaking|update|just)$/i.test(first)) {
      return true;
    }
  }
  return false;
}

function combinedText(headline: string, excerpt: string): string {
  return normalizeWhitespace(`${headline} ${excerpt}`);
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

export function inferDisplayTopic(
  query: string,
  headline: string,
  articleType: ReturnType<typeof inferArticleType>
): string {
  const q = query.trim();
  if (q && !isWeakTopic(q)) {
    return q.toUpperCase() === q ? q : q;
  }

  const lower = headline.toLowerCase();
  if (/\bnvda|nvidia\b/.test(lower)) return "NVIDIA";
  if (/\baapl|apple\b/.test(lower)) return "Apple";
  if (/\bmsft|microsoft\b/.test(lower)) return "Microsoft";
  if (/\btsla|tesla\b/.test(lower)) return "Tesla";
  if (/\bamzn|amazon\b/.test(lower)) return "Amazon";
  if (/\bmeta|facebook\b/.test(lower)) return "Meta";
  if (/\bgoog|alphabet\b/.test(lower)) return "Alphabet";
  if (/\bspy|s&p 500\b/.test(lower)) return "S&P 500";
  if (/\bqqq|nasdaq\b/.test(lower)) return "Nasdaq";
  if (/\binflation|cpi\b/.test(lower)) return "Inflation";
  if (/\bfed|interest rates\b/.test(lower)) return "Interest rates";

  if (articleType === "macro") return "Macro";
  if (articleType === "etf") return "Index ETFs";
  if (articleType === "sector") return "Sector news";
  if (articleType === "market") return "Markets";
  return "Markets";
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

/** FinBrief summary: what happened only — no impact analysis or filler. */
export function buildFinBriefSummary(headline: string, excerpt: string): string {
  const title = stripQuotes(normalizeWhitespace(headline.replace(/\.$/, "")));
  const detail = excerpt ? firstSentence(excerpt) : "";

  if (detail && detail.length > 30) {
    const detailLower = detail.toLowerCase();
    const titleStart = title.toLowerCase().slice(0, Math.min(24, title.length));
    if (titleStart && detailLower.startsWith(titleStart)) {
      return detail;
    }
    return `${title}. ${detail}`;
  }

  if (title) {
    return `${title}. The publisher provided limited detail in the available excerpt.`;
  }

  return "The source shared a brief update. Read the full article for complete reporting.";
}

/** Three short bullets for the 30-second version. */
export function buildThirtySecondVersion(headline: string, excerpt: string): string {
  const title = stripQuotes(normalizeWhitespace(headline.replace(/\.$/, "")));
  const detail = excerpt ? firstSentence(excerpt) : "";
  const text = combinedText(headline, excerpt).toLowerCase();

  const eventBullet = truncate(title || "A new finance headline was published.", 110);

  const detailBullet = detail
    ? truncate(detail, 120)
    : "The available summary is short; the linked source has the full story.";

  let watchBullet = "Confirm details in the original source before acting on the headline alone.";
  if (text.includes("earnings") || text.includes("revenue") || text.includes("guidance")) {
    watchBullet = "Watch for official filings, guidance, and how related stocks react.";
  } else if (text.includes("fed") || text.includes("rate") || text.includes("inflation")) {
    watchBullet = "Watch bond yields, rate-sensitive sectors, and broad index moves.";
  } else if (text.includes("merger") || text.includes("acquisition") || text.includes("deal")) {
    watchBullet = "Watch regulatory updates and how peer companies trade.";
  }

  return [`• ${eventBullet}`, `• ${detailBullet}`, `• ${watchBullet}`].join("\n");
}

export function parseThirtySecondBullets(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean);
}

export function buildWhyItMatters(
  headline: string,
  excerpt: string,
  articleType: ReturnType<typeof inferArticleType>
): string {
  const text = combinedText(headline, excerpt).toLowerCase();

  if (!excerpt || excerpt.length < 50) {
    if (articleType === "macro") {
      return "Macro headlines can shift expectations for rates, inflation, and broad market risk appetite.";
    }
    if (articleType === "etf" || articleType === "market") {
      return "Index and market headlines can move ETF prices and portfolio returns for everyday investors.";
    }
    return "Company and sector headlines can change how investors price related stocks and funds.";
  }

  if (text.includes("fed") || text.includes("interest rate") || text.includes("cpi") || text.includes("inflation")) {
    return "Policy and inflation news can change rate expectations, which often flows through to bonds, banks, housing, and growth-stock valuations.";
  }
  if (text.includes("earnings") || text.includes("revenue") || text.includes("guidance")) {
    return "Corporate results update profit expectations and management outlook, which can move the stock and peer companies in the same industry.";
  }
  if (text.includes("tariff") || text.includes("trade") || text.includes("sanction")) {
    return "Trade-policy headlines can affect supply chains, import costs, and exporters with heavy international exposure.";
  }
  if (text.includes("merger") || text.includes("acquisition") || text.includes("takeover")) {
    return "Deal news can reprice the companies involved and set a benchmark for similar assets in the same sector.";
  }
  if (articleType === "etf" || text.includes(" s&p") || text.includes("nasdaq")) {
    return "Benchmark and ETF-related news can influence passive fund flows and how investors gauge overall market direction.";
  }
  if (articleType === "sector") {
    return "Sector-specific developments can spread to competitors, suppliers, and sector ETFs that track the same industry.";
  }

  return "The development may change how investors assess risk and opportunity in related companies and market sectors.";
}

export function buildWhoIsAffected(articleType: ReturnType<typeof inferArticleType>): string {
  switch (articleType) {
    case "macro":
      return "Bond investors, borrowers, rate-sensitive sectors such as housing and utilities, and anyone holding broad market index funds.";
    case "etf":
      return "Investors holding index and sector ETFs, plus fund managers whose performance is tied to major benchmarks.";
    case "market":
      return "Equity investors, retirement accounts with stock exposure, and active traders watching index direction.";
    case "sector":
      return "Investors concentrated in the affected industry, along with diversified funds with overlapping sector holdings.";
    default:
      return "Shareholders of the companies mentioned, industry peers, and investors in related sector funds.";
  }
}

export function buildBullCase(headline: string, excerpt: string, sentiment: Sentiment): string {
  const text = combinedText(headline, excerpt).toLowerCase();
  if (sentiment === "negative") {
    return "If conditions stabilize or the report proves less severe than feared, related assets could recover part of any initial selloff.";
  }
  if (text.includes("beat") || text.includes("growth") || text.includes("strong")) {
    return "Stronger-than-expected results or demand could support further gains if follow-up data confirms the trend.";
  }
  return "If later updates reinforce the headline, sentiment in related assets could improve.";
}

export function buildBearCase(headline: string, excerpt: string, sentiment: Sentiment): string {
  const text = combinedText(headline, excerpt).toLowerCase();
  if (sentiment === "positive") {
    return "If follow-up reports show weaker data or guidance, the initial optimism may fade and prices could give back gains.";
  }
  if (text.includes("miss") || text.includes("cut") || text.includes("warning")) {
    return "Weaker follow-through or downgraded outlooks could extend pressure on related stocks and sectors.";
  }
  return "If confirming data disappoints, risk appetite around related assets may weaken.";
}

export function buildNeutralView(): string {
  return "Headlines can move markets before the full picture is clear. Treat early reports as one input and look for confirmation in official data or company statements.";
}

export function buildEducationalSummary(headline: string, excerpt: string, query: string): string {
  void query;
  return buildFinBriefSummary(headline, excerpt);
}

/** @deprecated Use buildFinBriefSummary — kept for compatibility. */
export function buildLongSummary(headline: string, excerpt: string, query: string): string {
  void query;
  return buildFinBriefSummary(headline, excerpt);
}
