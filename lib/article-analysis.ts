import type { Brief, MarketImpact, Sentiment } from "./types";
import { isSecuritiesLegalNotice } from "./story-dedup";

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

function splitSentences(text: string): string[] {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter((sentence) => sentence.length > 12);
}

function isLimitedPreview(excerpt: string): boolean {
  const cleaned = normalizeWhitespace(excerpt);
  return (
    !cleaned ||
    cleaned.length < 80 ||
    cleaned === "No summary available from provider."
  );
}

function formatPublishedContext(publishedAt?: string): string {
  if (!publishedAt) return "";
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return "";
  return ` on ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function headlineCore(headline: string): string {
  return stripQuotes(normalizeWhitespace(headline.replace(/\.$/, "")));
}

function normalizeForCompare(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function overlapsHeadline(text: string, headline: string): boolean {
  const normalizedText = normalizeForCompare(text);
  const normalizedHeadline = normalizeForCompare(headline);
  if (!normalizedText || !normalizedHeadline) return false;
  if (normalizedText === normalizedHeadline) return true;
  const headlineStart = normalizedHeadline.slice(0, Math.min(40, normalizedHeadline.length));
  return normalizedText.startsWith(headlineStart);
}

function isNearDuplicate(candidate: string, existing: string[]): boolean {
  const normalized = normalizeForCompare(candidate);
  return existing.some((sentence) => {
    const other = normalizeForCompare(sentence);
    return other === normalized || other.includes(normalized) || normalized.includes(other);
  });
}

function cleanBullet(text: string, max = 140): string {
  let value = normalizeWhitespace(text.replace(/\.{3,}/g, "").replace(/\.\.\.$/, ""));
  if (value.length <= max) return value.endsWith(".") ? value : `${value}.`;
  value = value.slice(0, max).replace(/\s+\S*$/, "").trim();
  return value.endsWith(".") ? value : `${value}.`;
}

function formatSubjectList(subjects: string[]): string {
  if (subjects.length === 0) return "";
  if (subjects.length === 1) return subjects[0];
  if (subjects.length === 2) return `${subjects[0]} and ${subjects[1]}`;
  return `${subjects.slice(0, -1).join(", ")}, and ${subjects[subjects.length - 1]}`;
}

function extractMentionedSubjects(headline: string, excerpt: string): string[] {
  const text = `${headline} ${excerpt}`;
  const subjects = new Set<string>();
  const knownNames = [
    "Apple",
    "Microsoft",
    "NVIDIA",
    "Tesla",
    "Amazon",
    "Alphabet",
    "Google",
    "Meta",
    "Netflix",
    "Intel",
    "AMD",
    "JPMorgan",
    "Goldman Sachs",
    "Federal Reserve",
    "S&P 500",
    "Nasdaq",
  ];
  for (const name of knownNames) {
    if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) {
      subjects.add(name);
    }
  }
  const tickerMatches = text.match(/\b[A-Z]{2,5}\b/g) ?? [];
  const tickerBlocklist = new Set([
    "CEO",
    "CFO",
    "ETF",
    "GDP",
    "CPI",
    "FED",
    "USA",
    "USD",
    "AI",
    "NEW",
    "YORK",
    "LAW",
    "FIRM",
    "LLP",
    "INC",
    "LLC",
    "LTD",
    "PLC",
    "THE",
    "FOR",
    "AND",
    "PR",
    "WHY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
    "NASDAQ",
    "NYSE",
    "CLASS",
    "LEAD",
    "HAVE",
    "WITH",
    "FROM",
  ]);
  for (const ticker of tickerMatches) {
    if (!tickerBlocklist.has(ticker)) {
      subjects.add(ticker);
    }
  }
  const properNounMatches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g) ?? [];
  for (const match of properNounMatches) {
    if (!["The", "This", "That", "Read", "Watch", "Breaking", "Update"].includes(match.split(" ")[0])) {
      subjects.add(match);
    }
  }
  return [...subjects].slice(0, 4);
}

type StoryTheme =
  | "earnings"
  | "rates"
  | "trade"
  | "merger"
  | "market"
  | "regulation"
  | "product"
  | "general";

function detectThemes(text: string): StoryTheme[] {
  const lower = text.toLowerCase();
  const themes: StoryTheme[] = [];
  if (/\bearnings|revenue|profit|guidance|quarter|results\b/.test(lower)) themes.push("earnings");
  if (/\bfed|interest rate|cpi|inflation|treasury|jobs report|monetary policy\b/.test(lower)) themes.push("rates");
  if (/\btariff|trade war|sanction|import|export\b/.test(lower)) themes.push("trade");
  if (/\bmerger|acquisition|takeover|buyout|deal\b/.test(lower)) themes.push("merger");
  if (/\bstock|shares|market|index|nasdaq|s&p|wall street\b/.test(lower)) themes.push("market");
  if (/\bregulat|lawsuit|antitrust|sec\b/.test(lower)) themes.push("regulation");
  if (/\blaunch|product|platform|service|chip|software\b/.test(lower)) themes.push("product");
  if (themes.length === 0) themes.push("general");
  return themes;
}

interface ArticlePreviewContext {
  headline: string;
  excerpt: string;
  source: string;
  publishedAt?: string;
  sentences: string[];
  limited: boolean;
  subjects: string[];
  themes: StoryTheme[];
}

function stripWireDateline(text: string): string {
  return normalizeWhitespace(
    text
      .replace(/^[A-Z\s]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\s*\/PRNewswire\/\s*--\s*/i, "")
      .replace(/^Why:\s*/i, "")
  );
}

function buildArticlePreviewContext(
  headline: string,
  excerpt: string,
  source = "",
  publishedAt?: string
): ArticlePreviewContext {
  const cleanedHeadline = headlineCore(headline);
  const cleanedExcerpt = stripWireDateline(normalizeWhitespace(excerpt));
  const sentences = splitSentences(cleanedExcerpt);
  const text = combinedText(cleanedHeadline, cleanedExcerpt);
  return {
    headline: cleanedHeadline,
    excerpt: cleanedExcerpt,
    source: normalizeWhitespace(source),
    publishedAt,
    sentences,
    limited: isLimitedPreview(cleanedExcerpt),
    subjects: extractMentionedSubjects(cleanedHeadline, cleanedExcerpt),
    themes: detectThemes(text),
  };
}

function describeStoryFocus(ctx: ArticlePreviewContext): string {
  if (ctx.subjects.length > 0) {
    return `The available preview frames the story around ${formatSubjectList(ctx.subjects)} and the development described in the excerpt.`;
  }
  if (ctx.themes.includes("earnings")) {
    return "The preview appears to focus on company financial results and how the reported numbers compare with expectations.";
  }
  if (ctx.themes.includes("rates")) {
    return "The preview appears to focus on macro or policy developments that could influence borrowing costs and financial conditions.";
  }
  if (ctx.themes.includes("merger")) {
    return "The preview appears to focus on a corporate deal and how the parties involved may be repositioned.";
  }
  return "The preview suggests a business or finance development that readers can evaluate more fully in the linked source article.";
}

function pickEventSentence(ctx: ArticlePreviewContext): string {
  const candidate =
    ctx.sentences.find((sentence) => !overlapsHeadline(sentence, ctx.headline)) ??
    ctx.sentences[0];
  if (candidate && !overlapsHeadline(candidate, ctx.headline)) return candidate;
  if (ctx.sentences[0]) {
    return `The source preview describes the development as follows: ${ctx.sentences[0]}`;
  }
  return `Based on the available source preview, this story appears to cover ${ctx.headline.toLowerCase()}.`;
}

function buildWatchBullet(ctx: ArticlePreviewContext): string {
  const lower = ctx.excerpt.toLowerCase();
  if (/\bguidance|outlook|forecast|expects|expected\b/.test(lower)) {
    return "Watch whether management guidance or analyst expectations change after the full report is published.";
  }
  if (/\bquarter|results|earnings|revenue\b/.test(lower)) {
    return "Watch for the next official filing, earnings call, or follow-up report on the same topic.";
  }
  if (/\bfed|rate|inflation|cpi\b/.test(lower)) {
    return "Watch for the next policy statement, economic release, or market reaction tied to the same theme.";
  }
  if (/\bdeal|merger|acquisition|takeover\b/.test(lower)) {
    return "Watch for regulatory filings, counteroffers, or updates on whether the deal progresses.";
  }
  if (ctx.subjects.length > 0) {
    return `Watch for follow-up reporting on ${formatSubjectList(ctx.subjects)} from ${ctx.source || "the publisher"}.`;
  }
  return "Watch for follow-up reporting that adds detail beyond the current preview.";
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

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function trimSummaryToWordTarget(paragraphs: string[], maxWords: number): string {
  let body = paragraphs.map((part) => normalizeWhitespace(part)).filter(Boolean).join(" ");

  if (countWords(body) <= maxWords) return body;

  const words = body.split(/\s+/).slice(0, maxWords);
  body = words.join(" ");
  const lastPeriod = body.lastIndexOf(".");
  return lastPeriod > 0 ? body.slice(0, lastPeriod + 1) : `${body}.`;
}

function collectSourceSentences(ctx: ArticlePreviewContext): string[] {
  const collected: string[] = [];
  for (const sentence of ctx.sentences) {
    if (isNearDuplicate(sentence, collected) || overlapsHeadline(sentence, ctx.headline)) continue;
    collected.push(sentence);
  }
  return collected;
}

/** FinBrief summary: source-grounded overview (~350–450 words). */
export function buildFinBriefSummary(
  headline: string,
  excerpt: string,
  source = "",
  publishedAt?: string
): string {
  const ctx = buildArticlePreviewContext(headline, excerpt, source, publishedAt);
  const paragraphs: string[] = [];

  if (ctx.source) {
    paragraphs.push(
      `${ctx.source} published "${ctx.headline}"${formatPublishedContext(publishedAt)}.`
    );
  } else {
    paragraphs.push(`The source article is titled "${ctx.headline}"${formatPublishedContext(publishedAt)}.`);
  }

  paragraphs.push(...collectSourceSentences(ctx));

  if (ctx.subjects.length > 0) {
    const subjectSentence = ctx.sentences.find((sentence) =>
      ctx.subjects.some((subject) => sentence.toLowerCase().includes(subject.toLowerCase()))
    );
    if (subjectSentence && !paragraphs.includes(subjectSentence)) {
      paragraphs.push(subjectSentence);
    }
  }

  if (ctx.limited) {
    paragraphs.push(
      ctx.source
        ? `The ${ctx.source} preview available to FinBrief contains only the headline and excerpt shown above.`
        : "The publisher preview available to FinBrief contains only the headline and excerpt shown above."
    );
  } else if (ctx.excerpt) {
    paragraphs.push(
      ctx.source
        ? `The above passages are drawn from the ${ctx.source} preview supplied with this story.`
        : "The above passages are drawn from the publisher preview supplied with this story."
    );
  }

  if (ctx.source) {
    paragraphs.push(
      `Read the full ${ctx.source} article for complete reporting, quotes, and any data not included in the preview.`
    );
  }

  return trimSummaryToWordTarget(paragraphs, 450);
}

/** Three useful bullets: what happened, why it matters, what to watch. */
export function buildThirtySecondVersion(
  headline: string,
  excerpt: string,
  source = "",
  publishedAt?: string
): string {
  const ctx = buildArticlePreviewContext(headline, excerpt, source, publishedAt);
  const why = buildWhyItMatters(headline, excerpt, inferArticleType(combinedText(headline, excerpt)), source, publishedAt);

  const eventBullet = cleanBullet(pickEventSentence(ctx));
  const impactBullet = cleanBullet(firstSentence(why));
  const watchBullet = cleanBullet(buildWatchBullet(ctx));

  return [`• ${eventBullet}`, `• ${impactBullet}`, `• ${watchBullet}`].join("\n");
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
  articleType: ReturnType<typeof inferArticleType>,
  source = "",
  publishedAt?: string
): string {
  void articleType;
  const ctx = buildArticlePreviewContext(headline, excerpt, source, publishedAt);

  if (ctx.limited) {
    return [
      "Based on the available source preview, the full significance of this story is not yet clear from the excerpt alone.",
      ctx.subjects.length > 0
        ? `It may matter to readers following ${formatSubjectList(ctx.subjects)} once the complete article is available.`
        : "It may matter to readers tracking the topic named in the headline once the complete article is available.",
    ].join(" ");
  }

  const parts: string[] = [];
  const significanceSentence = ctx.sentences.find((sentence) =>
    /\bbecause|amid|after|could|may|expected|plan|announced|warn|cut|raise|deal|growth|decline|profit|loss\b/i.test(
      sentence
    )
  );

  if (significanceSentence && !overlapsHeadline(significanceSentence, ctx.headline)) {
    parts.push(significanceSentence);
  } else if (ctx.sentences[1] && !overlapsHeadline(ctx.sentences[1], ctx.headline)) {
    parts.push(`The preview adds that ${ctx.sentences[1].charAt(0).toLowerCase()}${ctx.sentences[1].slice(1)}`);
  }

  if (ctx.themes.includes("earnings")) {
    parts.push(
      "Earnings-related updates can change how investors judge recent business performance and near-term expectations."
    );
  } else if (ctx.themes.includes("rates")) {
    parts.push("Macro and policy updates can influence borrowing costs, bond yields, and rate-sensitive parts of the economy.");
  } else if (ctx.themes.includes("trade")) {
    parts.push("Trade-policy developments can affect companies with cross-border supply chains or overseas sales exposure.");
  } else if (ctx.themes.includes("merger")) {
    parts.push("Deal news can shift expectations for the companies involved and for similar assets in the same industry.");
  } else if (ctx.themes.includes("regulation")) {
    parts.push("Regulatory or legal developments can change compliance costs and strategic options for the parties involved.");
  } else if (ctx.themes.includes("product")) {
    parts.push("Product and strategy updates can matter when they change how a company competes or grows.");
  } else if (ctx.themes.includes("market")) {
    parts.push("Market-focused reports can matter when they change how investors interpret recent price action or index direction.");
  }

  if (ctx.subjects.length > 0 && parts.length < 4) {
    parts.push(
      `For readers following ${formatSubjectList(ctx.subjects)}, the preview offers an early look at a development reported by ${ctx.source || "the publisher"}.`
    );
  } else if (parts.length < 2) {
    parts.push(describeStoryFocus(ctx));
  }

  return parts.slice(0, 4).join(" ");
}

export function buildWhoIsAffected(
  headline: string,
  excerpt: string,
  articleType: ReturnType<typeof inferArticleType>,
  source = "",
  publishedAt?: string
): string {
  void articleType;
  const ctx = buildArticlePreviewContext(headline, excerpt, source, publishedAt);

  if (ctx.limited) {
    return [
      "Based on the available source preview, the parties most directly involved are those named in the headline.",
      ctx.subjects.length > 0
        ? `That includes ${formatSubjectList(ctx.subjects)}, although broader effects depend on details in the full article.`
        : "Broader effects depend on details that are not included in the preview.",
    ].join(" ");
  }

  const parts: string[] = [];

  if (ctx.subjects.length > 0) {
    parts.push(`The preview directly references ${formatSubjectList(ctx.subjects)}, making them the clearest audience for the update.`);
  }

  if (ctx.themes.includes("earnings") && ctx.subjects.length > 0) {
    parts.push(
      `Investors, analysts, and employees with exposure to ${formatSubjectList(ctx.subjects)} may reassess expectations after the reported update.`
    );
  } else if (ctx.themes.includes("rates")) {
    parts.push("Borrowers, savers, and institutions sensitive to interest-rate changes may feel downstream effects if the development shifts rate expectations.");
  } else if (ctx.themes.includes("trade")) {
    parts.push("Importers, exporters, and companies with international supply chains may be affected when trade-policy news changes cost or demand assumptions.");
  } else if (ctx.themes.includes("merger")) {
    parts.push("Employees, customers, and rival firms connected to the companies named in the report may be affected by deal progress or failure.");
  } else if (ctx.themes.includes("regulation")) {
    parts.push("Compliance teams, legal stakeholders, and competing firms in the same market may need to respond if the reported development changes the rules of the industry.");
  } else if (ctx.sentences[1]) {
    parts.push(`The excerpt also suggests relevance for readers tracking the same business context described by ${ctx.source || "the publisher"}.`);
  }

  if (parts.length < 2) {
    parts.push(`Readers researching the topic covered in ${ctx.source || "the source"} preview may use the story as an initial reference point.`);
  }

  return parts.slice(0, 4).join(" ");
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

export interface SecuritiesNoticeDetails {
  company: string;
  tickers: string[];
  lawFirm: string;
  actionLabel: string;
}

export function parseSecuritiesLegalNotice(headline: string, excerpt: string): SecuritiesNoticeDetails {
  const combined = `${headline} ${excerpt}`;
  const tickers = new Set<string>();

  for (const match of combined.matchAll(/\((?:NASDAQ|NYSE|AMEX):\s*([A-Z]{1,5})\)/gi)) {
    tickers.add(match[1].toUpperCase());
  }
  const deadlineTicker = headline.match(/\b([A-Z]{2,5})\s+Deadline:/i);
  if (deadlineTicker?.[1]) tickers.add(deadlineTicker[1].toUpperCase());

  let company = "";
  const companyPatterns = [
    /Lead\s+(.+?)\s+Securities/i,
    /Investors.*?Lead\s+(.+?)(?:\s+Securities|\.|$)/i,
    /(?:stock of|shares of)\s+([A-Z][A-Za-z0-9&,.\s-]{2,60}?)(?:\s+\(|\.|,|$)/i,
    /reminds\s+(?:purchasers|sellers|investors)[^,.]{0,80}?\s+([A-Z][A-Za-z0-9&,.\s-]{2,60}?)(?:\s+\(|\.|,|$)/i,
  ];
  for (const pattern of companyPatterns) {
    const match = combined.match(pattern);
    if (match?.[1]) {
      company = normalizeWhitespace(match[1].replace(/\.$/, ""));
      break;
    }
  }

  const lawFirm = /rosen\s*law/i.test(combined) ? "Rosen Law Firm" : "A law firm";
  const actionLabel = /lead plaintiff|class action|securities fraud|investor deadline/i.test(combined)
    ? "securities class action notice"
    : "investor legal notice";

  return {
    company:
      company ||
      (tickers.size > 0 ? `the company (${[...tickers].join(", ")})` : "the company named in the release"),
    tickers: [...tickers],
    lawFirm,
    actionLabel,
  };
}

function buildSecuritiesLegalSummary(
  details: SecuritiesNoticeDetails,
  source: string,
  publishedAt: string | undefined,
  headline: string,
  excerpt: string
): string {
  const tickerNote =
    details.tickers.length > 0 ? ` (${details.tickers.join(", ")})` : "";
  const ctx = buildArticlePreviewContext(headline, excerpt, source, publishedAt);
  const paragraphs = [
    `${details.lawFirm} published a ${details.actionLabel} on ${source || "a newswire"} regarding ${details.company}${tickerNote}.`,
    `"${headlineCore(headline)}"`,
    ...collectSourceSentences(ctx),
  ];

  if (ctx.source) {
    paragraphs.push(
      `The passages above come from the ${ctx.source} preview of this legal notice${formatPublishedContext(publishedAt)}.`
    );
    paragraphs.push(`Open the full ${ctx.source} release for deadline dates and eligibility details.`);
  }

  return trimSummaryToWordTarget(paragraphs, 450);
}

function buildSecuritiesLegalThirtySecond(details: SecuritiesNoticeDetails): string {
  const tickerNote = details.tickers.length > 0 ? ` (${details.tickers.join(", ")})` : "";
  return [
    `• ${details.lawFirm} advertised a ${details.actionLabel} related to ${details.company}${tickerNote}.`,
    "• These notices often follow stock price drops; they do not mean a lawsuit has already succeeded.",
    "• Check the original PRNewswire release for lead-plaintiff deadlines and whether you may be affected.",
  ].join("\n");
}

function buildSecuritiesLegalWhyItMatters(details: SecuritiesNoticeDetails): string {
  return [
    `Investors holding ${details.company}${details.tickers.length > 0 ? ` (${details.tickers.join(", ")})` : ""} may want to know about the advertised legal notice, but it is not the same as a court ruling or settlement.`,
    "Securities lawsuit notices can create headline noise without immediately changing company fundamentals.",
    "Treat this as legal marketing content until confirmed by court filings or independent reporting.",
  ].join(" ");
}

function buildSecuritiesLegalExcerpt(details: SecuritiesNoticeDetails, source: string): string {
  const tickerNote = details.tickers.length > 0 ? ` (${details.tickers.join(", ")})` : "";
  return `${details.lawFirm} issued a ${details.actionLabel} on ${source || "PRNewswire"} about ${details.company}${tickerNote}. Open the source link for the full legal notice.`;
}

/** Rewrite boilerplate legal-notice copy and refresh long-form summaries for display. */
export function enrichArticleCopy(brief: Brief): Brief {
  if (isSecuritiesLegalNotice(brief)) {
    const details = parseSecuritiesLegalNotice(brief.headline, brief.excerpt);
    return {
      ...brief,
      excerpt: buildSecuritiesLegalExcerpt(details, brief.source),
      summary: buildSecuritiesLegalSummary(
        details,
        brief.source,
        brief.publishedAt,
        brief.headline,
        brief.excerpt
      ),
      thirtySecondVersion: buildSecuritiesLegalThirtySecond(details),
      whatHappened: buildSecuritiesLegalExcerpt(details, brief.source),
      whyItMatters: buildSecuritiesLegalWhyItMatters(details),
    };
  }

  return {
    ...brief,
    summary: buildFinBriefSummary(brief.headline, brief.excerpt, brief.source, brief.publishedAt),
  };
}
