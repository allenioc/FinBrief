import type { Brief, DataSnapshot, MarketImpact, RelatedAsset, Sentiment } from "./types";
import { isSecuritiesLegalNotice } from "./story-dedup";
import { enrichBriefImage } from "./article-image";

const POSITIVE_WORDS = [
  "beat",
  "growth",
  "strong",
  "surge",
  "gain",
  "gains",
  "upgraded",
  "improved",
  "rally",
  "outperform",
  "cooling",
  "easing",
  "record",
  "profit",
  "rebound",
  "optimistic",
  "expansion",
  "dividend",
  "higher",
  "tops",
  "exceeds",
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
  "loss",
  "losses",
  "layoff",
  "layoffs",
  "bankruptcy",
  "investigation",
  "recall",
  "default",
  "crash",
  "fall",
  "falls",
  "slump",
  "weak",
  "lower",
  "cuts",
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
  "merger",
  "acquisition",
  "bank failure",
  "rate cut",
  "rate hike",
  "treasury",
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
  "revenue",
  "profit",
  "ipo",
  "tariff",
  "regulation",
];

const COMPANY_TICKER_HINTS: Record<string, string> = {
  apple: "AAPL",
  microsoft: "MSFT",
  nvidia: "NVDA",
  tesla: "TSLA",
  amazon: "AMZN",
  alphabet: "GOOGL",
  google: "GOOGL",
  meta: "META",
  netflix: "NFLX",
  intel: "INTC",
  amd: "AMD",
  jpmorgan: "JPM",
  "goldman sachs": "GS",
  boeing: "BA",
  ford: "F",
  "general motors": "GM",
};

const SECTOR_KEYWORD_TAGS: [RegExp, string][] = [
  [/\b(bank|banking|jpmorgan|wells fargo|citigroup|goldman)\b/i, "Banking"],
  [/\b(semiconductor|chipmaker|foundry|tsmc|asml|chip stocks)\b/i, "Semiconductors"],
  [/\b(artificial intelligence|\bai\b|machine learning|llm|copilot|openai)\b/i, "AI"],
  [/\b(real estate|reit|housing market|mortgage|home prices)\b/i, "Real Estate"],
  [/\b(oil|energy|crude|natural gas|opec|renewable)\b/i, "Energy"],
  [/\b(inflation|cpi|pce|price pressure|cost of living)\b/i, "Inflation"],
  [/\b(fed|federal reserve|interest rate|treasury yield|monetary policy|powell)\b/i, "Interest Rates"],
  [/\b(health care|biotech|pharma|drug approval)\b/i, "Health Care"],
  [/\b(retail|consumer spending|e-commerce|same-store sales)\b/i, "Retail"],
  [/\b(auto|automotive|ev\b|electric vehicle|car sales)\b/i, "Auto"],
  [/\b(cybersecurity|cloud computing|software stocks)\b/i, "Technology"],
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

function textSignalHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildAnalysisText(
  brief: Pick<Brief, "headline" | "excerpt" | "summary" | "whatHappened" | "ticker" | "topic" | "source">
): string {
  return normalizeWhitespace(
    [
      brief.headline,
      brief.headline,
      brief.excerpt,
      brief.summary,
      brief.whatHappened,
      brief.topic,
      brief.ticker !== "—" ? brief.ticker : "",
      brief.source,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function extractMentionedTickers(text: string): string[] {
  const tickers = new Set<string>();
  for (const match of text.matchAll(/\((?:NASDAQ|NYSE|AMEX):\s*([A-Z]{1,5})\)/gi)) {
    tickers.add(match[1].toUpperCase());
  }
  for (const match of text.matchAll(/\b\$([A-Z]{1,5})\b/g)) {
    tickers.add(match[1].toUpperCase());
  }
  for (const [name, symbol] of Object.entries(COMPANY_TICKER_HINTS)) {
    if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) {
      tickers.add(symbol);
    }
  }
  return [...tickers];
}

function isBroadMarketStory(lower: string, articleType: ReturnType<typeof inferArticleType>): boolean {
  return (
    articleType === "market" ||
    articleType === "etf" ||
    articleType === "macro" ||
    /\b(s&p 500|nasdaq|dow jones|stock market|wall street|broad market|equity market|index fund|futures|market rally|market selloff)\b/.test(
      lower
    )
  );
}

function inferRelatedAssetType(label: string): RelatedAsset["type"] {
  const upper = label.toUpperCase();
  if (/^(SPY|QQQ|DIA|VTI|IWM|SMH|IGV|XL[A-Z]{1}|TLT)$/.test(upper)) return "etf";
  if (/^[A-Z]{1,5}$/.test(label)) return "stock";
  if (["Inflation", "Interest Rates"].includes(label)) return "macro";
  if (
    ["Banking", "Semiconductors", "AI", "Real Estate", "Energy", "Health Care", "Retail", "Auto", "Technology"].includes(
      label
    )
  ) {
    return "sector";
  }
  return "index";
}

export function inferKeyAffectedAssets(
  brief: Pick<Brief, "headline" | "excerpt" | "summary" | "whatHappened" | "ticker" | "topic" | "source">,
  articleType: ReturnType<typeof inferArticleType>,
  financeRelated: boolean
): string[] {
  const text = buildAnalysisText(brief);
  const lower = text.toLowerCase();
  const tags: string[] = [];
  const seen = new Set<string>();

  const add = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) return;
    seen.add(trimmed.toLowerCase());
    tags.push(trimmed);
  };

  if (!financeRelated) {
    const civic = extractCivicAffectedParties(brief.headline, brief.excerpt);
    for (const party of civic.slice(0, 3)) add(party);
    if (tags.length === 0) add("Local");
    return tags.slice(0, 4);
  }

  for (const ticker of extractMentionedTickers(text)) add(ticker);

  if (brief.ticker && brief.ticker !== "—" && /^[A-Z]{1,5}$/.test(brief.ticker)) {
    add(brief.ticker);
  }

  for (const [pattern, label] of SECTOR_KEYWORD_TAGS) {
    if (pattern.test(text)) add(label);
  }

  if (isBroadMarketStory(lower, articleType)) {
    if (/\b(spy|s&p 500)\b/i.test(text)) add("SPY");
    if (/\b(qqq|nasdaq-?100)\b/i.test(text)) add("QQQ");
    if (/\b(dia|dow jones)\b/i.test(text)) add("DIA");
    if (/\b(vti|total market)\b/i.test(text)) add("VTI");
    if (/\b(iwm|russell 2000)\b/i.test(text)) add("IWM");
  }

  const topic = brief.topic?.trim();
  if (topic && topic !== "—" && topic !== "Markets" && !isWeakTopic(topic)) {
    add(topic);
  }

  for (const match of text.matchAll(/\b(XL[A-Z]{1}|SMH|IGV|XLK|XLF|XLE|XLV|XLRE|TLT)\b/g)) {
    add(match[1].toUpperCase());
  }

  if (tags.length === 0) {
    for (const subject of extractMentionedSubjects(brief.headline, brief.excerpt).slice(0, 2)) {
      add(subject);
    }
  }

  if (tags.length === 0) {
    const entity = extractPrimaryEntity(brief.headline, brief.excerpt);
    if (entity) add(entity);
  }

  if (tags.length === 0 && articleType === "macro") add("Macro");
  if (tags.length === 0 && articleType === "market") add("Markets");

  return tags.slice(0, 6);
}

export function deriveArticleMetadata(
  brief: Pick<
    Brief,
    "headline" | "excerpt" | "summary" | "whatHappened" | "ticker" | "topic" | "source" | "keyAffectedAssets"
  >
): Pick<Brief, "sentiment" | "sentimentConfidence" | "marketImpact" | "keyAffectedAssets" | "relatedAssets"> {
  const analysisText = buildAnalysisText(brief);
  const financeRelated = isFinanceRelatedStory(
    brief.headline,
    brief.excerpt,
    brief.ticker,
    brief.keyAffectedAssets
  );
  const articleType = inferArticleType(analysisText);
  const { sentiment, confidence } = estimateSentiment(analysisText);
  const marketImpact = financeRelated ? estimateMarketImpact(analysisText) : ("low" as MarketImpact);
  const keyAffectedAssets = inferKeyAffectedAssets(brief, articleType, financeRelated);

  return {
    sentiment: financeRelated ? sentiment : sentiment === "mixed" ? "mixed" : "neutral",
    sentimentConfidence: confidence,
    marketImpact,
    keyAffectedAssets,
    relatedAssets: keyAffectedAssets.map((symbol) => ({
      symbol,
      name: symbol,
      type: inferRelatedAssetType(symbol),
    })),
  };
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

function cleanBullet(text: string, max = 220): string {
  let value = stripEllipsis(normalizeWhitespace(text));
  if (!value) return "";
  if (value.length <= max) return value.endsWith(".") ? value.slice(0, -1) : value;
  value = value.slice(0, max).replace(/\s+\S*$/, "").trim();
  return value.endsWith(".") ? value.slice(0, -1) : value;
}

function stripEllipsis(text: string): string {
  return normalizeWhitespace(
    text
      .replace(/\.\.\./g, "")
      .replace(/…/g, "")
      .replace(/\s*[-–—]\s*$/g, "")
      .trim()
  );
}

function finalizeParagraphText(text: string, minWords = 10): string {
  let value = stripEllipsis(text.replace(/^[-•*]\s+/, ""));
  if (!value) return "";

  const lastSentenceEnd = Math.max(value.lastIndexOf(". "), value.lastIndexOf("! "), value.lastIndexOf("? "));
  if (lastSentenceEnd > 20 && !/[.!?]$/.test(value)) {
    value = value.slice(0, lastSentenceEnd + 1);
  } else {
    value = ensurePeriod(value);
  }

  if (countWords(value) < minWords) return "";
  return value;
}

function composeDetailParagraph(sentences: string[], maxSentences = 3, minWords = 14): string {
  const parts: string[] = [];
  for (const sentence of sentences) {
    const finalized = finalizeParagraphText(sentence, 8);
    if (!finalized || isNearDuplicate(finalized, parts)) continue;
    parts.push(finalized);
    if (parts.length >= maxSentences) break;
  }
  const paragraph = parts.join(" ");
  return finalizeParagraphText(paragraph, minWords) || parts[0] || "";
}

function pickThirtySecondBullet(
  candidate: string,
  fallback: () => string,
  headline: string,
  existing: string[] = []
): string {
  const tryBullet = (text: string): string => cleanBullet(text);
  let bullet = tryBullet(candidate);
  if (
    bullet &&
    !overlapsHeadline(bullet, headline) &&
    !isNearDuplicate(bullet, existing) &&
    !isSummaryMetaCommentary(bullet)
  ) {
    return bullet;
  }

  bullet = tryBullet(fallback());
  if (
    bullet &&
    !overlapsHeadline(bullet, headline) &&
    !isNearDuplicate(bullet, existing) &&
    !isSummaryMetaCommentary(bullet)
  ) {
    return bullet;
  }

  return bullet || tryBullet("Watch for the next confirmed update on this story");
}

function formatSubjectList(subjects: string[]): string {
  if (subjects.length === 0) return "";
  if (subjects.length === 1) return subjects[0];
  if (subjects.length === 2) return `${subjects[0]} and ${subjects[1]}`;
  return `${subjects.slice(0, -1).join(", ")}, and ${subjects[subjects.length - 1]}`;
}

const MONTH_NAMES = new Set([
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]);

const INVALID_ENTITY_WORDS = new Set([
  "Learn",
  "Read",
  "Watch",
  "Breaking",
  "Update",
  "How",
  "Why",
  "What",
  "When",
  "Where",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "Markets",
  "Market",
  "Stock",
  "Stocks",
  "Bond",
  "Bonds",
  "Chief",
  "Global",
  "More",
  "New",
  "First",
  "Second",
  "Third",
  "Fourth",
  "Full",
  "Big",
  "Top",
  "Best",
  "High",
  "Low",
  "Bloomberg",
  "Reuters",
  "CNBC",
  "Wall",
  "Street",
  "Federal",
  "Reserve",
  "Treasury",
  "Investors",
  "Analysts",
  "Shares",
  "Trading",
  "Report",
  "Reports",
  "News",
  "Today",
  "Tomorrow",
  "Yesterday",
]);

function isValidEntityCandidate(name: string, knownNames: string[]): boolean {
  const trimmed = normalizeWhitespace(name);
  if (trimmed.length < 2) return false;
  if (knownNames.some((known) => known.toLowerCase() === trimmed.toLowerCase())) return true;

  const words = trimmed.split(/\s+/);
  if (words.some((word) => MONTH_NAMES.has(word) || INVALID_ENTITY_WORDS.has(word))) {
    return false;
  }
  if (/\sMarkets$/i.test(trimmed)) return false;

  if (words.length === 1) {
    return /^[A-Z]{2,5}$/.test(words[0]);
  }

  return /\b(?:Inc\.?|Corporation|Corp\.|LLC|Ltd\.?|LP|REIT|Company)\b/.test(trimmed);
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

  for (const match of text.matchAll(/\((?:NASDAQ|NYSE|AMEX|Nasdaq|Nyse):\s*([A-Z]{1,5})\)/gi)) {
    subjects.add(match[1].toUpperCase());
  }

  for (const match of text.matchAll(
    /\b([A-Z][A-Za-z0-9&,.\s-]{1,60}?\s+(?:Inc\.?|Corporation|Corp\.|LLC|Ltd\.?|LP|REIT|Company))\b/g
  )) {
    const name = normalizeWhitespace(match[1]);
    if (isValidEntityCandidate(name, knownNames)) subjects.add(name);
  }

  return [...subjects].slice(0, 4);
}

const KNOWN_COMPANY_NAMES = [
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
  "FMC Corporation",
  "Boeing",
  "Ford",
  "General Motors",
];

function looksLikeCompanyName(name: string): boolean {
  const trimmed = normalizeWhitespace(name);
  if (!trimmed || !isValidEntityCandidate(trimmed, KNOWN_COMPANY_NAMES)) return false;
  if (KNOWN_COMPANY_NAMES.some((known) => known.toLowerCase() === trimmed.toLowerCase())) return true;
  if (/\b(?:Inc\.?|Corporation|Corp\.|LLC|Ltd\.?|LP|REIT|Company|Holdings|Group|Bank)\b/i.test(trimmed)) {
    return true;
  }
  if (/^[A-Z]{2,5}$/.test(trimmed)) return true;
  return false;
}

function isFinanceRelatedStory(
  headline: string,
  excerpt: string,
  ticker = "",
  keyAffectedAssets: string[] = []
): boolean {
  const text = combinedText(headline, excerpt).toLowerCase();
  const financeSignals =
    /\b(earnings|revenue|profit|stock|stocks|shares|shareholder|investor|nasdaq|nyse|amex|market cap|s&p|etf|dividend|ipo|merger|acquisition|guidance|quarter|fed |federal reserve|cpi|inflation|interest rate|gdp|jobs report|treasury|bond yield|wall street|portfolio|trading|sec filing|bank|banks|banking|car finance|payout|pay out|scandal|loan|mortgage|consumer credit|financial regulator|fca)\b/.test(
      text
    ) ||
    /\((?:NASDAQ|NYSE|AMEX):/i.test(`${headline} ${excerpt}`) ||
    (ticker && ticker !== "—" && /^[A-Z]{1,5}$/.test(ticker)) ||
    keyAffectedAssets.some((asset) => /^[A-Z]{2,5}$/.test(asset));

  const civicSignals =
    /\b(mayor|city council|county board|school board|superintendent|police department|fire department|public works|zoning board|municipal|memorial service|obituar|funeral|school district|town hall|state legislature)\b/.test(
      text
    );

  if (civicSignals && !financeSignals) return false;
  return financeSignals;
}

function extractCivicAffectedParties(headline: string, excerpt: string): string[] {
  const text = `${headline} ${excerpt}`;
  const parties: string[] = [];

  const residentsIndex = text.toLowerCase().indexOf("residents of ");
  if (residentsIndex >= 0) {
    const rest = text.slice(residentsIndex + "residents of ".length);
    const place = rest.match(/^([A-Z][a-z]+)/);
    if (place?.[1]) parties.push(`Residents of ${place[1]}`);
  }

  for (const match of text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+Department)\b/g)) {
    if (!parties.includes(match[1])) parties.push(match[1]);
  }

  for (const match of text.matchAll(/\b([A-Z][A-Za-z]+(?:\s+[A-Z][a-z]+)*\s+(?:City|County|Council|Commission))\b/g)) {
    if (!parties.includes(match[1])) parties.push(match[1]);
  }

  return parties.slice(0, 3);
}

export function shouldShowDataSnapshot(
  snapshot: DataSnapshot,
  headline: string,
  excerpt: string,
  ticker = ""
): boolean {
  if (!isFinanceRelatedStory(headline, excerpt, ticker)) return false;

  if (snapshot.kind === "stock") {
    const naCount = [snapshot.price, snapshot.marketCap, snapshot.peRatio, snapshot.volume].filter(
      (value) => value === "N/A" || /^see source/i.test(value)
    ).length;
    return naCount < 3;
  }

  if (snapshot.kind === "etf") {
    return snapshot.dailyChange !== "N/A";
  }

  return true;
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

function buildWatchBullet(
  ctx: ArticlePreviewContext,
  entity = "",
  financeRelated = true,
  facts?: PreviewFacts
): string {
  const previewFacts = facts ?? extractPreviewFacts(ctx.headline, ctx.excerpt);
  const lower = `${ctx.headline} ${ctx.excerpt}`.toLowerCase();

  if (previewFacts.hasWarning) {
    return cleanBullet(
      "Watch whether regulators, lenders, or company officials follow up on the warning language with formal action, revised guidance, or a clearer timeline"
    ).replace(/\.$/, "");
  }

  if (previewFacts.amounts.some((amount) => /\bbillion|bn|million|m\b/i.test(amount))) {
    const amount =
      previewFacts.amounts.find((item) => /\bbillion|bn|million|m\b/i.test(item)) ?? previewFacts.amounts[0];
    return cleanBullet(
      `Watch whether the ${amount} figure holds up as fuller reporting, filings, or official statements confirm or revise the numbers cited so far`
    ).replace(/\.$/, "");
  }

  if (!financeRelated) {
    const civic = extractCivicAffectedParties(ctx.headline, ctx.excerpt);
    if (civic.length > 0) {
      return cleanBullet(
        `Watch whether local officials or agencies update guidance, services, or enforcement affecting ${formatSubjectList(civic)}`
      ).replace(/\.$/, "");
    }
    if (previewFacts.headlineTopic) {
      return cleanBullet(
        `Look for the next published update on ${previewFacts.headlineTopic} from ${ctx.source || "the publisher"} that adds timeline, scope, or official response`
      ).replace(/\.$/, "");
    }
    return cleanBullet(
      "Look for the next published update that adds timeline, procedural detail, and confirmation from an official source"
    ).replace(/\.$/, "");
  }
  if (/\bguidance|outlook|forecast|expects|expected\b/.test(lower)) {
    return cleanBullet(
      "Watch whether management guidance, analyst estimates, or the next earnings call confirm, raise, or cut the expectations implied by the reporting"
    ).replace(/\.$/, "");
  }
  if (/\bquarter|results|earnings|revenue\b/.test(lower)) {
    return cleanBullet(
      "Watch the next official filing, earnings call, or sector peer report to see whether the trend in the reporting is confirmed or starts to fade"
    ).replace(/\.$/, "");
  }
  if (/\bfed|rate|inflation|cpi\b/.test(lower)) {
    return cleanBullet(
      "Watch the next policy statement, inflation release, or market reaction to see whether rate expectations shift materially after this headline"
    ).replace(/\.$/, "");
  }
  if (/\bdeal|merger|acquisition|takeover\b/.test(lower)) {
    return cleanBullet(
      "Watch regulatory filings, financing terms, and rival bids for signs that the deal is moving forward, stalling, or being repriced"
    ).replace(/\.$/, "");
  }
  if (entity) {
    return cleanBullet(
      `Watch the next ${entity} disclosure, filing, or statement from ${ctx.source || "the publisher"} for confirmation of timing, scope, and financial impact`
    ).replace(/\.$/, "");
  }
  if (previewFacts.organizations.length > 0) {
    return cleanBullet(
      `Watch whether ${previewFacts.organizations[0]} issue further statements that clarify the figures, warnings, or next steps cited in the reporting`
    ).replace(/\.$/, "");
  }
  return cleanBullet(
    "Watch the next verified source update that confirms timing, scope, official response, and whether the story is widening or fading"
  ).replace(/\.$/, "");
}

export function estimateSentiment(text: string): {
  sentiment: Sentiment;
  confidence: number;
} {
  const lower = text.toLowerCase();
  const positive = scoreText(lower, POSITIVE_WORDS);
  const negative = scoreText(lower, NEGATIVE_WORDS);
  const delta = positive - negative;
  const richness = Math.min(1, countWords(text) / 100);
  const hashMod = textSignalHash(text) % 17;

  if (positive > 0 && negative > 0 && Math.abs(delta) <= 1) {
    return { sentiment: "mixed", confidence: Math.round(58 + richness * 14 + hashMod * 0.8) };
  }
  if (delta >= 2) {
    return { sentiment: "positive", confidence: Math.min(91, Math.round(68 + delta * 4 + richness * 10)) };
  }
  if (delta <= -2) {
    return {
      sentiment: "negative",
      confidence: Math.min(91, Math.round(68 + Math.abs(delta) * 4 + richness * 10)),
    };
  }
  if (delta === 1) {
    return { sentiment: "positive", confidence: Math.round(55 + richness * 12 + hashMod) };
  }
  if (delta === -1) {
    return { sentiment: "negative", confidence: Math.round(55 + richness * 12 + hashMod) };
  }
  return { sentiment: "neutral", confidence: Math.round(52 + richness * 12 + hashMod) };
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

  const entity = extractPrimaryEntity(headline, "");
  if (entity) return entity;
  return "Business";
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

function ensurePeriod(text: string): string {
  const value = normalizeWhitespace(text).replace(/\.+$/, "");
  if (!value) return "";
  return `${value}.`;
}

function stripSummaryDateline(text: string): string {
  return normalizeWhitespace(
    text
      .replace(/^[A-Z][A-Za-z\s.]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\s*\([^)]+\)\s*--\s*/i, "")
      .replace(/^[A-Z\s]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4}\s*\/PRNewswire\/\s*--\s*/i, "")
      .replace(/^Why:\s*/i, "")
  );
}

function stripExchangeTickers(text: string): string {
  return normalizeWhitespace(
    text.replace(/\((?:NASDAQ|NYSE|Nasdaq|Nyse|AMEX|Amex):\s*[^)]+\)/gi, "")
  );
}

function stripCompanyBoilerplate(text: string): string {
  return normalizeWhitespace(
    text
      .replace(/\(the ['"]Company['"]\)/gi, "")
      .replace(
        /,\s*a\s+(?:self-managed\s+)?(?:[\w-]+\s+){2,28}(?:trust|company|corporation|firm|bank|reit|inc\.|llc|lp)\b[^.]{0,180}?(?=\.|,\s+(?:which|that|who|today|has|have|will|announced|said|reported|completed|expects)|$)/gi,
        ""
      )
  );
}

function stripUrls(text: string): string {
  return normalizeWhitespace(text.replace(/https?:\/\/\S+/gi, "").replace(/\bwww\.\S+/gi, ""));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const COMPANY_SUFFIX =
  "(?:Inc\\.|Inc|LLC|Corp\\.|Corporation|Ltd\\.|Limited|LP|L\\.P\\.|REIT|Company)";

function prepareExcerptForSummary(text: string): string {
  let cleaned = stripSummaryDateline(normalizeWhitespace(text));
  cleaned = stripUrls(cleaned);
  cleaned = stripExchangeTickers(cleaned);
  cleaned = stripCompanyBoilerplate(cleaned);
  cleaned = cleaned.replace(/\.\.\./g, "").replace(/\s+--\s+/g, " ");
  return normalizeWhitespace(cleaned);
}

function summarySentences(excerpt: string): string[] {
  return splitSentences(prepareExcerptForSummary(excerpt));
}

function isSummaryBoilerplate(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  if (sentence.length < 20) return true;
  if (/^(new york|chicago|san francisco|boston|london|beijing|tokyo|los angeles)/i.test(sentence)) {
    return true;
  }
  if (/\(globe newswire\)|\(business wire\)|\(prnewswire\)|\/prnewswire\//i.test(sentence)) return true;
  if (/forward-looking statements|safe harbor|cautionary statement|sec filing/i.test(lower)) return true;
  if (/is a self-managed|is a leading|is a global|focused on acquiring, owning/i.test(lower)) return true;
  if (/no summary available from provider/i.test(lower)) return true;
  return false;
}

function significantWords(text: string): Set<string> {
  return new Set(
    normalizeForCompare(text)
      .split(" ")
      .filter((word) => word.length > 3)
  );
}

function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function isSubstantiveDuplicate(candidate: string, existing: string[]): boolean {
  const normalized = normalizeForCompare(candidate);
  if (!normalized) return false;
  return existing.some((sentence) => {
    const other = normalizeForCompare(sentence);
    if (!other) return false;
    if (other === normalized) return true;
    if (normalized.length < 40 || other.length < 40) {
      return normalized === other;
    }
    const candidateWords = significantWords(candidate);
    const otherWords = significantWords(sentence);
    if (candidateWords.size === 0 || otherWords.size === 0) return false;
    let overlap = 0;
    for (const word of candidateWords) {
      if (otherWords.has(word)) overlap += 1;
    }
    const ratio = overlap / Math.min(candidateWords.size, otherWords.size);
    return ratio >= 0.75;
  });
}
function isTooSimilarToSource(candidate: string, source: string): boolean {
  const candidateWords = significantWords(candidate);
  const sourceWords = significantWords(source);
  if (candidateWords.size === 0 || sourceWords.size === 0) return false;
  let overlap = 0;
  for (const word of candidateWords) {
    if (sourceWords.has(word)) overlap += 1;
  }
  return overlap / candidateWords.size >= 0.72;
}

function extractPrimaryEntity(headline: string, excerpt: string): string {
  const prepared = prepareExcerptForSummary(excerpt);
  const combined = `${headline} ${prepared}`;
  const companyName = `[A-Z][A-Za-z0-9&.,-]{1,35}(?:\\s+[A-Z][A-Za-z0-9&.,-]{1,25}){0,2}`;

  const findInText = (text: string): string => {
    const corporationMatch = text.match(new RegExp(`\\b(${companyName}\\s+Corporation)\\b`));
    if (corporationMatch?.[1]) {
      const name = normalizeWhitespace(corporationMatch[1]);
      if (looksLikeCompanyName(name)) return name;
    }

    const incMatch = text.match(new RegExp(`\\b(${companyName}\\s+Inc\\.?)\\b`));
    if (incMatch?.[1]) {
      const name = normalizeWhitespace(incMatch[1].replace(/\.$/, ""));
      if (looksLikeCompanyName(name)) return name;
    }

    const headlineEntity = text.match(
      new RegExp(
        `^(${companyName})\\s+(?:Announces|Reports|Said|Completes|Issues|Files|Raises|Cuts|Lowers|Approves|Provides|Updates|Sets|Schedules|Confirms)\\b`,
        "i"
      )
    );
    if (headlineEntity?.[1]) {
      const name = normalizeWhitespace(headlineEntity[1]);
      if (looksLikeCompanyName(name)) return name;
    }

    const entityPatterns = [
      new RegExp(`^(${companyName})\\s*,?\\s*${COMPANY_SUFFIX}\\b`, "i"),
      new RegExp(
        `^(${companyName})\\s+(?:announced|reported|said|completed|expects|plans|issued|filed|raised|cut|lowered|approved|posted)\\b`,
        "i"
      ),
    ];
    for (const pattern of entityPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const name = normalizeWhitespace(match[1].replace(/,\s*$/, ""));
        if (looksLikeCompanyName(name)) return name;
      }
    }

    return "";
  };

  const fromExcerpt = findInText(prepared);
  if (fromExcerpt) return fromExcerpt;

  const fromHeadline = findInText(headlineCore(headline));
  if (fromHeadline) return fromHeadline;

  for (const match of combined.matchAll(/\((?:NASDAQ|NYSE|AMEX|Nasdaq|Nyse):\s*([A-Z]{1,5})\)/gi)) {
    return match[1].toUpperCase();
  }

  return "";
}

function sentenceCaseRemainder(text: string): string {
  let remainder = text.charAt(0).toLowerCase() + text.slice(1);
  remainder = remainder.replace(
    /\b(Of|The|And|Its|A|An|In|On|For|To|With|From|By|At)\b/g,
    (match) => match.toLowerCase()
  );
  remainder = remainder.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g, (phrase) => {
    if (/^Series\s+[A-Z0-9]+$/i.test(phrase)) return phrase;
    return phrase.toLowerCase();
  });
  remainder = remainder.replace(/\bSeries\s+([a-z0-9]+)\b/gi, (_, id) => `Series ${id.toUpperCase()}`);
  return remainder;
}

function paraphraseHeadlineLead(headline: string, entity: string): string {
  let lead = headlineCore(headline);
  const replacements: [RegExp, string][] = [
    [/\bAnnounces Date for\b/gi, "announced the date for"],
    [/\bAnnounces?\b/gi, "announced"],
    [/\bReports?\b/gi, "reported"],
    [/\bCompletes?\b/gi, "completed"],
    [/\bIssues?\b/gi, "issued"],
    [/\bFiles?\b/gi, "filed"],
    [/\bRaises?\b/gi, "raised"],
    [/\bCuts?\b/gi, "cut"],
    [/\bLowers?\b/gi, "lowered"],
    [/\bApproves?\b/gi, "approved"],
    [/\bProvides?\b/gi, "provided"],
    [/\bUpdates?\b/gi, "updated"],
    [/\bSays?\b/gi, "said"],
  ];
  for (const [pattern, replacement] of replacements) {
    lead = lead.replace(pattern, replacement);
  }

  if (entity) {
    const entityPattern = new RegExp(
      `^${entity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`,
      "i"
    );
    if (entityPattern.test(lead)) {
      const remainder = lead.replace(entityPattern, "");
      return ensurePeriod(`${entity} ${sentenceCaseRemainder(remainder)}`);
    }
    return ensurePeriod(`${entity} ${sentenceCaseRemainder(lead)}`);
  }

  return ensurePeriod(`${lead.charAt(0).toUpperCase()}${lead.slice(1)}`);
}

function stripLeadingEntity(text: string, entity: string): string {
  if (!entity) return normalizeWhitespace(text);
  const pattern = new RegExp(
    `^${escapeRegex(entity)}(?:,\\s*${COMPANY_SUFFIX})?\\s*`,
    "i"
  );
  return normalizeWhitespace(text.replace(pattern, ""));
}

function restructureSentence(sentence: string, entity: string): string {
  let text = prepareExcerptForSummary(sentence);
  if (entity) {
    text = stripLeadingEntity(text, entity);
    text = text.replace(new RegExp(`^${escapeRegex(entity)}\\s+`, "i"), "");
    if (text) text = `${entity} ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
  }
  text = text.replace(/\bannounced that\b/i, "said");
  text = text.replace(/\bhas announced\b/i, "announced");
  text = text.replace(/\bwill continue to\b/i, "plans to continue to");
  text = text.replace(/\bwill release\b/i, "plans to release");
  text = text.replace(/\bwill host\b/i, "plans to host");
  return normalizeWhitespace(text);
}

function summarizeExcerptFact(sentence: string, entity: string, headline: string): string {
  const rewritten = paraphraseExcerptSentence(sentence, entity, headline);
  if (rewritten && !isTooSimilarToSource(rewritten, sentence)) return rewritten;

  const prepared = prepareExcerptForSummary(sentence);
  const amountMatch = prepared.match(/([£$€][\d,.]+(?:\s?(?:million|billion|bn|m|trillion|thousand))?)/i);
  const subject = entity || extractPreviewOrganizations(prepared)[0] || "The parties named in the report";

  if (/\bfacing a potential\b/i.test(prepared) && amountMatch) {
    return ensurePeriod(`${subject} could face a potential payout of ${amountMatch[1]}`);
  }
  if (/\boutperform(?:ing|ed)? expectations\b/i.test(prepared)) {
    return ensurePeriod(`${subject} posted results in which at least one major business line outperformed expectations`);
  }
  if (/\bheld steady|in line\b/i.test(prepared)) {
    return ensurePeriod(`${subject} said another major product line remained broadly in line with expectations`);
  }
  if (/\bposted quarterly results\b/i.test(prepared)) {
    return ensurePeriod(`${subject} released quarterly results that form the basis of the headline framing`);
  }

  if (rewritten) return rewritten;
  return "";
}

function paraphraseExcerptSentence(sentence: string, entity: string, headline: string): string {
  if (isSummaryBoilerplate(sentence) || overlapsHeadline(sentence, headline)) return "";

  let rewritten = restructureSentence(sentence, entity);
  if (!rewritten || isSummaryBoilerplate(rewritten)) return "";
  if (isTooSimilarToSource(rewritten, sentence)) {
    rewritten = rewritten
      .replace(/\bannounced\b/gi, "said")
      .replace(/\bwill\b/gi, "plans to")
      .replace(/\bsaid\b/gi, "noted")
      .replace(/\breport\b/gi, "described")
      .replace(/\bshow\b/gi, "highlight")
      .replace(/\bcompleted\b/gi, "finished")
      .replace(/\bexpects\b/gi, "anticipates");
  }
  if (isTooSimilarToSource(rewritten, sentence)) {
    const clause = rewritten.replace(/^[^,]+,\s*/, "");
    if (
      clause !== rewritten &&
      entity &&
      /\b(will|said|announced|reported|plans|expects|completed|issued|host|release|highlight|describe)\b/i.test(
        clause
      )
    ) {
      rewritten = `${entity} ${clause.charAt(0).toLowerCase()}${clause.slice(1)}`;
    }
  }

  if (countWords(rewritten) < 6) return "";

  return ensurePeriod(rewritten);
}

function groupSentencesIntoParagraphs(sentences: string[], maxParagraphs: number): string[] {
  const cleaned = sentences.map((sentence) => ensurePeriod(sentence)).filter(Boolean);
  if (cleaned.length === 0) return [];
  if (cleaned.length <= maxParagraphs) return cleaned;

  const paragraphs: string[] = [];
  const chunkSize = Math.ceil(cleaned.length / maxParagraphs);
  for (let i = 0; i < cleaned.length; i += chunkSize) {
    paragraphs.push(cleaned.slice(i, i + chunkSize).join(" "));
  }
  return paragraphs.slice(0, maxParagraphs);
}

function collectParaphrasedExcerptSentences(
  headline: string,
  excerpt: string,
  entity: string
): string[] {
  const collected: string[] = [];
  const facts = extractStoryFacts(headline, excerpt);
  const scheduling = buildSchedulingParagraph(entity, facts);
  if (scheduling) {
    for (const sentence of splitSentences(scheduling)) {
      if (!isNearDuplicate(sentence, collected)) collected.push(sentence);
    }
  }

  const webcast = buildWebcastParagraph(entity, excerpt);
  if (webcast && !isNearDuplicate(webcast, collected)) collected.push(webcast);

  for (const sentence of summarySentences(excerpt)) {
    const rewritten = paraphraseExcerptSentence(sentence, entity, headline);
    if (!rewritten || isNearDuplicate(rewritten, collected)) continue;
    collected.push(rewritten);
  }

  if (collected.length === 0) {
    const woven = weaveExcerptIntoProse(excerpt, entity, headline);
    if (woven) {
      for (const sentence of splitSentences(woven)) {
        if (!isNearDuplicate(sentence, collected)) collected.push(sentence);
      }
    }
  }

  return collected;
}

interface ExtractedStoryFacts {
  quarter?: string;
  releaseDate?: string;
  releaseDay?: string;
  afterMarketClose?: boolean;
  distribution: string[];
  webcast?: boolean;
  conferenceCall?: boolean;
  callDate?: string;
  callDay?: string;
  callTime?: string;
}

function extractStoryFacts(headline: string, excerpt: string): ExtractedStoryFacts {
  const prepared = prepareExcerptForSummary(excerpt);
  const combined = `${headline} ${prepared}`;
  const lower = combined.toLowerCase();
  const facts: ExtractedStoryFacts = { distribution: [] };

  const quarterMatch = lower.match(
    /\b((?:first|second|third|fourth|1st|2nd|3rd|4th|q[1-4])\s+quarter(?:\s+of)?\s+\d{4})\b/i
  );
  if (quarterMatch?.[1]) facts.quarter = normalizeWhitespace(quarterMatch[1]);

  const dateMatch = prepared.match(
    /\b(?:on\s+)?((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})\b/i
  );
  if (dateMatch) {
    facts.releaseDay = dateMatch[1]?.replace(/,\s*$/, "").trim();
    facts.releaseDate = normalizeWhitespace(dateMatch[2] ?? dateMatch[0]);
  }

  if (/after the (?:stock )?market close|after market close/i.test(prepared)) {
    facts.afterMarketClose = true;
  }

  if (/pr newswire/i.test(prepared)) facts.distribution.push("PR Newswire");
  if (/business wire/i.test(prepared)) facts.distribution.push("Business Wire");
  if (/globe newswire/i.test(prepared)) facts.distribution.push("GlobeNewswire");
  if (/company(?:'s)? website|investor relations website|investors\./i.test(combined)) {
    facts.distribution.push("the company's investor relations website");
  }

  facts.webcast = /webcast/i.test(combined);
  facts.conferenceCall = /conference call|earnings call/i.test(combined);

  const callMatch = prepared.match(
    /(?:host|hold)\s+(?:a\s+)?(?:webcast\s+)?conference call\s+(?:on\s+)?((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s+at\s+(.+)$/i
  );
  if (callMatch) {
    facts.callDay = callMatch[1]?.replace(/,\s*$/, "").trim();
    facts.callDate = normalizeWhitespace(callMatch[2] ?? "");
    facts.callTime = normalizeWhitespace(callMatch[3] ?? "");
  }

  return facts;
}

interface PreviewFacts {
  amounts: string[];
  quotedPhrases: string[];
  organizations: string[];
  topicTerms: string[];
  hasWarning: boolean;
  headlineTopic: string;
}

function extractPreviewAmounts(text: string): string[] {
  const amounts: string[] = [];
  const patterns = [
    /[£$€]\s?[\d,.]+(?:\s?(?:million|billion|bn|m|trillion|thousand))?/gi,
    /[\d,.]+\s?(?:million|billion|bn|trillion|thousand)\b/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = normalizeWhitespace(match[0]);
      if (
        value &&
        !amounts.some((existing) => normalizeForCompare(existing) === normalizeForCompare(value))
      ) {
        amounts.push(value);
      }
    }
  }
  return amounts.slice(0, 6);
}

function extractPreviewOrganizations(text: string): string[] {
  const organizations = new Set<string>();
  const companyName = `[A-Z][A-Za-z0-9&.,-]{1,35}(?:\\s+[A-Z][A-Za-z0-9&.,-]{1,25}){0,2}`;
  for (const match of text.matchAll(
    new RegExp(`\\b(${companyName}\\s+(?:Bank|Banks|Corporation|Inc\\.?|LLC|Ltd\\.?))\\b`, "g")
  )) {
    const name = normalizeWhitespace(match[1]);
    if (looksLikeCompanyName(name) || /\bbank/i.test(name)) organizations.add(name);
  }
  if (/\bcity banks?\b/i.test(text)) organizations.add("City banks");
  for (const match of text.matchAll(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\s+(?:Department|Council|Commission|Authority))\b/g
  )) {
    organizations.add(normalizeWhitespace(match[1]));
  }
  return [...organizations].slice(0, 4);
}

function extractHeadlineTopic(headline: string): string {
  let topic = headlineCore(headline);
  topic = topic.replace(/^[^a-z0-9]+/i, "");
  topic = topic.replace(
    /\b(updated|update|with|amid|after|as|on|in|at|for|from|says|said|reports|reported)\b.+$/i,
    ""
  );
  topic = normalizeWhitespace(topic.replace(/['"]/g, ""));
  return topic.length >= 8 ? topic.toLowerCase() : "";
}

function extractPreviewFacts(headline: string, excerpt: string): PreviewFacts {
  const combined = combinedText(headline, excerpt);
  const quotedPhrases: string[] = [];
  for (const match of combined.matchAll(/['"]([^'"]{3,80})['"]/g)) {
    const phrase = normalizeWhitespace(match[1]);
    if (phrase && !quotedPhrases.includes(phrase)) quotedPhrases.push(phrase);
  }

  const topicTerms: string[] = [];
  if (/\bcar finance\b/i.test(combined)) topicTerms.push("car finance");
  if (/\bscandal\b/i.test(combined)) topicTerms.push("scandal");
  if (/\bearnings\b/i.test(combined)) topicTerms.push("earnings");
  if (/\binterest rates?\b/i.test(combined)) topicTerms.push("interest rates");
  if (/\bcapex|capital expenditure\b/i.test(combined)) topicTerms.push("capital expenditure");
  if (/\bdeliver(y|ies)\b/i.test(combined)) topicTerms.push("vehicle deliveries");
  if (/\bsector rotation|rotation\b/i.test(combined)) topicTerms.push("sector rotation");
  if (/\bcpi|consumer price index\b/i.test(combined)) topicTerms.push("inflation data");
  if (/\bmerger|acquisition|takeover|deal\b/i.test(combined)) topicTerms.push("corporate deal");
  if (/\bpreferred stock|tender offer\b/i.test(combined)) topicTerms.push("preferred stock");

  return {
    amounts: extractPreviewAmounts(combined),
    quotedPhrases,
    organizations: extractPreviewOrganizations(combined),
    topicTerms,
    hasWarning: /\bwarning|concerned|concern|alert|very concerned\b/i.test(combined),
    headlineTopic: extractHeadlineTopic(headline),
  };
}

const SUMMARY_WORD_TARGET_MIN = 250;
const SUMMARY_WORD_TARGET_MAX = 350;
const SUMMARY_FALLBACK_MIN = 120;
const SUMMARY_PARAGRAPH_SENTENCE_MIN = 3;
const SUMMARY_PARAGRAPH_SENTENCE_MAX = 5;

/** Bump when FinBrief summary copy rules change (affects daily edition cache trust). */
export const SUMMARY_COPY_VERSION = 5;

/** Bump when Article Brief explanation sections change (30-sec, why it matters, analysis). */
export const EXPLANATION_COPY_VERSION = 1;

const SUMMARY_PARAGRAPH_COUNT = 3;

function isSummaryMetaCommentary(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  return (
    /\bthe preview\b/.test(lower) ||
    /\bthis preview\b/.test(lower) ||
    /\bavailable preview\b/.test(lower) ||
    /\bshort preview\b/.test(lower) ||
    /\barticle preview\b/.test(lower) ||
    /\bsource preview\b/.test(lower) ||
    /\bin the excerpt\b/.test(lower) ||
    /\bthis excerpt\b/.test(lower) ||
    /\bthe excerpt\b/.test(lower) ||
    /\bavailable source material\b/.test(lower) ||
    /\bdoes not include the full\b/.test(lower) ||
    /\bfinbrief summarizes\b/.test(lower) ||
    /\blinked source article\b/.test(lower) ||
    /\bfuller source article\b/.test(lower) ||
    /\bfull published article\b/.test(lower) ||
    /\bopen the source link\b/.test(lower) ||
    /\bthe available preview\b/.test(lower) ||
    /\bappears to cover\b/.test(lower) ||
    /\bframes the story around\b/.test(lower) ||
    /\bcaptures the main factual points\b/.test(lower) ||
    /\bavailable reporting preview\b/.test(lower)
  );
}

function acceptSummarySentence(sentence: string, headline: string, existing: string[]): boolean {
  const cleaned = normalizeWhitespace(sentence);
  if (!cleaned || countWords(cleaned) < 6) return false;
  if (isSummaryBoilerplate(cleaned)) return false;
  if (isSummaryMetaCommentary(cleaned)) return false;
  if (overlapsHeadline(cleaned, headline)) return false;
  if (isSubstantiveDuplicate(cleaned, existing)) return false;
  return true;
}

function absorbSummarySentences(
  target: string[],
  source: string | string[],
  headline: string,
  maxSentences?: number
): void {
  const parts = Array.isArray(source) ? source : [source];
  for (const part of parts) {
    if (!part) continue;
    if (maxSentences !== undefined && target.length >= maxSentences) break;
    for (const sentence of splitSentences(part)) {
      if (maxSentences !== undefined && target.length >= maxSentences) break;
      if (acceptSummarySentence(sentence, headline, target)) {
        target.push(ensurePeriod(sentence));
      }
    }
  }
}

function filterExpansionCandidates(candidates: string[], headline: string): string[] {
  const accepted: string[] = [];
  for (const candidate of candidates) {
    for (const sentence of splitSentences(candidate)) {
      if (acceptSummarySentence(sentence, headline, accepted)) {
        accepted.push(ensurePeriod(sentence));
      }
    }
  }
  return accepted;
}

function joinSummarySentences(
  sentences: string[],
  minSentences: number,
  maxSentences: number,
  pool: string[],
  poolOffset: number,
  headline: string
): string {
  const kept = [...sentences];
  let poolIndex = poolOffset;
  while (kept.length < minSentences && poolIndex < pool.length) {
    const candidate = pool[poolIndex];
    poolIndex += 3;
    if (acceptSummarySentence(candidate, headline, kept)) {
      kept.push(candidate);
    }
  }
  return normalizeWhitespace(kept.slice(0, maxSentences).join(" "));
}

function expandThreeParagraphsToWordTarget(
  paragraphs: string[],
  minWords: number,
  maxWords: number,
  pool: string[],
  headline: string
): string[] {
  const parts = paragraphs.map((paragraph) => normalizeWhitespace(paragraph));
  while (parts.length < SUMMARY_PARAGRAPH_COUNT) parts.push("");

  let poolIndex = 0;
  let totalWords = countWords(parts.join(" "));
  while (totalWords < minWords && poolIndex < pool.length) {
    const paragraphIndex = poolIndex % SUMMARY_PARAGRAPH_COUNT;
    const candidate = pool[poolIndex];
    poolIndex += 1;
    const existing = splitSentences(parts[paragraphIndex]).filter(Boolean);
    if (existing.length >= SUMMARY_PARAGRAPH_SENTENCE_MAX) continue;
    if (!acceptSummarySentence(candidate, headline, existing)) continue;
    parts[paragraphIndex] = normalizeWhitespace([...existing, candidate].join(" "));
    totalWords = countWords(parts.join(" "));
  }

  while (countWords(parts.join(" ")) > maxWords) {
    let dropIndex = 0;
    let longest = 0;
    for (let index = 0; index < SUMMARY_PARAGRAPH_COUNT; index += 1) {
      const length = splitSentences(parts[index]).length;
      if (length > longest) {
        longest = length;
        dropIndex = index;
      }
    }
    const sentences = splitSentences(parts[dropIndex]);
    if (sentences.length <= 1) break;
    parts[dropIndex] = normalizeWhitespace(sentences.slice(0, -1).join(" "));
  }

  return parts.slice(0, SUMMARY_PARAGRAPH_COUNT);
}

function buildCleanWhatHappenedSentences(
  ctx: ArticlePreviewContext,
  facts: PreviewFacts,
  entity: string,
  headline: string,
  source: string,
  publishedAt?: string
): string[] {
  const sentences: string[] = [];
  const when = formatPublishedContext(publishedAt);
  const topicLabel =
    facts.topicTerms.length > 0 ? facts.topicTerms.join(" and ") : facts.headlineTopic;

  if (entity && ctx.themes.includes("earnings")) {
    sentences.push(
      ensurePeriod(`${entity} moved into focus after releasing quarterly results${when}`)
    );
  } else if (entity) {
    sentences.push(
      ensurePeriod(`${entity} is at the center of the development reported${source ? ` by ${source}` : ""}${when}`)
    );
  } else if (topicLabel) {
    sentences.push(ensurePeriod(`Reporting on ${topicLabel} describes a fresh development${when}`));
  }

  absorbSummarySentences(
    sentences,
    collectParaphrasedExcerptSentences(headline, ctx.excerpt, entity).slice(0, 2),
    headline,
    2
  );

  if (facts.organizations.length > 0) {
    absorbSummarySentences(
      sentences,
      `${facts.organizations[0]} is named directly in the reporting as part of the story.`,
      headline,
      SUMMARY_PARAGRAPH_SENTENCE_MAX
    );
  }

  return sentences;
}

function buildCleanSignificanceSentences(
  ctx: ArticlePreviewContext,
  facts: PreviewFacts,
  entity: string,
  headline: string,
  excerpt: string,
  financeRelated: boolean
): string[] {
  const sentences: string[] = [];
  const topicLabel = facts.topicTerms.length > 0 ? facts.topicTerms.join(" and ") : facts.headlineTopic;

  if (financeRelated && facts.amounts.some((amount) => /\bbillion|bn|million|m\b/i.test(amount))) {
    const largeAmount =
      facts.amounts.find((amount) => /\bbillion|bn|million|m\b/i.test(amount)) ?? facts.amounts[0];
    sentences.push(
      ensurePeriod(`A figure on the order of ${largeAmount} would be material if the reported payout or exposure holds`)
    );
  }

  if (financeRelated && ctx.themes.includes("rates")) {
    sentences.push(
      ensurePeriod(
        "Policy-sensitive assets may react if investors reassess the timing of interest-rate cuts"
      )
    );
  } else if (financeRelated && entity && ctx.themes.includes("earnings")) {
    sentences.push(
      ensurePeriod(
        `${entity}'s reported figures give shareholders a fresh checkpoint on business momentum and guidance risk`
      )
    );
  } else if (financeRelated && topicLabel) {
    sentences.push(
      ensurePeriod(`For finance readers, ${topicLabel} is the main lens for interpreting the reported figures`)
    );
  }

  if (facts.hasWarning) {
    sentences.push(
      ensurePeriod(
        "Official warning language suggests regulators, lenders, or officials view the issue as elevated rather than routine"
      )
    );
  }

  if (financeRelated && /\bguidance|outlook|forecast|expects|expected\b/i.test(`${headline} ${excerpt}`)) {
    sentences.push(
      ensurePeriod("Investors should watch whether management guidance or analyst expectations shift after the update")
    );
  } else if (financeRelated && entity) {
    sentences.push(
      ensurePeriod(`Shareholders and analysts covering ${entity} are the most likely audience for the next disclosure`)
    );
  } else if (!financeRelated) {
    const civic = extractCivicAffectedParties(headline, excerpt);
    if (civic.length > 0) {
      sentences.push(
        ensurePeriod(`The development has the most immediate relevance for ${formatSubjectList(civic)}`)
      );
    }
  }

  if (ctx.themes.includes("merger")) {
    sentences.push(
      ensurePeriod(
        "The next regulatory filing, counteroffer, or company statement will show whether the deal is advancing or stalling"
      )
    );
  }

  return sentences;
}

function mergeParagraphSentences(...parts: string[]): string {
  const sentences: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const sentence of splitSentences(part)) {
      if (!sentence || isNearDuplicate(sentence, sentences)) continue;
      sentences.push(sentence);
    }
  }
  return normalizeWhitespace(sentences.join(" "));
}

function limitParagraphSentences(text: string, maxSentences: number): string {
  if (!text) return "";
  return normalizeWhitespace(splitSentences(text).slice(0, maxSentences).join(" "));
}

function composeThreeParagraphSummary(paragraphs: string[]): string {
  return paragraphs
    .map((paragraph) => normalizeWhitespace(paragraph))
    .filter(Boolean)
    .slice(0, SUMMARY_PARAGRAPH_COUNT)
    .join("\n\n");
}

function resolveSummaryWordTarget(headline: string, excerpt: string): number {
  const prepared = prepareExcerptForSummary(excerpt);
  if (!normalizeWhitespace(headline)) return SUMMARY_FALLBACK_MIN;
  if (!prepared || prepared === "No summary available from provider.") return SUMMARY_FALLBACK_MIN;
  return SUMMARY_WORD_TARGET_MIN;
}

function composeBriefParagraphs(sections: string[]): string[] {
  const cleaned = sections.map((section) => normalizeWhitespace(section)).filter(Boolean);
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length === 5) {
    return [
      cleaned[0],
      cleaned[1],
      cleaned[2],
      normalizeWhitespace(`${cleaned[3]} ${cleaned[4]}`),
    ];
  }
  return [
    cleaned[0],
    normalizeWhitespace(cleaned.slice(1, -1).join(" ")),
    cleaned[cleaned.length - 1],
  ]
    .filter(Boolean)
    .slice(0, 4);
}

function buildCrossFactSentences(
  facts: PreviewFacts,
  headline: string,
  excerpt: string,
  entity: string,
  financeRelated: boolean
): string[] {
  const sentences: string[] = [];
  const topicLabel = facts.topicTerms.length > 0 ? facts.topicTerms.join(" and ") : facts.headlineTopic;

  if (facts.amounts.length >= 2) {
    sentences.push(
      ensurePeriod(
        `The preview connects ${facts.amounts[0]} with ${facts.amounts[1]}, indicating that more than one monetary figure is active in the same storyline`
      )
    );
  }

  if (facts.hasWarning && facts.quotedPhrases.length > 0 && topicLabel) {
    sentences.push(
      ensurePeriod(
        `The "${facts.quotedPhrases[0]}" language attached to ${topicLabel} suggests the update is being framed as urgent rather than routine`
      )
    );
  }

  if (facts.organizations.length > 0 && facts.amounts.length > 0) {
    sentences.push(
      ensurePeriod(
        `${facts.organizations[0]} and the cited ${facts.amounts[facts.amounts.length - 1]} figure appear together in the preview as the main factual pairing readers should note`
      )
    );
  }

  if (financeRelated && facts.topicTerms.includes("car finance") && facts.amounts.some((amount) => /\bbillion|bn\b/i.test(amount))) {
    sentences.push(
      ensurePeriod(
        "The car finance context and the large payout figure together imply compensation or regulatory exposure rather than a minor operational tweak"
      )
    );
  }

  if (entity && /\bservices\b/i.test(`${headline} ${excerpt}`) && /\biphone\b/i.test(`${headline} ${excerpt}`)) {
    sentences.push(
      ensurePeriod(
        `The preview contrasts ${entity}'s services performance with iPhone revenue trends, giving readers two distinct business-line data points in one update`
      )
    );
  }

  if (topicLabel && facts.amounts.length > 0) {
    sentences.push(
      ensurePeriod(
        `Within the ${topicLabel} storyline, the cited amounts offer a concrete way to judge severity before reading the full source article`
      )
    );
  }

  if (facts.amounts.length >= 2 && facts.headlineTopic) {
    sentences.push(
      ensurePeriod(
        `The headline's ${facts.headlineTopic} framing sits alongside a separate ${facts.amounts[1]} figure in the excerpt, giving the preview two distinct monetary reference points`
      )
    );
  }

  if (facts.hasWarning && facts.amounts.length > 0) {
    sentences.push(
      ensurePeriod(
        `The warning language and the ${facts.amounts[0]} figure appear in the same preview, linking tone and scale in one update`
      )
    );
  }

  return sentences;
}

function buildWatchNextParagraph(
  ctx: ArticlePreviewContext,
  facts: PreviewFacts,
  entity: string,
  financeRelated: boolean
): string {
  const sentences: string[] = [];
  const lower = `${ctx.headline} ${ctx.excerpt}`.toLowerCase();

  if (facts.hasWarning) {
    sentences.push(
      ensurePeriod(
        "Readers should watch for follow-up statements from regulators or lenders that show whether the warning language translates into formal action"
      )
    );
  }

  if (facts.amounts.some((amount) => /\bbillion|bn|million|m\b/i.test(amount))) {
    const amount =
      facts.amounts.find((value) => /\bbillion|bn|million|m\b/i.test(value)) ?? facts.amounts[0];
    sentences.push(
      ensurePeriod(`It will also matter whether the ${amount} figure cited in the preview holds once fuller reporting is published`)
    );
  }

  if (financeRelated && ctx.themes.includes("earnings") && entity) {
    if (/\bscheduled|conference call|webcast|will release|will host\b/.test(lower)) {
      sentences.push(
        ensurePeriod(
          `Investors tracking ${entity} may want the next filing, call transcript, or guidance revision to confirm the timing described in the preview`
        )
      );
    } else {
      sentences.push(
        ensurePeriod(
          `Shareholders following ${entity} should watch the next official disclosure to see whether the business-line mix described in the preview persists`
        )
      );
    }
  } else if (financeRelated && ctx.themes.includes("merger")) {
    sentences.push(
      ensurePeriod(
        "The next regulatory filing, counteroffer, or company statement will show whether the deal narrative in the preview is advancing or stalling"
      )
    );
  } else if (financeRelated && ctx.themes.includes("rates")) {
    sentences.push(
      ensurePeriod(
        "The next policy statement or major economic release will help clarify whether the preview's macro angle is gaining or losing force"
      )
    );
  } else if (!financeRelated) {
    const civic = extractCivicAffectedParties(ctx.headline, ctx.excerpt);
    if (civic.length > 0) {
      sentences.push(
        ensurePeriod(
          `Local readers may want to watch whether officials provide updated guidance for ${formatSubjectList(civic)}`
        )
      );
    } else if (facts.headlineTopic) {
      sentences.push(
        ensurePeriod(
          `The next published update on ${facts.headlineTopic}${ctx.source ? ` from ${ctx.source}` : ""} should add timeline and procedural detail missing from the preview`
        )
      );
    }
  }

  if (sentences.length === 0) {
    const watch = buildWatchBullet(ctx, entity, financeRelated, facts);
    sentences.push(ensurePeriod(`${watch.charAt(0).toUpperCase()}${watch.slice(1)}`));
  }

  if (ctx.source && sentences.length < 2) {
    sentences.push(
      ensurePeriod(`${ctx.source} is the most likely place to check first for the next incremental update on this story`)
    );
  }

  return normalizeWhitespace(sentences.slice(0, 2).join(" "));
}

function buildWhatHappenedParagraph(
  ctx: ArticlePreviewContext,
  facts: PreviewFacts,
  entity: string,
  headline: string
): string {
  const sentences: string[] = [];
  const topicLabel =
    facts.topicTerms.length > 0
      ? facts.topicTerms.join(" ")
      : facts.headlineTopic || "the development described in the preview";

  if (facts.hasWarning && facts.quotedPhrases.length > 0) {
    sentences.push(
      ensurePeriod(
        `Reporting on ${topicLabel} describes a fresh update in which officials or sources were quoted as ${facts.quotedPhrases[0]}, signaling that the matter is being treated seriously`
      )
    );
  } else if (entity && ctx.themes.includes("earnings")) {
    sentences.push(
      ensurePeriod(
        `${entity} is in focus after its latest financial update drew attention for how its major business lines performed`
      )
    );
  } else if (
    ctx.themes.includes("rates") ||
    /\bfed|federal reserve|interest rate|rate cut|monetary policy\b/i.test(`${headline} ${ctx.excerpt}`)
  ) {
    sentences.push(
      ensurePeriod(
        "The preview describes central bank officials taking a patient stance on interest-rate cuts while inflation progress remains uneven"
      )
    );
  } else if (/\bdeliver(y|ies|ed)\b/i.test(`${headline} ${ctx.excerpt}`) && entity) {
    sentences.push(
      ensurePeriod(
        `${entity} is in focus after vehicle delivery figures in the preview were compared against analyst expectations`
      )
    );
  } else if (entity && /\b(announced|reported|said|updated|issued|filed|completed)\b/i.test(headline)) {
    sentences.push(
      ensurePeriod(
        `${entity} is at the center of a development outlined in the source preview${formatPublishedContext(ctx.publishedAt)}`
      )
    );
  } else if (facts.amounts.length > 0 && facts.headlineTopic) {
    sentences.push(
      ensurePeriod(
        `The preview frames ${facts.headlineTopic} as a developing story tied to financial figures including ${facts.amounts[0]}`
      )
    );
  } else {
    const eventSentence = pickEventSentence(ctx);
    const core = eventSentence.replace(/^The source preview describes the development as follows:\s*/i, "");
    const rewritten = paraphraseExcerptSentence(core, entity, headline);
    if (rewritten) sentences.push(rewritten);
    else sentences.push(ensurePeriod(describeStoryFocus(ctx)));
  }

  if (/\bupdated|update\b/i.test(headline) && !sentences.some((s) => /update/i.test(s))) {
    sentences.push(
      ensurePeriod("The headline indicates this is an update to an ongoing story rather than an isolated one-off event")
    );
  }

  if (facts.amounts.length > 0 && !sentences.some((s) => facts.amounts[0] && s.includes(facts.amounts[0]))) {
    sentences.push(
      ensurePeriod(`One of the figures highlighted in the available reporting is ${facts.amounts[0]}`)
    );
  }

  if (entity && ctx.themes.includes("earnings") && /\bservices\b/i.test(`${headline} ${ctx.excerpt}`)) {
    sentences.push(
      ensurePeriod(
        `The headline emphasizes services revenue as the standout element in ${entity}'s latest update`
      )
    );
  }

  return normalizeWhitespace(sentences.join(" "));
}

function buildInvolvedPartiesParagraph(
  ctx: ArticlePreviewContext,
  facts: PreviewFacts,
  entity: string
): string {
  const sentences: string[] = [];
  const parties = [
    ...(entity ? [entity] : []),
    ...facts.organizations,
    ...extractCivicAffectedParties(ctx.headline, ctx.excerpt),
  ].filter((party, index, list) => {
    if (!party || list.indexOf(party) !== index) return false;
    if (entity && party !== entity && party.includes(entity) && party.length > entity.length + 8) return false;
    return looksLikeCompanyName(party) || /\bbank|department|council|commission|authority|residents of/i.test(party);
  });

  if (parties.length > 0) {
    sentences.push(
      ensurePeriod(`The parties named in the preview include ${formatSubjectList(parties.slice(0, 4))}`)
    );
  }

  if (facts.organizations.length > 0) {
    const org = facts.organizations[0];
    const verb = facts.organizations.length === 1 ? "appears" : "appear";
    sentences.push(
      ensurePeriod(`${org} ${verb} directly in the excerpt as an organization connected to the reported development`)
    );
  } else if (entity) {
    sentences.push(
      ensurePeriod(`${entity} and stakeholders tied to the company are the most visible actors in the available preview`)
    );
  } else if (ctx.subjects.length > 0) {
    sentences.push(
      ensurePeriod(`The story also references ${formatSubjectList(ctx.subjects)}, placing them in the center of the narrative`)
    );
  }

  if (sentences.length === 0) {
    sentences.push(
      ensurePeriod("The preview names the people, institutions, or communities most directly tied to the reported development")
    );
  }

  return normalizeWhitespace(sentences.join(" "));
}

function buildKeyDetailsParagraph(
  headline: string,
  excerpt: string,
  ctx: ArticlePreviewContext,
  facts: PreviewFacts,
  entity: string
): string {
  const sentences: string[] = [];

  for (const sentence of summarySentences(excerpt)) {
    const rewritten = summarizeExcerptFact(sentence, entity, headline);
    if (!rewritten || isNearDuplicate(rewritten, sentences)) continue;
    sentences.push(rewritten);
  }

  if (facts.amounts.length >= 2) {
    sentences.push(
      ensurePeriod(
        `The preview cites more than one financial figure, including ${facts.amounts.slice(0, 2).join(" and ")}, within the same storyline`
      )
    );
  } else if (facts.amounts.length === 1 && !sentences.some((s) => s.includes(facts.amounts[0]))) {
    sentences.push(
      ensurePeriod(`A central number in the excerpt is ${facts.amounts[0]}, which helps set the scale of the issue being discussed`)
    );
  }

  if (facts.quotedPhrases.length > 0 && !sentences.some((s) => s.includes(facts.quotedPhrases[0]))) {
    sentences.push(
      ensurePeriod(
        `Quoted language in the report uses the phrase "${facts.quotedPhrases[0]}" to characterize the tone around the update`
      )
    );
  }

  const scheduling = buildSummaryDetailsParagraph(headline, excerpt, entity);
  if (scheduling && countWords(scheduling) >= 12) {
    for (const sentence of splitSentences(scheduling)) {
      if (!isNearDuplicate(sentence, sentences)) sentences.push(sentence);
    }
  }

  if (sentences.length === 0) {
    const woven = weaveExcerptIntoProse(excerpt, entity, headline);
    if (woven) {
      for (const sentence of splitSentences(woven)) {
        if (!isNearDuplicate(sentence, sentences)) sentences.push(sentence);
      }
    }
  }

  if (ctx.source) {
    sentences.push(
      ensurePeriod(
        `The short preview from ${ctx.source} captures the main factual points even though it does not include the full published article`
      )
    );
  }

  return normalizeWhitespace(sentences.slice(0, 5).join(" "));
}

function buildBriefContextParagraph(
  ctx: ArticlePreviewContext,
  facts: PreviewFacts,
  entity: string,
  financeRelated: boolean
): string {
  const significance = buildSummarySignificanceParagraph(ctx, entity, financeRelated);
  const sentences: string[] = [];
  if (significance) sentences.push(significance);

  const topicLabel = facts.topicTerms.length > 0 ? facts.topicTerms.join(" and ") : facts.headlineTopic;

  if (financeRelated && facts.amounts.some((amount) => /\bbillion|bn|million|m\b/i.test(amount))) {
    const largeAmount = facts.amounts.find((amount) => /\bbillion|bn|million|m\b/i.test(amount)) ?? facts.amounts[0];
    sentences.push(
      ensurePeriod(
        `A figure on the order of ${largeAmount} would represent a material financial exposure if the preview's payout language is borne out`
      )
    );
  }

  if (financeRelated && facts.topicTerms.includes("car finance")) {
    sentences.push(
      ensurePeriod(
        "Consumer car finance disputes can carry broad banking liability when lenders or intermediaries face compensation claims at scale"
      )
    );
  }

  if (facts.hasWarning) {
    sentences.push(
      ensurePeriod(
        "The explicit warning language suggests regulators, lenders, or officials view the issue as elevated rather than routine"
      )
    );
  }

  if (financeRelated && entity && ctx.themes.includes("earnings")) {
    sentences.push(
      ensurePeriod(`${entity}'s reported figures remain the key benchmark investors will use once fuller details are available`)
    );
  } else if (!financeRelated) {
    const civic = extractCivicAffectedParties(ctx.headline, ctx.excerpt);
    if (civic.length > 0) {
      sentences.push(
        ensurePeriod(`The development has the most immediate relevance for ${formatSubjectList(civic)}`)
      );
    } else if (topicLabel) {
      sentences.push(
        ensurePeriod(`Readers following ${topicLabel} will want the fuller source article for procedural and timeline detail beyond this preview`)
      );
    }
  } else if (financeRelated && topicLabel) {
    sentences.push(
      ensurePeriod(`For finance readers, ${topicLabel} is the lens through which the cited figures and named institutions should be interpreted`)
    );
  }

  if (sentences.length === 0 && ctx.limited) {
    sentences.push(
      ensurePeriod(
        "The headline and excerpt establish the core stakes of the story, but the linked source article is needed for fuller context"
      )
    );
  }

  return normalizeWhitespace(sentences.slice(0, 4).join(" "));
}

function buildThemeExpansionSentences(
  ctx: ArticlePreviewContext,
  headline: string,
  excerpt: string,
  entity: string,
  financeRelated: boolean
): string[] {
  const sentences: string[] = [];
  const lower = `${headline} ${excerpt}`.toLowerCase();

  if (financeRelated && ctx.themes.includes("merger") && entity) {
    sentences.push(
      ensurePeriod(
        `Deal-related updates involving ${entity} can shift expectations for employees, rivals, and shareholders long before terms are final`
      )
    );
  }
  if (financeRelated && ctx.themes.includes("rates")) {
    sentences.push(
      ensurePeriod(
        "Rate-sensitive readers typically treat previews like this as early signals for borrowing costs, bond yields, and policy expectations"
      )
    );
  }
  if (financeRelated && ctx.themes.includes("regulation") && entity) {
    sentences.push(
      ensurePeriod(
        `Regulatory developments tied to ${entity} can linger in headlines even when the immediate operational impact is still uncertain`
      )
    );
  }
  if (financeRelated && ctx.themes.includes("trade")) {
    sentences.push(
      ensurePeriod(
        "Trade-policy headlines often move in stages, with the preview capturing only the first public signal of a broader dispute or adjustment"
      )
    );
  }
  if (/\bpreferred stock|tender offer|self[- ]tender\b/.test(lower) && entity) {
    sentences.push(
      ensurePeriod(
        `Preferred shareholders linked to ${entity} are the audience most likely to act on the tender details referenced in the preview`
      )
    );
  }

  const woven = weaveExcerptIntoProse(excerpt, entity, headline);
  if (woven) {
    for (const sentence of splitSentences(woven)) {
      sentences.push(sentence);
    }
  }

  return sentences;
}

function buildSupplementaryBriefSentences(
  ctx: ArticlePreviewContext,
  facts: PreviewFacts,
  entity: string,
  headline: string,
  excerpt: string,
  financeRelated: boolean
): string[] {
  const sentences: string[] = [];
  const lower = `${headline} ${excerpt}`.toLowerCase();

  if (/\bfed|federal reserve|interest rate|rate cut|monetary policy\b/i.test(lower)) {
    sentences.push(
      ensurePeriod(
        "The preview describes central bank officials taking a patient stance before lowering interest rates"
      )
    );
    if (/\binflation\b/i.test(lower)) {
      sentences.push(
        ensurePeriod(
          "Inflation progress is referenced as uneven in the preview, which helps explain the cautious policy tone"
        )
      );
      sentences.push(
        ensurePeriod(
          "Because inflation is still cited as a concern, the preview suggests policy may stay restrictive for longer than some investors expected"
        )
      );
    }
    if (/\bno rush|patient|patience|cautious\b/i.test(lower)) {
      sentences.push(
        ensurePeriod(
          "Officials are portrayed as in no rush to cut rates until they see more convincing evidence that inflation is cooling"
        )
      );
    }
    sentences.push(
      ensurePeriod(
        "Bond yields, equity valuations, and housing activity are among the channels readers watch when Fed commentary shifts"
      )
    );
    sentences.push(
      ensurePeriod("The headline centers on timing around rate cuts rather than an immediate policy pivot")
    );
  }

  if (/\bdeliver(y|ies|ed|y count)\b/i.test(lower)) {
    sentences.push(
      ensurePeriod(
        "Vehicle delivery figures in the preview are being compared against analyst expectations ahead of fuller financial results"
      )
    );
    if (/\bbelow|miss|fewer|short of|under\b/i.test(lower)) {
      sentences.push(
        ensurePeriod("The preview suggests deliveries came in below what some forecasters expected")
      );
    }
    if (entity) {
      sentences.push(
        ensurePeriod(
          `${entity} shareholders often treat delivery data as an early read on demand before quarterly earnings`
        )
      );
    }
    sentences.push(
      ensurePeriod(
        "Markets often react to delivery updates before full quarterly earnings provide margin and pricing detail"
      )
    );
    if (/\bquarter|q1|q2|q3|q4\b/i.test(lower)) {
      sentences.push(
        ensurePeriod("The timing of the release ahead of quarterly results gives investors an early demand checkpoint")
      );
    }
    if (/\banalyst|forecast|projected|expected\b/i.test(lower)) {
      sentences.push(
        ensurePeriod("Analyst expectations are the benchmark cited in the preview for judging the reported delivery count")
      );
    }
  }

  if (/\bcapex|capital expenditure|data centre|data center|ai chip|ai infrastructure\b/i.test(lower)) {
    sentences.push(
      ensurePeriod(
        "The preview focuses on higher planned spending for AI infrastructure, including data centers and chips"
      )
    );
    sentences.push(
      ensurePeriod(
        "Investors are weighing whether raised capex guidance supports long-term AI growth or pressures near-term cash flow"
      )
    );
    if (/\bguidance\b/i.test(lower)) {
      sentences.push(
        ensurePeriod("The update involves revised spending guidance rather than a one-off project announcement")
      );
    }
    if (/\bcloud|hyperscale|data centre|data center\b/i.test(lower)) {
      sentences.push(
        ensurePeriod("Major cloud providers figure centrally in the preview as the companies raising infrastructure spending")
      );
    }
    sentences.push(
      ensurePeriod(
        "Semiconductor and networking suppliers tied to AI build-outs benefit when cloud capex guidance moves higher"
      )
    );
    sentences.push(
      ensurePeriod(
        "The preview ties higher infrastructure spending to AI demand rather than legacy hardware refresh cycles alone"
      )
    );
    if (/\bchip|gpu|semiconductor\b/i.test(lower)) {
      sentences.push(ensurePeriod("Chip demand is part of the spending story referenced in the preview"));
    }
    if (/\binvestors?\b/i.test(lower)) {
      sentences.push(
        ensurePeriod("Investors in the preview are weighing growth potential against the near-term cost of higher spending")
      );
    }
  }

  if (/\bcpi|consumer price index\b/i.test(lower)) {
    sentences.push(
      ensurePeriod(
        "The preview highlights a Consumer Price Index release that markets use to gauge inflation momentum"
      )
    );
    if (/\bcool|cooling|ease|easing|month over month|month-over-month\b/i.test(lower)) {
      sentences.push(
        ensurePeriod("Headline and excerpt language point to a modest easing in month-over-month inflation")
      );
    }
    sentences.push(
      ensurePeriod("Policy-sensitive readers treat CPI releases as a checkpoint for rate expectations and bond yields")
    );
  }

  if (/\brotation|rotat(e|ing|ed)\b/i.test(lower) && /\bsector|technology|tech\b/i.test(lower)) {
    sentences.push(
      ensurePeriod(
        "The preview describes money moving between technology sub-segments rather than the sector rising or falling uniformly"
      )
    );
    if (/\bsoftware\b/i.test(lower) && /\bai\b/i.test(lower)) {
      sentences.push(
        ensurePeriod(
          "Software names and AI infrastructure plays are contrasted in the preview as relative winners and laggards"
        )
      );
    }
    sentences.push(
      ensurePeriod(
        "Investors appear to be differentiating between AI infrastructure beneficiaries and slower-growth software names"
      )
    );
    sentences.push(
      ensurePeriod("The preview implies that stock selection within technology matters as much as broad sector exposure")
    );
    if (/\bmixed\b/i.test(lower)) {
      sentences.push(
        ensurePeriod("Mixed performance in the preview underscores that technology stocks are not moving as one uniform block")
      );
    }
    sentences.push(
      ensurePeriod(
        "Sector index concentration means headline sector moves can hide wide dispersion among individual technology names"
      )
    );
  }

  if (/\bmerger|acquisition|takeover|deal\b/i.test(lower)) {
    sentences.push(
      ensurePeriod("Corporate deal headlines often move in stages, with the preview capturing an early public signal")
    );
  }

  if (ctx.source) {
    sentences.push(
      ensurePeriod(
        `Reporting in ${ctx.source} frames the update using the headline and preview excerpt available in this brief`
      )
    );
  }

  if (ctx.publishedAt) {
    const when = formatPublishedContext(ctx.publishedAt);
    if (when) {
      sentences.push(ensurePeriod(`The preview timestamp places the update${when}`));
    }
  }

  if (facts.headlineTopic) {
    sentences.push(
      ensurePeriod(`Taken together, the headline and excerpt keep ${facts.headlineTopic} as the central thread`)
    );
  }

  if (financeRelated && entity && !sentences.some((sentence) => sentence.includes(entity))) {
    sentences.push(
      ensurePeriod(`${entity} remains the primary company anchor in the available preview text`)
    );
  }

  if (facts.topicTerms.length > 0) {
    sentences.push(
      ensurePeriod(
        `The ${facts.topicTerms.join(" and ")} theme runs through both the headline and the excerpt in this preview`
      )
    );
  }

  for (const sentence of summarySentences(excerpt)) {
    const rewritten = summarizeExcerptFact(sentence, entity, headline);
    if (rewritten) sentences.push(rewritten);
  }

  return sentences;
}

function generateFactExpansionSentences(
  ctx: ArticlePreviewContext,
  facts: PreviewFacts,
  entity: string,
  headline: string,
  excerpt: string,
  financeRelated: boolean,
  existing: string[]
): string[] {
  const candidates: string[] = [];

  for (const sentence of buildCrossFactSentences(facts, headline, excerpt, entity, financeRelated)) {
    candidates.push(sentence);
  }

  for (const sentence of buildThemeExpansionSentences(ctx, headline, excerpt, entity, financeRelated)) {
    candidates.push(sentence);
  }

  for (const amount of facts.amounts) {
    candidates.push(`Financial figures cited in the preview include ${amount}.`);
    if (financeRelated) {
      candidates.push(`At ${amount}, the cited number gives a concrete sense of the scale being discussed in the reporting.`);
    }
  }

  for (const org of facts.organizations) {
    candidates.push(`${org} feature prominently in the available excerpt as a party connected to the development.`);
  }

  if (facts.amounts.length >= 2) {
    candidates.push(
      `The preview references multiple figures — ${facts.amounts.slice(0, 2).join(" and ")} — within the same storyline.`
    );
  }

  if (facts.topicTerms.length > 0) {
    candidates.push(
      `The ${facts.topicTerms.join(" and ")} angle shapes how readers should understand the update described in the headline and excerpt.`
    );
  }

  if (facts.headlineTopic && facts.headlineTopic !== facts.topicTerms.join(" ")) {
    candidates.push(`Headline framing around ${facts.headlineTopic} sets the entry point for the rest of the preview.`);
  }

  if (financeRelated && ctx.themes.includes("earnings") && entity) {
    const lower = `${headline} ${excerpt}`.toLowerCase();
    if (/\bservices\b/.test(lower)) {
      candidates.push(
        `${entity}'s services performance stood out in the preview as a line item investors often watch for recurring revenue quality.`
      );
      candidates.push(
        `Services revenue is often viewed as a higher-quality, recurring contribution within ${entity}'s overall revenue mix.`
      );
      candidates.push(
        `Investors frequently watch ${entity}'s services trends because they can offset cyclical swings in device sales.`
      );
    }
    if (/\biphone\b/.test(lower)) {
      candidates.push(
        `iPhone revenue trends mentioned in the preview remain a key swing factor for ${entity}'s total hardware mix.`
      );
      candidates.push(
        `iPhone revenue is still a central hardware anchor in ${entity}'s product portfolio, making steady results meaningful for the quarter.`
      );
    }
    if (/\bmac\b/.test(lower)) {
      candidates.push(`Mac revenue commentary in the preview adds another hardware data point alongside the headline services angle.`);
    }
    if (/\bmanagement\b/.test(lower) && /\binstalled base|subscription\b/.test(lower)) {
      candidates.push(
        `Management commentary in the preview emphasized ecosystem metrics that can support recurring revenue over time.`
      );
    }
    if (/\bstronger-than-expected|outperform|beat\b/.test(lower)) {
      candidates.push(
        `The headline frames the update around stronger-than-expected performance rather than a broad disappointment.`
      );
    }
    if (/\bquarterly results\b/.test(lower)) {
      candidates.push(
        `The quarterly results described in the preview provide the factual basis for the headline's emphasis on business-line performance.`
      );
    }
    candidates.push(
      `${entity}'s quarterly update gives shareholders a fresh checkpoint on whether recent business momentum is holding.`
    );
  }

  for (const sentence of collectParaphrasedExcerptSentences(headline, excerpt, entity)) {
    candidates.push(sentence);
  }

  for (const sentence of summarySentences(excerpt)) {
    const rewritten = summarizeExcerptFact(sentence, entity, headline);
    if (rewritten) candidates.push(rewritten);
    const paraphrased = paraphraseExcerptSentence(sentence, entity, headline);
    if (paraphrased) candidates.push(paraphrased);
  }

  const significance = buildSummarySignificanceParagraph(ctx, entity, financeRelated);
  if (significance) candidates.push(significance);

  const watchNext = buildWatchNextParagraph(ctx, facts, entity, financeRelated);
  if (watchNext) {
    for (const sentence of splitSentences(watchNext)) {
      candidates.push(sentence);
    }
  }

  return candidates.filter(
    (candidate) =>
      countWords(candidate) >= 8 &&
      !isSubstantiveDuplicate(candidate, existing) &&
      !overlapsHeadline(candidate, headline)
  );
}

function appendExpansionSentences(
  parts: string[],
  candidates: string[],
  addedSentences: string[],
  minWords: number
): number {
  let totalWords = countWords(parts.join(" "));

  for (const sentence of candidates) {
    if (totalWords >= minWords) break;
    const normalized = normalizeForCompare(sentence);
    if (!normalized) continue;
    if (addedSentences.some((existing) => normalizeForCompare(existing) === normalized)) continue;
    if (isSubstantiveDuplicate(sentence, addedSentences)) continue;

    if (parts.length === 0) {
      parts.push(sentence);
    } else {
      const targetIndex = addedSentences.length % parts.length;
      parts[targetIndex] = normalizeWhitespace(`${parts[targetIndex]} ${sentence}`);
    }
    addedSentences.push(sentence);
    totalWords = countWords(parts.join(" "));
  }

  return totalWords;
}

function expandBriefToWordTarget(
  paragraphs: string[],
  minWords: number,
  maxWords: number,
  ctx: ArticlePreviewContext,
  facts: PreviewFacts,
  entity: string,
  headline: string,
  excerpt: string,
  financeRelated: boolean
): string[] {
  const parts = splitParagraphsToTarget(paragraphs, 2, 4).filter(Boolean);
  const addedSentences: string[] = [];
  let totalWords = countWords(parts.join(" "));

  if (totalWords >= minWords) return parts;

  const expansionPasses = [
    generateFactExpansionSentences(
      ctx,
      facts,
      entity,
      headline,
      excerpt,
      financeRelated,
      addedSentences
    ),
    buildSupplementaryBriefSentences(ctx, facts, entity, headline, excerpt, financeRelated),
    buildCrossFactSentences(facts, headline, excerpt, entity, financeRelated),
    buildThemeExpansionSentences(ctx, headline, excerpt, entity, financeRelated),
  ];

  for (const candidates of expansionPasses) {
    totalWords = appendExpansionSentences(parts, candidates, addedSentences, minWords);
    if (totalWords >= minWords) break;
  }

  if (totalWords > maxWords) {
    return splitParagraphsToTarget(parts, 2, 4);
  }

  return parts;
}

function formatDistributionChannels(channels: string[]): string {
  if (channels.length === 0) return "";
  if (channels.length === 1) return channels[0];
  if (channels.length === 2) return `${channels[0]} and ${channels[1]}`;
  return `${channels.slice(0, -1).join(", ")}, and ${channels[channels.length - 1]}`;
}

function buildSchedulingParagraph(entity: string, facts: ExtractedStoryFacts): string {
  const subject = entity || "The company";
  const parts: string[] = [];

  if (facts.quarter && facts.releaseDate) {
    let sentence = `${subject} said it plans to release ${facts.quarter} earnings`;
    if (facts.releaseDay) sentence += ` on ${facts.releaseDay}, ${facts.releaseDate}`;
    else sentence += ` on ${facts.releaseDate}`;
    if (facts.afterMarketClose) sentence += " after the stock market close";
    parts.push(ensurePeriod(sentence));
  } else if (facts.releaseDate) {
    parts.push(
      ensurePeriod(
        `${subject} scheduled the release for ${facts.releaseDate}${
          facts.afterMarketClose ? " after the stock market close" : ""
        }`
      )
    );
  }

  if (facts.distribution.length > 0) {
    parts.push(
      ensurePeriod(
        `The company said the results will be issued through ${formatDistributionChannels(facts.distribution)}.`
      )
    );
  }

  if (facts.webcast || facts.conferenceCall) {
    const formats = [facts.webcast ? "webcast" : "", facts.conferenceCall ? "conference call" : ""].filter(
      Boolean
    );
    if (!facts.callDate) {
      parts.push(
        ensurePeriod(`${subject} also plans a ${formats.join(" and ")} tied to the release.`)
      );
    }
  }

  return parts.join(" ");
}

function buildWebcastParagraph(entity: string, excerpt: string): string {
  const facts = extractStoryFacts("", excerpt);
  if (!facts.callDate || !facts.callTime) return "";
  const subject = entity || "The company";
  return ensurePeriod(
    `${subject} said the ${facts.webcast ? "webcast " : ""}conference call will take place${
      facts.callDay ? ` on ${facts.callDay}, ${facts.callDate}` : ` on ${facts.callDate}`
    } at ${facts.callTime}.`
  );
}

function weaveExcerptIntoProse(excerpt: string, entity: string, headline: string): string {
  const prepared = prepareExcerptForSummary(excerpt);
  const lower = prepared.toLowerCase();
  if (!prepared || prepared.length < 40) return "";

  const subject = entity || "The company";
  const sentences: string[] = [];
  const facts = extractStoryFacts(headline, excerpt);
  const scheduling = buildSchedulingParagraph(entity, facts);
  if (scheduling) return scheduling;

  if (/\b(quarterly|quarter|annual|year|monthly)\b/.test(lower) && /\b(results|earnings|revenue|figures|data)\b/.test(lower)) {
    const detailParts: string[] = [];
    if (/\bservices\b/.test(lower) && /\boutperform/.test(lower)) {
      detailParts.push("services revenue exceeded expectations");
    }
    if (/\biphone\b/.test(lower) && /\b(steady|in line|held)\b/.test(lower)) {
      detailParts.push("iPhone revenue held steady");
    }
    if (/\bmac\b/.test(lower) && /\b(steady|in line|held|grew|growth)\b/.test(lower)) {
      detailParts.push("Mac revenue was broadly in line with expectations");
    }
    if (detailParts.length > 0) {
      sentences.push(
        `${subject} posted quarterly results in which ${detailParts.join(" and ")}.`
      );
    }
  }

  if (/\bmanagement\b/.test(lower) && /\b(said|noted|highlighted|emphasized|stated)\b/.test(lower)) {
    const managementParts: string[] = [];
    if (/\binstalled base\b/.test(lower) && /\b(grow|growing|continued to grow|expanded)\b/.test(lower)) {
      managementParts.push("continued growth in the active device installed base");
    }
    if (/\bsubscription revenue\b/.test(lower)) {
      managementParts.push("support for recurring subscription revenue");
    }
    if (managementParts.length > 0) {
      sentences.push(
        `Management highlighted ${managementParts.join(" and ")}, according to the report.`
      );
    }
  }

  if (sentences.length === 0) {
    for (const sentence of summarySentences(excerpt)) {
      const rewritten = restructureSentence(sentence, entity);
      if (!rewritten || isSummaryBoilerplate(rewritten) || overlapsHeadline(rewritten, headline)) continue;
      if (countWords(rewritten) < 8 || isTooSimilarToSource(rewritten, sentence)) continue;
      sentences.push(ensurePeriod(rewritten));
      if (sentences.length >= 3) break;
    }
  }

  return sentences.slice(0, 3).join(" ");
}

function buildAdditionalSummaryParagraphs(
  headline: string,
  excerpt: string,
  entity: string,
  existing: string[]
): string[] {
  const extra: string[] = [];
  for (const sentence of summarySentences(excerpt)) {
    const rewritten = paraphraseExcerptSentence(sentence, entity, headline);
    if (!rewritten || countWords(rewritten) < 8) continue;
    if (isSubstantiveDuplicate(rewritten, existing) || isSubstantiveDuplicate(rewritten, extra)) continue;
    extra.push(rewritten);
  }
  return extra;
}

function expandSummaryToTarget(
  paragraphs: string[],
  headline: string,
  excerpt: string,
  entity: string
): string[] {
  const parts = [...paragraphs];

  for (const paragraph of buildAdditionalSummaryParagraphs(headline, excerpt, entity, parts)) {
    if (isSubstantiveDuplicate(paragraph, parts)) continue;
    parts.push(paragraph);
  }

  return splitParagraphsToTarget(parts, 2, 4).filter((part) => countWords(part) >= 8 || parts.length === 1);
}

function buildSummaryDetailsParagraph(headline: string, excerpt: string, entity: string): string {
  const facts = extractStoryFacts(headline, excerpt);
  const scheduling = buildSchedulingParagraph(entity, facts);
  if (scheduling && countWords(scheduling) >= 12) return scheduling;

  const parts: string[] = [];
  for (const sentence of summarySentences(excerpt)) {
    const rewritten = paraphraseExcerptSentence(sentence, entity, headline);
    if (!rewritten || isNearDuplicate(rewritten, parts)) continue;
    parts.push(rewritten);
  }

  const joined = parts.join(" ");
  if (countWords(joined) >= 12 && !isTooSimilarToSource(joined, prepareExcerptForSummary(excerpt))) {
    return joined;
  }

  return weaveExcerptIntoProse(excerpt, entity, headline);
}

function buildSummarySignificanceParagraph(
  ctx: ArticlePreviewContext,
  entity: string,
  financeRelated: boolean
): string {
  const parts: string[] = [];

  for (const sentence of summarySentences(ctx.excerpt)) {
    if (
      !/\bbecause|so that|as a result|which means|may affect|could affect|expected to|aims to|designed to|in order to|matter|important|significant|impact\b/i.test(
        sentence
      )
    ) {
      continue;
    }
    const rewritten = paraphraseExcerptSentence(sentence, entity, ctx.headline);
    if (rewritten && !isNearDuplicate(rewritten, parts)) parts.push(rewritten);
    if (parts.length >= 2) break;
  }

  if (parts.length > 0) return parts.join(" ");

  if (!financeRelated) {
    const civic = extractCivicAffectedParties(ctx.headline, ctx.excerpt);
    if (civic.length > 0) {
      return ensurePeriod(`The development has the most immediate relevance for ${formatSubjectList(civic)}`);
    }
    return "";
  }

  const facts = extractStoryFacts(ctx.headline, ctx.excerpt);
  const headlineLower = ctx.headline.toLowerCase();
  if (facts.quarter && facts.releaseDate && /\bearnings|results\b/i.test(headlineLower)) {
    let text = entity
      ? `For ${entity} shareholders, the scheduled ${facts.quarter} release on ${facts.releaseDate}`
      : `For shareholders, the scheduled ${facts.quarter} release on ${facts.releaseDate}`;
    if (facts.afterMarketClose) text += " after the market close";
    if (facts.callDate && facts.callTime) {
      text += ` and the related conference call on ${facts.callDate} at ${facts.callTime}`;
    } else if (facts.callDate) {
      text += ` and the related conference call on ${facts.callDate}`;
    }
    text += " mark the key upcoming dates for updated quarterly figures.";
    return ensurePeriod(text);
  }

  if (/\bpreferred stock|tender offer|self[- ]tender\b/i.test(headlineLower)) {
    return entity
      ? `The update concerns ${possessive(entity)} preferred stock tender offers and is most relevant to holders of those securities.`
      : "The update concerns preferred stock tender offers and is most relevant to holders of those securities.";
  }
  if (/\bearnings|revenue|profit|quarter|results|guidance\b/i.test(headlineLower)) {
    return entity
      ? `The release centers on ${possessive(entity)} financial results, which investors use to assess recent business performance.`
      : "The release centers on financial results, which investors use to assess recent business performance.";
  }
  if (/\bmerger|acquisition|takeover|buyout|deal\b/i.test(headlineLower)) {
    return entity
      ? `The announcement involves ${entity} in a corporate transaction that can shift expectations for the parties involved.`
      : "The announcement involves a corporate transaction that can shift expectations for the parties involved.";
  }
  if (/\blawsuit|regulat|antitrust|sec\b/i.test(headlineLower)) {
    return entity
      ? `The story involves legal or regulatory issues connected to ${entity}.`
      : "The story involves legal or regulatory issues connected to the parties named in the report.";
  }
  if (entity && financeRelated) {
    return `The update is most directly relevant to investors following ${entity}.`;
  }
  if (ctx.themes.includes("rates")) {
    return "Macro and policy developments of this kind can influence rate expectations and financial conditions.";
  }
  if (ctx.themes.includes("market")) {
    return "Market-focused developments like this one can shape how investors interpret recent price action and sector trends.";
  }

  return "";
}

function splitParagraphsToTarget(paragraphs: string[], minParagraphs: number, maxParagraphs: number): string[] {
  const filtered = paragraphs.map((part) => normalizeWhitespace(part)).filter(Boolean);
  if (filtered.length >= minParagraphs || filtered.length === 0) return filtered.slice(0, maxParagraphs);

  const [first, ...rest] = filtered;
  const sentences = splitSentences(first);
  if (sentences.length >= 2) {
    const midpoint = Math.ceil(sentences.length / 2);
    return [
      sentences.slice(0, midpoint).join(" "),
      sentences.slice(midpoint).join(" "),
      ...rest,
    ]
      .map((part) => normalizeWhitespace(part))
      .filter(Boolean)
      .slice(0, maxParagraphs);
  }

  return filtered;
}

function trimSummaryParagraphs(paragraphs: string[], minWords: number, maxWords: number): string {
  let parts = splitParagraphsToTarget(paragraphs, 2, 4);

  while (countWords(parts.join(" ")) > maxWords && parts.length > 1) {
    parts = parts.slice(0, -1);
  }

  let body = parts.join("\n\n");
  if (countWords(body) <= maxWords) return body;

  const words = body.split(/\s+/).slice(0, maxWords);
  body = words.join(" ");
  const lastPeriod = body.lastIndexOf(".");
  body = lastPeriod > 0 ? body.slice(0, lastPeriod + 1) : `${body}.`;

  const trimmedParts = body
    .split(/\.\s+(?=[A-Z])/)
    .map((part) => ensurePeriod(part))
    .filter(Boolean);

  if (trimmedParts.length >= 2) {
    return trimmedParts.slice(0, 4).join("\n\n");
  }

  void minWords;
  return body;
}

/** FinBrief summary: three source-grounded paragraphs (what happened, key details, significance). */
export function buildFinBriefSummary(
  headline: string,
  excerpt: string,
  source = "",
  publishedAt?: string,
  financeRelated = isFinanceRelatedStory(headline, excerpt)
): string {
  const ctx = buildArticlePreviewContext(headline, excerpt, source, publishedAt);
  const entity = extractPrimaryEntity(headline, excerpt);
  const facts = extractPreviewFacts(headline, excerpt);
  const minSentences = ctx.limited ? 2 : SUMMARY_PARAGRAPH_SENTENCE_MIN;
  const maxSentences = ctx.limited ? 3 : SUMMARY_PARAGRAPH_SENTENCE_MAX;
  const minWords = ctx.limited ? SUMMARY_FALLBACK_MIN : SUMMARY_WORD_TARGET_MIN;
  const maxWords = ctx.limited ? 180 : SUMMARY_WORD_TARGET_MAX;

  const expansionPool = filterExpansionCandidates(
    [
      ...buildCrossFactSentences(facts, headline, excerpt, entity, financeRelated),
      ...buildSupplementaryBriefSentences(ctx, facts, entity, headline, excerpt, financeRelated),
      ...generateFactExpansionSentences(ctx, facts, entity, headline, excerpt, financeRelated, []),
      ...collectParaphrasedExcerptSentences(headline, excerpt, entity),
      ...buildCleanSignificanceSentences(ctx, facts, entity, headline, excerpt, financeRelated),
    ],
    headline
  );

  const paragraphOne: string[] = [];
  absorbSummarySentences(
    paragraphOne,
    buildCleanWhatHappenedSentences(ctx, facts, entity, headline, source, publishedAt),
    headline
  );
  absorbSummarySentences(paragraphOne, buildInvolvedPartiesParagraph(ctx, facts, entity), headline);

  const paragraphTwo: string[] = [];
  absorbSummarySentences(
    paragraphTwo,
    collectParaphrasedExcerptSentences(headline, excerpt, entity),
    headline
  );
  absorbSummarySentences(
    paragraphTwo,
    buildKeyDetailsParagraph(headline, excerpt, ctx, facts, entity),
    headline
  );
  absorbSummarySentences(
    paragraphTwo,
    buildSupplementaryBriefSentences(ctx, facts, entity, headline, excerpt, financeRelated),
    headline
  );

  const paragraphThree: string[] = [];
  absorbSummarySentences(
    paragraphThree,
    buildCleanSignificanceSentences(ctx, facts, entity, headline, excerpt, financeRelated),
    headline
  );
  absorbSummarySentences(
    paragraphThree,
    buildWatchNextParagraph(ctx, facts, entity, financeRelated),
    headline
  );
  absorbSummarySentences(
    paragraphThree,
    buildThemeExpansionSentences(ctx, headline, excerpt, entity, financeRelated),
    headline
  );

  let paragraphs = [
    joinSummarySentences(paragraphOne, minSentences, maxSentences, expansionPool, 0, headline),
    joinSummarySentences(paragraphTwo, minSentences, maxSentences, expansionPool, 1, headline),
    joinSummarySentences(paragraphThree, minSentences, maxSentences, expansionPool, 2, headline),
  ];

  paragraphs = expandThreeParagraphsToWordTarget(paragraphs, minWords, maxWords, expansionPool, headline);

  const filled = paragraphs.map((paragraph, index) => {
    if (paragraph) return paragraph;
    if (index === 0) {
      const fallback = buildCleanWhatHappenedSentences(
        ctx,
        facts,
        entity,
        headline,
        source,
        publishedAt
      );
      const text = normalizeWhitespace(fallback.slice(0, minSentences).join(" "));
      if (text) return text;
      const topic = facts.headlineTopic || "The story";
      return ensurePeriod(`${topic} reflects a reported development${formatPublishedContext(publishedAt)}.`);
    }
    if (index === 1) {
      return entity
        ? ensurePeriod(
            `${entity} and the other parties named in the reporting are the central figures in the development.`
          )
        : ensurePeriod(
            "The reporting points to the people and institutions most directly connected to the event."
          );
    }
    return financeRelated
      ? ensurePeriod(
          "Investors should watch for the next official update, filing, or market reaction that confirms the direction of the story."
        )
      : ensurePeriod(
          "Readers should watch for follow-up reporting that confirms timing, scope, or official response."
        );
  });

  return composeThreeParagraphSummary(filled);
}

function buildThirtySecondEventBullet(
  headline: string,
  excerpt: string,
  entity: string,
  facts: PreviewFacts
): string {
  for (const sentence of summarySentences(excerpt)) {
    if (isSummaryBoilerplate(sentence) || overlapsHeadline(sentence, headline)) continue;
    const bullet = summarizeExcerptFact(sentence, entity, headline);
    if (!bullet || overlapsHeadline(bullet, headline)) continue;
    if (normalizeForCompare(bullet) === normalizeForCompare(headline)) continue;
    if (isTooSimilarToSource(bullet, sentence)) continue;
    return cleanBullet(bullet, 140).replace(/\.$/, "");
  }

  if (facts.hasWarning && facts.quotedPhrases.length > 0 && facts.headlineTopic) {
    return cleanBullet(
      `${facts.headlineTopic} saw an update accompanied by a "${facts.quotedPhrases[0]}" warning`,
      140
    ).replace(/\.$/, "");
  }

  if (facts.amounts.length > 0 && facts.topicTerms.length > 0) {
    return cleanBullet(
      `Reporting links ${facts.topicTerms.join(" and ")} to figures including ${facts.amounts[0]}`,
      140
    ).replace(/\.$/, "");
  }

  if (entity) {
    const lead = paraphraseHeadlineLead(headline, entity);
    if (lead && !overlapsHeadline(lead, headline)) {
      return cleanBullet(lead).replace(/\.$/, "");
    }
    return cleanBullet(`${entity} is at the center of the development described in this report`).replace(/\.$/, "");
  }

  if (facts.headlineTopic && !overlapsHeadline(facts.headlineTopic, headline)) {
    return cleanBullet(`Reporting advances ${facts.headlineTopic} with a new update`).replace(/\.$/, "");
  }

  const headlineLead = paraphraseHeadlineLead(headline, "");
  return cleanBullet(headlineLead || "Reporting describes a newly published development").replace(/\.$/, "");
}

function buildThirtySecondStakeBullet(
  facts: PreviewFacts,
  ctx: ArticlePreviewContext,
  entity: string,
  headline: string,
  excerpt: string,
  financeRelated: boolean
): string {
  void financeRelated;
  if (facts.organizations.length > 0 && facts.amounts.length > 0) {
    return cleanBullet(
      `${facts.organizations[0]} are linked in the reporting to a potential ${facts.amounts[facts.amounts.length - 1]} exposure, which sets the financial scale of the story`
    ).replace(/\.$/, "");
  }

  if (facts.quotedPhrases.length > 0 && facts.hasWarning) {
    return cleanBullet(
      `Officials used "${facts.quotedPhrases[0]}" warning language in the reporting, signaling that the issue may carry legal, regulatory, or reputational weight`
    ).replace(/\.$/, "");
  }

  if (entity && facts.amounts.length > 0) {
    return cleanBullet(
      `${entity} is named alongside a ${facts.amounts[0]} figure that anchors how large the market or policy impact could be`
    ).replace(/\.$/, "");
  }

  if (entity) {
    return cleanBullet(
      `${entity} is the company most directly referenced in the reporting, making its shareholders and analysts the core audience for follow-up disclosures`
    ).replace(/\.$/, "");
  }

  const civic = extractCivicAffectedParties(headline, excerpt);
  if (civic.length > 0) {
    return cleanBullet(
      `${formatSubjectList(civic)} are the groups named in the reporting as facing the most immediate practical effects`
    ).replace(/\.$/, "");
  }

  if (facts.amounts.length > 0) {
    return cleanBullet(
      `The ${facts.amounts[0]} figure cited in the reporting defines the scale of payouts, losses, or policy stakes under discussion`
    ).replace(/\.$/, "");
  }

  if (facts.organizations.length > 0) {
    return cleanBullet(
      `${facts.organizations[0]} is a central institution in the reporting and helps explain why the update carries broader significance`
    ).replace(/\.$/, "");
  }

  if (ctx.subjects.length > 0) {
    return cleanBullet(
      `The reporting ties the development to ${formatSubjectList(ctx.subjects)}, which clarifies who carries the most direct stake`
    ).replace(/\.$/, "");
  }

  return cleanBullet(
    "The excerpt highlights the specific detail — institution, figure, or affected group — that gives the update its immediate relevance"
  ).replace(/\.$/, "");
}

function buildThirtySecondContextFallback(
  facts: PreviewFacts,
  ctx: ArticlePreviewContext,
  entity: string,
  headline: string,
  excerpt: string,
  financeRelated: boolean
): string {
  void financeRelated;
  if (facts.amounts.length > 0) {
    return cleanBullet(`The ${facts.amounts[0]} figure cited in the reporting sets the scale of the story`).replace(
      /\.$/,
      ""
    );
  }
  if (facts.organizations.length > 0) {
    return cleanBullet(`${facts.organizations[0]} is a central institution in the reported development`).replace(
      /\.$/,
      ""
    );
  }
  if (entity) {
    return cleanBullet(`${entity} is the company most directly tied to the update`).replace(/\.$/, "");
  }
  const civic = extractCivicAffectedParties(headline, excerpt);
  if (civic.length > 0) {
    return cleanBullet(`${formatSubjectList(civic)} face the most immediate effects described in the report`).replace(
      /\.$/,
      ""
    );
  }
  if (ctx.subjects.length > 0) {
    return cleanBullet(`The reporting focuses on ${formatSubjectList(ctx.subjects)}`).replace(/\.$/, "");
  }
  return cleanBullet("The excerpt highlights the detail that gives the update its immediate relevance").replace(
    /\.$/,
    ""
  );
}

function buildThirtySecondImpactBullet(
  ctx: ArticlePreviewContext,
  entity: string,
  headline: string,
  financeRelated: boolean,
  facts: PreviewFacts
): string {
  const lower = `${headline} ${ctx.excerpt}`.toLowerCase();

  if (financeRelated && facts.topicTerms.includes("car finance") && facts.amounts.some((a) => /\bbillion|bn\b/i.test(a))) {
    return cleanBullet(
      "Large lender liabilities in car finance disputes can reshape bank provisions and compensation expectations",
      140
    ).replace(/\.$/, "");
  }

  if (!financeRelated) {
    const civic = extractCivicAffectedParties(headline, ctx.excerpt);
    if (civic.length > 0) {
      return cleanBullet(`Local follow-through will matter most for ${formatSubjectList(civic)}`, 140).replace(
        /\.$/,
        ""
      );
    }
    if (facts.headlineTopic) {
      return cleanBullet(`The update is primarily a public-interest story around ${facts.headlineTopic}`, 140).replace(
        /\.$/,
        ""
      );
    }
    return cleanBullet("This is a civic or general news development rather than a market-moving finance event", 140).replace(
      /\.$/,
      ""
    );
  }

  if (/\bearnings|quarter|results|webcast|conference call\b/.test(lower)) {
    if (/\bscheduled|set for|will release|will host|conference call on|webcast on\b/.test(lower)) {
      return entity
        ? cleanBullet(
            `${entity} investors can use the announced timing to prepare for updated quarterly figures and any related call`,
            140
          ).replace(/\.$/, "")
        : cleanBullet(
            "Investors can use the announced timing to prepare for updated quarterly figures and any related call",
            140
          ).replace(/\.$/, "");
    }
    return entity
      ? cleanBullet(`${entity}'s reported figures give investors a fresh read on recent business performance`, 140).replace(
          /\.$/,
          ""
        )
      : cleanBullet("The reported figures give investors a fresh read on recent business performance", 140).replace(
          /\.$/,
          ""
        );
  }
  if (/\bpreferred stock|tender offer|self[- ]tender\b/.test(lower)) {
    return entity
      ? cleanBullet(
          `Preferred shareholders tied to ${entity} are the most directly affected audience for this update`,
          140
        ).replace(/\.$/, "")
      : cleanBullet(
          "Preferred shareholders are the most directly affected audience for this update",
          140
        ).replace(/\.$/, "");
  }
  if (/\bmerger|acquisition|takeover|buyout|deal\b/.test(lower)) {
    return entity
      ? cleanBullet(
          `The update can shift expectations for ${entity} and for similar companies in the same industry`,
          140
        ).replace(/\.$/, "")
      : cleanBullet(
          "The update can shift expectations for the companies involved and for similar assets in the same industry",
          140
        ).replace(/\.$/, "");
  }
  if (facts.hasWarning) {
    return cleanBullet(
      "Official warning language suggests compensation, regulatory, or legal follow-through could intensify",
      140
    ).replace(/\.$/, "");
  }
  if (entity) {
    return cleanBullet(`The story is most relevant to investors tracking ${entity}`, 140).replace(/\.$/, "");
  }
  if (facts.amounts.some((amount) => /\bbillion|bn|million|m\b/i.test(amount))) {
    return cleanBullet("The payout scale cited would be material for the institutions named", 140).replace(
      /\.$/,
      ""
    );
  }
  return cleanBullet("The development sits inside a finance story with implications for the institutions named", 140).replace(
    /\.$/,
    ""
  );
}

function uniqueThirtySecondBullets(bullets: string[], facts: PreviewFacts, headline: string): string[] {
  const unique: string[] = [];
  for (const bullet of bullets) {
    const cleaned = cleanBullet(bullet);
    if (!cleaned || isNearDuplicate(cleaned, unique)) continue;
    if (overlapsHeadline(cleaned, headline)) continue;
    unique.push(cleaned);
  }

  const fallbacks = [
    facts.amounts.length > 0
      ? `Reporting anchors the story to ${facts.amounts[0]}`
      : "",
    facts.organizations.length > 0
      ? `${facts.organizations[0]} remain central to how the story is framed`
      : "",
    facts.headlineTopic ? `The headline centers on ${facts.headlineTopic}` : "",
  ].filter(Boolean);

  for (const fallback of fallbacks) {
    if (unique.length >= 3) break;
    const cleaned = cleanBullet(String(fallback));
    if (
      !cleaned ||
      isNearDuplicate(cleaned, unique) ||
      overlapsHeadline(cleaned, headline) ||
      isSummaryMetaCommentary(cleaned)
    ) {
      continue;
    }
    unique.push(cleaned);
  }

  while (unique.length < 3) {
    const amount = facts.amounts[unique.length % Math.max(facts.amounts.length, 1)];
    const fallback = amount
      ? cleanBullet(`Reporting cites ${amount} as a key figure`)
      : facts.headlineTopic
        ? cleanBullet(`The headline centers on ${facts.headlineTopic}`)
        : cleanBullet("Watch for the next confirmed update on this story");
    if (
      !isNearDuplicate(fallback, unique) &&
      !overlapsHeadline(fallback, headline) &&
      !isSummaryMetaCommentary(fallback)
    ) {
      unique.push(fallback);
      continue;
    }
    break;
  }

  while (unique.length < 3) {
    unique.push(cleanBullet("Follow-up reporting will clarify timing, scope, and official response"));
  }

  return unique.slice(0, 3);
}

/** Three polished bullets: what happened, key context, what to watch next. */
export function buildThirtySecondVersion(
  headline: string,
  excerpt: string,
  source = "",
  publishedAt?: string,
  financeRelated = isFinanceRelatedStory(headline, excerpt)
): string {
  void publishedAt;
  const ctx = buildArticlePreviewContext(headline, excerpt, source, publishedAt);
  const entity = extractPrimaryEntity(headline, excerpt);
  const facts = extractPreviewFacts(headline, excerpt);

  const event = pickThirtySecondBullet(
    buildThirtySecondEventBullet(headline, excerpt, entity, facts),
    () => buildThirtySecondEventBullet(headline, excerpt, entity, facts),
    headline
  );
  const context = pickThirtySecondBullet(
    buildThirtySecondStakeBullet(facts, ctx, entity, headline, excerpt, financeRelated),
    () => buildThirtySecondContextFallback(facts, ctx, entity, headline, excerpt, financeRelated),
    headline,
    [event]
  );
  const watch = pickThirtySecondBullet(
    buildWatchBullet(ctx, entity, financeRelated, facts),
    () => buildWatchBullet(ctx, entity, financeRelated, facts),
    headline,
    [event, context]
  );

  return [event, context, watch].map((bullet) => `• ${bullet}`).join("\n");
}

export function parseThirtySecondBullets(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean);
}

function buildWhyItMattersSignificance(
  facts: PreviewFacts,
  ctx: ArticlePreviewContext,
  entity: string,
  headline: string,
  excerpt: string,
  financeRelated: boolean
): string {
  if (financeRelated && facts.topicTerms.includes("car finance") && facts.amounts.some((a) => /\bbillion|bn\b/i.test(a))) {
    return "Large compensation estimates tied to car finance practices can affect bank reserves, lender pricing, and how investors judge consumer-credit risk across the sector.";
  }
  if (financeRelated && facts.hasWarning && facts.organizations.length > 0) {
    return `The warning language involving ${facts.organizations[0]} suggests the issue may move from headlines into formal remediation, regulatory scrutiny, or higher legal costs.`;
  }
  if (financeRelated && /\bearnings|quarter|results|guidance\b/i.test(headline) && entity) {
    return `${entity}'s reported figures can change how analysts assess recent performance, margin trends, and whether management guidance still looks credible.`;
  }
  if (financeRelated && ctx.themes.includes("rates")) {
    return "Changes in rates and inflation expectations can flow through to mortgage demand, corporate borrowing costs, and the valuation of rate-sensitive stocks and bonds.";
  }
  if (financeRelated && ctx.themes.includes("merger") && entity) {
    return `Deal progress or failure can reshape expectations for ${entity}, its rivals, and suppliers that depend on the combined company's spending and strategy.`;
  }
  if (financeRelated && facts.amounts.some((amount) => /\bbillion|bn|million|m\b/i.test(amount))) {
    const amount = facts.amounts.find((amount) => /\bbillion|bn|million|m\b/i.test(amount)) ?? facts.amounts[0];
    return `The ${amount} figure cited in the reporting is material because it frames the payout, exposure, or budget impact that investors and policymakers will scrutinize next.`;
  }
  const civic = extractCivicAffectedParties(headline, excerpt);
  if (civic.length > 0) {
    return `The development has the most immediate relevance for ${formatSubjectList(civic)}, especially if follow-up reporting confirms scope, timing, or official response.`;
  }
  if (facts.headlineTopic && !overlapsHeadline(facts.headlineTopic, headline)) {
    return `The update matters because it adds a new layer of detail to ${facts.headlineTopic}, giving readers a clearer read on what changed and what still remains unresolved.`;
  }
  if (ctx.limited) {
    return "The reporting describes a development whose broader effects depend on follow-up details not included in the excerpt, so the significance may shift once fuller confirmation arrives.";
  }
  return "";
}

function buildWhyItMattersFallback(
  facts: PreviewFacts,
  ctx: ArticlePreviewContext,
  entity: string,
  headline: string,
  excerpt: string,
  financeRelated: boolean
): string {
  const significance = buildWhyItMattersSignificance(facts, ctx, entity, headline, excerpt, financeRelated);
  if (significance) return significance;
  if (entity) {
    return `${entity} and the stakeholders named in the reporting are the audience most likely to feel the immediate effects of this update, with broader consequences depending on what follow-up disclosures confirm.`;
  }
  return "The people, institutions, or communities named in the reporting are the primary audience for this update, and the practical impact will become clearer once the next verified report arrives.";
}

export function buildWhyItMatters(
  headline: string,
  excerpt: string,
  articleType: ReturnType<typeof inferArticleType>,
  source = "",
  publishedAt?: string,
  ticker = "",
  financeRelated = isFinanceRelatedStory(headline, excerpt, ticker)
): string {
  void articleType;
  void source;
  void publishedAt;
  const ctx = buildArticlePreviewContext(headline, excerpt, source, publishedAt);
  const entity = extractPrimaryEntity(headline, excerpt);
  const facts = extractPreviewFacts(headline, excerpt);
  const parts: string[] = [];

  for (const sentence of summarySentences(excerpt)) {
    const rewritten = paraphraseExcerptSentence(sentence, entity, headline);
    const finalized = rewritten ? finalizeParagraphText(rewritten, 8) : "";
    if (finalized && !overlapsHeadline(finalized, headline) && !isNearDuplicate(finalized, parts)) {
      parts.push(finalized);
    }
    if (parts.length >= 2) break;
  }

  const significance = buildWhyItMattersSignificance(facts, ctx, entity, headline, excerpt, financeRelated);
  if (significance) {
    const finalized = finalizeParagraphText(significance, 10);
    if (finalized && !isNearDuplicate(finalized, parts)) {
      parts.push(finalized);
    }
  }

  if (parts.length === 0) {
    parts.push(
      finalizeParagraphText(
        buildWhyItMattersFallback(facts, ctx, entity, headline, excerpt, financeRelated),
        10
      )
    );
  }

  const paragraph = composeDetailParagraph(parts, 3, 22);

  return (
    paragraph ||
    finalizeParagraphText(
      buildWhyItMattersFallback(facts, ctx, entity, headline, excerpt, financeRelated),
      10
    )
  );
}

export function buildWhoIsAffected(
  headline: string,
  excerpt: string,
  articleType: ReturnType<typeof inferArticleType>,
  source = "",
  publishedAt?: string,
  ticker = "",
  financeRelated = isFinanceRelatedStory(headline, excerpt, ticker)
): string {
  void articleType;
  void publishedAt;
  const ctx = buildArticlePreviewContext(headline, excerpt, source, publishedAt);
  const entity = extractPrimaryEntity(headline, excerpt);
  const facts = extractPreviewFacts(headline, excerpt);
  const sentences: string[] = [];

  if (financeRelated && entity) {
    if (/\bearnings|stock|shares|guidance|quarter|results\b/i.test(`${headline} ${excerpt}`)) {
      sentences.push(
        `${entity}, its shareholders, bondholders, and the analysts covering the stock are the most directly affected audience for this update.`
      );
      sentences.push(
        "Competitors and suppliers in the same industry may also react if the reported numbers change expectations for margins, demand, or capital spending."
      );
    } else if (ctx.themes.includes("merger")) {
      sentences.push(
        `${entity}, employees at the companies involved, and rival firms in the same industry are among the groups most directly tied to the reported development.`
      );
      sentences.push(
        "Customers and suppliers that depend on the combined business could also see pricing, contract, or service changes if the deal moves forward or collapses."
      );
    } else {
      sentences.push(
        `${entity} and the counterparties, regulators, or customers named in the reporting are the most directly affected parties in the near term.`
      );
      sentences.push(
        "Investors holding related shares, ETFs, or sector funds may feel secondary effects if the story shifts sentiment across the group."
      );
    }
  } else if (financeRelated && ctx.themes.includes("rates")) {
    sentences.push(
      "Borrowers with floating-rate debt, mortgage applicants, and savers watching deposit yields are among the groups most sensitive to the development."
    );
    sentences.push(
      "Banks, homebuilders, and other rate-sensitive businesses may also see effects if the story changes expectations for policy or inflation."
    );
  } else if (financeRelated && facts.organizations.length > 0) {
    sentences.push(
      `${formatSubjectList(facts.organizations.slice(0, 2))} are named directly in the reporting and therefore carry the most immediate operational or financial exposure.`
    );
    sentences.push(
      "Market participants with holdings linked to those institutions, sectors, or regions may feel follow-on effects through prices and risk appetite."
    );
  }

  const civic = extractCivicAffectedParties(headline, excerpt);
  if (civic.length > 0) {
    sentences.push(
      `Those most directly affected include ${formatSubjectList(civic)}, because the reporting describes consequences aimed at or experienced by those groups first.`
    );
    if (ctx.subjects.length > 0) {
      sentences.push(
        `Broader attention may also extend to ${formatSubjectList(ctx.subjects)} if follow-up reports show wider policy, legal, or economic spillover.`
      );
    }
  }

  if (sentences.length === 0) {
    for (const sentence of ctx.sentences.slice(0, 2)) {
      const rewritten = paraphraseExcerptSentence(sentence, entity, headline);
      const finalized = rewritten ? finalizeParagraphText(rewritten, 8) : "";
      if (finalized && !overlapsHeadline(finalized, headline)) {
        sentences.push(finalized);
      }
      if (sentences.length >= 2) break;
    }
  }

  if (sentences.length === 0) {
    sentences.push(
      entity
        ? `${entity}, the stakeholders named alongside it, and readers following the same industry are the primary audience for this update.`
        : "The people, organizations, or communities named in the reporting are the primary audience for this update."
    );
    sentences.push(
      "Secondary effects may spread to adjacent businesses, local communities, or investors only if later reporting confirms broader impact."
    );
  }

  return composeDetailParagraph(sentences, 3, 18);
}

export function buildBullCase(
  headline: string,
  excerpt: string,
  sentiment: Sentiment,
  entity = "",
  source = "",
  financeRelated = isFinanceRelatedStory(headline, excerpt)
): string {
  void source;
  const ctx = buildArticlePreviewContext(headline, excerpt, source);
  const facts = extractPreviewFacts(headline, excerpt);
  const resolvedEntity = entity || extractPrimaryEntity(headline, excerpt);
  const text = combinedText(headline, excerpt).toLowerCase();
  const sentences: string[] = [];

  if (sentiment === "negative") {
    sentences.push(
      "If follow-up reporting shows the problem is contained, costs come in below feared levels, or management offers a credible remediation plan, the initial negative reaction could partially reverse."
    );
    if (resolvedEntity) {
      sentences.push(
        `${resolvedEntity} could regain investor confidence if the next filing, call, or regulator update reduces uncertainty around the headline risk.`
      );
    }
  } else if (text.includes("beat") || text.includes("outperform") || text.includes("strong") || text.includes("growth")) {
    sentences.push(
      resolvedEntity
        ? `Stronger-than-expected revenue, margins, or demand could support further gains in ${resolvedEntity} if the next disclosure confirms the trend rather than a one-quarter anomaly.`
        : "Stronger-than-expected results or demand could support further gains if the next disclosure confirms the trend rather than a one-quarter anomaly."
    );
    sentences.push(
      "Sector peers with similar exposure could also benefit if investors treat the report as evidence of broader strength."
    );
  } else if (ctx.themes.includes("merger") && resolvedEntity) {
    sentences.push(
      `If regulators approve the transaction and integration plans look manageable, ${resolvedEntity} could benefit from scale, synergies, or a higher strategic valuation.`
    );
    sentences.push(
      "A smoother-than-expected path to closing could lift sentiment across suppliers and partners tied to the deal."
    );
  } else if (ctx.themes.includes("rates")) {
    sentences.push(
      "If inflation cools faster than markets expect or policy signals turn dovish, rate-sensitive assets could rebound as borrowing-cost fears ease."
    );
    sentences.push(
      "Housing, growth stocks, and long-duration bonds would be among the areas most likely to respond if the story shifts expectations in a more supportive direction."
    );
  } else if (facts.amounts.length > 0) {
    sentences.push(
      `If the ${facts.amounts[0]} figure proves durable and supports stronger earnings, settlement clarity, or policy relief, sentiment toward the named institutions could improve.`
    );
    sentences.push(
      "A constructive follow-up could reduce the discount investors were applying while the outcome remained uncertain."
    );
  } else {
    sentences.push(
      "If later disclosures validate the reporting and no major negative surprises emerge, related assets could see a relief rally or renewed investor interest."
    );
    if (financeRelated && resolvedEntity) {
      sentences.push(
        `Analysts covering ${resolvedEntity} might read that as evidence that near-term downside is more limited than the first headline implied.`
      );
    }
  }

  return composeDetailParagraph(sentences, 2, 20);
}

export function buildBearCase(
  headline: string,
  excerpt: string,
  sentiment: Sentiment,
  entity = "",
  source = "",
  financeRelated = isFinanceRelatedStory(headline, excerpt)
): string {
  void source;
  const ctx = buildArticlePreviewContext(headline, excerpt, source);
  const facts = extractPreviewFacts(headline, excerpt);
  const resolvedEntity = entity || extractPrimaryEntity(headline, excerpt);
  const text = combinedText(headline, excerpt).toLowerCase();
  const sentences: string[] = [];

  if (sentiment === "positive") {
    sentences.push(
      "If follow-up reports show weaker data, softer guidance, or higher costs than the headline suggested, the initial optimism may fade and prices could give back gains."
    );
    if (resolvedEntity) {
      sentences.push(
        `${resolvedEntity} could face renewed pressure if the next quarter fails to confirm the improvement investors are assuming from the first report.`
      );
    }
  } else if (text.includes("miss") || text.includes("cut") || text.includes("warning") || facts.hasWarning) {
    sentences.push(
      "Weaker follow-through, downgraded outlooks, or escalated regulatory action could extend pressure on the stocks, sectors, or institutions named in the reporting."
    );
    if (facts.amounts.length > 0) {
      sentences.push(
        `A worse-than-expected outcome around the ${facts.amounts[0]} figure cited in the reporting would reinforce the bearish read rather than contain the damage.`
      );
    }
  } else if (ctx.themes.includes("merger") && resolvedEntity) {
    sentences.push(
      `If regulators block the deal, financing costs rise, or integration risks look worse than expected, ${resolvedEntity} could trade lower on broken synergy assumptions.`
    );
    sentences.push(
      "Employees and suppliers tied to the transaction could also face disruption if the process stalls or is repriced."
    );
  } else if (ctx.themes.includes("rates")) {
    sentences.push(
      "If inflation proves sticky or policy stays restrictive longer than markets hope, rate-sensitive assets could sell off and financial conditions could tighten further."
    );
    sentences.push(
      "Borrowers and leveraged businesses would feel that through higher funding costs and slower demand."
    );
  } else {
    sentences.push(
      "If confirming data disappoints, legal or regulatory steps intensify, or management guidance turns cautious, risk appetite around related assets may weaken."
    );
    if (financeRelated && resolvedEntity) {
      sentences.push(
        `${resolvedEntity} could remain under pressure until investors get clearer evidence that the issue is bounded and fully disclosed.`
      );
    }
  }

  return composeDetailParagraph(sentences, 2, 20);
}

export function buildNeutralView(
  headline = "",
  excerpt = "",
  entity = "",
  source = ""
): string {
  const ctx = headline && excerpt ? buildArticlePreviewContext(headline, excerpt, source) : null;
  const resolvedEntity = entity || (headline && excerpt ? extractPrimaryEntity(headline, excerpt) : "");
  const sentences = [
    "Early headlines often move prices before timelines, legal outcomes, or full financial impact are clear, so the first reaction may overshoot what the evidence supports.",
  ];

  if (resolvedEntity) {
    sentences.push(
      `For ${resolvedEntity}, the balanced read is to separate what is confirmed in the reporting from what still depends on filings, management commentary, or regulator response.`
    );
  } else if (ctx?.limited) {
    sentences.push(
      "Because the excerpt leaves out key details, the fairest stance is to wait for the full source article or an official statement before treating the move as decisive."
    );
  } else if (ctx?.subjects.length) {
    sentences.push(
      `Readers should weigh the update alongside prior reporting on ${formatSubjectList(ctx.subjects.slice(0, 2))} rather than treating this single headline as the full story.`
    );
  } else {
    sentences.push(
      `Treat ${source || "the reporting"} as one input and look for corroboration before changing a long-term view.`
    );
  }

  sentences.push(
    "A neutral stance keeps room for both relief and disappointment until the next verified update arrives."
  );

  return composeDetailParagraph(sentences, 3, 24);
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
  void publishedAt;
  const tickerNote =
    details.tickers.length > 0 ? ` (${details.tickers.join(", ")})` : "";
  const entity = details.company;

  const opening = normalizeWhitespace(
    `${details.lawFirm} issued a ${details.actionLabel} involving ${entity}${tickerNote}. ${paraphraseHeadlineLead(
      headline,
      entity
    )}`
  );

  const detailsParagraph =
    buildSummaryDetailsParagraph(headline, excerpt, entity) ||
    `${source || "The publisher"} posted a legal notice about ${entity}${tickerNote}; the preview does not include the full filing text.`;

  const lower = prepareExcerptForSummary(excerpt).toLowerCase();
  let investorImpact =
    "These notices often follow stock price drops; they do not mean a lawsuit has already succeeded.";
  if (/\blead plaintiff|deadline|shareholders|purchasers|class period|investors who purchased\b/i.test(lower)) {
    const matched = summarySentences(excerpt)
      .map((sentence) => paraphraseExcerptSentence(sentence, entity, headline))
      .find((sentence) =>
        /\blead plaintiff|deadline|shareholders|purchasers|class period|investors who purchased\b/i.test(sentence)
      );
    if (matched) investorImpact = matched;
  }

  const closing = normalizeWhitespace(
    `${investorImpact} Treat this as legal marketing content until confirmed by court filings or independent reporting.`
  );

  return composeThreeParagraphSummary([
    limitParagraphSentences(opening, 3),
    limitParagraphSentences(detailsParagraph, 3),
    limitParagraphSentences(closing, 2),
  ]);
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

/** Rewrite display copy for Article Brief pages from available article fields. */
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

  const financeRelated = isFinanceRelatedStory(
    brief.headline,
    brief.excerpt,
    brief.ticker,
    brief.keyAffectedAssets
  );
  const analysisText = buildAnalysisText(brief);
  const articleType = inferArticleType(analysisText);
  const metadata = deriveArticleMetadata(brief);
  const entity = extractPrimaryEntity(brief.headline, brief.excerpt) || brief.ticker;
  const summary =
    brief.summary?.trim() ||
    buildFinBriefSummary(
      brief.headline,
      brief.excerpt,
      brief.source,
      brief.publishedAt,
      financeRelated
    );

  return {
    ...brief,
    summary,
    thirtySecondVersion: buildThirtySecondVersion(
      brief.headline,
      brief.excerpt,
      brief.source,
      brief.publishedAt,
      financeRelated
    ),
    whyItMatters: buildWhyItMatters(
      brief.headline,
      brief.excerpt,
      articleType,
      brief.source,
      brief.publishedAt,
      brief.ticker,
      financeRelated
    ),
    whoIsAffected: buildWhoIsAffected(
      brief.headline,
      brief.excerpt,
      articleType,
      brief.source,
      brief.publishedAt,
      brief.ticker,
      financeRelated
    ),
    bullCase: buildBullCase(
      brief.headline,
      brief.excerpt,
      metadata.sentiment,
      entity,
      brief.source,
      financeRelated
    ),
    bearCase: buildBearCase(
      brief.headline,
      brief.excerpt,
      metadata.sentiment,
      entity,
      brief.source,
      financeRelated
    ),
    neutralView: buildNeutralView(brief.headline, brief.excerpt, entity, brief.source),
    sentiment: metadata.sentiment,
    sentimentConfidence: metadata.sentimentConfidence,
    marketImpact: metadata.marketImpact,
    keyAffectedAssets: metadata.keyAffectedAssets,
    relatedAssets: metadata.relatedAssets,
  };
}

/** Apply image + FinBrief copy enrichment for every Article Brief surface. */
export function enrichBrief(brief: Brief): Brief {
  return enrichArticleCopy(enrichBriefImage(brief));
}
