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
      "Next steps to watch include whether regulators or lenders escalate action after the warning language in the preview",
      140
    ).replace(/\.$/, "");
  }

  if (previewFacts.amounts.some((amount) => /\bbillion|bn|million|m\b/i.test(amount))) {
    return cleanBullet(
      `Track whether the ${previewFacts.amounts.find((amount) => /\bbillion|bn|million|m\b/i.test(amount)) ?? previewFacts.amounts[0]} figure holds as fuller reporting emerges`,
      140
    ).replace(/\.$/, "");
  }

  if (!financeRelated) {
    const civic = extractCivicAffectedParties(ctx.headline, ctx.excerpt);
    if (civic.length > 0) {
      return cleanBullet(`Follow whether local officials or agencies update guidance for ${formatSubjectList(civic)}`, 140).replace(
        /\.$/,
        ""
      );
    }
    if (previewFacts.headlineTopic) {
      return cleanBullet(`Look for the next published update on ${previewFacts.headlineTopic} from ${ctx.source || "the publisher"}`, 140).replace(
        /\.$/,
        ""
      );
    }
    return cleanBullet("Look for the next published update that adds timeline and procedural detail", 140).replace(/\.$/, "");
  }
  if (/\bguidance|outlook|forecast|expects|expected\b/.test(lower)) {
    return cleanBullet("Track whether management guidance or analyst expectations change after the full report is published", 140).replace(
      /\.$/,
      ""
    );
  }
  if (/\bquarter|results|earnings|revenue\b/.test(lower)) {
    return cleanBullet("Track the next official filing, earnings call, or follow-up report on the same topic", 140).replace(
      /\.$/,
      ""
    );
  }
  if (/\bfed|rate|inflation|cpi\b/.test(lower)) {
    return cleanBullet("Track the next policy statement, economic release, or market reaction tied to the same theme", 140).replace(
      /\.$/,
      ""
    );
  }
  if (/\bdeal|merger|acquisition|takeover\b/.test(lower)) {
    return cleanBullet("Track regulatory filings, counteroffers, or updates on whether the deal progresses", 140).replace(
      /\.$/,
      ""
    );
  }
  if (entity) {
    return cleanBullet(`Track the next ${entity} disclosure or statement from ${ctx.source || "the publisher"}`, 140).replace(
      /\.$/,
      ""
    );
  }
  if (previewFacts.organizations.length > 0) {
    return cleanBullet(
      `Track whether ${previewFacts.organizations[0]} issue further statements on the figures cited in the preview`,
      140
    ).replace(/\.$/, "");
  }
  return cleanBullet("Track the next source update that confirms timing, scope, or official response", 140).replace(/\.$/, "");
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
    return ensurePeriod(`${subject} could face a potential payout of ${amountMatch[1]}, according to the preview`);
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

const SUMMARY_TARGET_MIN = 350;
const SUMMARY_TARGET_MAX = 450;
const SUMMARY_FALLBACK_MIN = 120;

/** Bump when Article Brief copy rules change so client caches refresh. */
export const SUMMARY_COPY_VERSION = 3;

const SUMMARY_PARAGRAPH_COUNT = 3;

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
  return SUMMARY_TARGET_MIN;
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
  const maxSentences = ctx.limited ? 2 : 3;

  const whatHappened = limitParagraphSentences(
    buildWhatHappenedParagraph(ctx, facts, entity, headline) || ensurePeriod(describeStoryFocus(ctx)),
    maxSentences
  );

  const keyDetails = limitParagraphSentences(
    mergeParagraphSentences(
      buildKeyDetailsParagraph(headline, excerpt, ctx, facts, entity),
      buildInvolvedPartiesParagraph(ctx, facts, entity)
    ) || buildInvolvedPartiesParagraph(ctx, facts, entity),
    maxSentences
  );

  const significance = limitParagraphSentences(
    mergeParagraphSentences(
      buildBriefContextParagraph(ctx, facts, entity, financeRelated),
      buildWatchNextParagraph(ctx, facts, entity, financeRelated)
    ) || buildWatchNextParagraph(ctx, facts, entity, financeRelated),
    maxSentences
  );

  const filled = [whatHappened, keyDetails, significance].map((paragraph, index) => {
    if (paragraph) return paragraph;
    if (index === 0) return ensurePeriod(describeStoryFocus(ctx));
    if (index === 1) {
      return ensurePeriod(
        entity
          ? `${entity} and the institutions named in the preview are the main actors described in the available reporting.`
          : "The preview highlights the people, institutions, or figures most directly tied to the reported development."
      );
    }
    return ensurePeriod(
      ctx.limited
        ? "The linked source article should add timeline and procedural detail missing from this preview."
        : financeRelated
          ? "Finance readers should treat this preview as an early read and watch for the next official update or filing."
          : "Readers should watch for the next published update that confirms timing, scope, or official response."
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
      `${facts.headlineTopic} saw an update accompanied by a "${facts.quotedPhrases[0]}" warning in the preview`,
      140
    ).replace(/\.$/, "");
  }

  if (facts.amounts.length > 0 && facts.topicTerms.length > 0) {
    return cleanBullet(
      `The preview links ${facts.topicTerms.join(" and ")} to figures including ${facts.amounts[0]}`,
      140
    ).replace(/\.$/, "");
  }

  if (entity) {
    return cleanBullet(`${entity} is at the center of the development described in this report`, 140).replace(
      /\.$/,
      ""
    );
  }

  if (facts.headlineTopic) {
    return cleanBullet(`The preview covers ${facts.headlineTopic}`, 140).replace(/\.$/, "");
  }

  return cleanBullet(`The report covers ${headline.toLowerCase()}`, 140).replace(/\.$/, "");
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
      `${facts.organizations[0]} are tied to a potential ${facts.amounts[facts.amounts.length - 1]} exposure in the excerpt`,
      140
    ).replace(/\.$/, "");
  }

  if (entity) {
    return cleanBullet(`${entity} is named directly in the available preview`, 140).replace(/\.$/, "");
  }

  const civic = extractCivicAffectedParties(headline, excerpt);
  if (civic.length > 0) {
    return cleanBullet(`Those most directly affected include ${formatSubjectList(civic)}`, 140).replace(/\.$/, "");
  }

  if (facts.amounts.length > 0) {
    return cleanBullet(`The cited ${facts.amounts[0]} figure sets the scale discussed in the preview`, 140).replace(
      /\.$/,
      ""
    );
  }

  if (ctx.subjects.length > 0) {
    return cleanBullet(`The preview centers on ${formatSubjectList(ctx.subjects)}`, 140).replace(/\.$/, "");
  }

  return cleanBullet("The named institutions and communities in the preview carry the most direct stake", 140).replace(
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
    return cleanBullet("The payout scale cited in the preview would be material for the institutions named", 140).replace(
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
      ? `The preview anchors the story to ${facts.amounts[0]}`
      : "",
    facts.organizations.length > 0
      ? `${facts.organizations[0]} remain central to how the excerpt frames the story`
      : "",
    facts.headlineTopic ? `The headline centers on ${facts.headlineTopic}` : "",
  ].filter(Boolean);

  for (const fallback of fallbacks) {
    if (unique.length >= 3) break;
    const cleaned = cleanBullet(String(fallback));
    if (!cleaned || isNearDuplicate(cleaned, unique) || overlapsHeadline(cleaned, headline)) continue;
    unique.push(cleaned);
  }

  while (unique.length < 3) {
    const amount = facts.amounts[unique.length % Math.max(facts.amounts.length, 1)];
    const fallback = amount
      ? cleanBullet(`The preview cites ${amount} as a key figure`)
      : facts.headlineTopic
        ? cleanBullet(`The headline centers on ${facts.headlineTopic}`)
        : cleanBullet("Open the source article for the next confirmed update on this story");
    if (!isNearDuplicate(fallback, unique) && !overlapsHeadline(fallback, headline)) {
      unique.push(fallback);
      continue;
    }
    break;
  }

  while (unique.length < 3) {
    unique.push(cleanBullet("See the linked source for fuller reporting beyond this preview"));
  }

  return unique.slice(0, 3);
}

/** Three useful bullets: what happened, why it matters, what to watch. */
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

  const bullets = uniqueThirtySecondBullets(
    [
      buildThirtySecondEventBullet(headline, excerpt, entity, facts),
      buildThirtySecondStakeBullet(facts, ctx, entity, headline, excerpt, financeRelated),
      buildThirtySecondImpactBullet(ctx, entity, headline, financeRelated, facts),
      buildWatchBullet(ctx, entity, financeRelated, facts),
    ],
    facts,
    headline
  );

  return bullets.map((bullet) => `• ${bullet}`).join("\n");
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
    if (
      !/\bbecause|so that|as a result|which means|could|may|expected|important|significant|impact|after|amid|facing|potential\b/i.test(
        sentence
      )
    ) {
      continue;
    }
    const rewritten = paraphraseExcerptSentence(sentence, entity, headline);
    if (rewritten && !overlapsHeadline(rewritten, headline) && !isNearDuplicate(rewritten, parts)) {
      parts.push(rewritten);
    }
    if (parts.length >= 2) break;
  }

  if (parts.length === 0) {
    const fallback = ctx.sentences.find(
      (sentence) => !overlapsHeadline(sentence, headline) && !isSummaryBoilerplate(sentence)
    );
    if (fallback) {
      const rewritten = paraphraseExcerptSentence(fallback, entity, headline);
      if (rewritten) parts.push(rewritten);
    }
  }

  if (financeRelated && facts.topicTerms.includes("car finance") && facts.amounts.some((a) => /\bbillion|bn\b/i.test(a))) {
    parts.push(
      "Large compensation estimates tied to car finance practices can affect bank reserves and how lenders price consumer credit."
    );
  } else if (financeRelated && facts.hasWarning && facts.organizations.length > 0) {
    parts.push(
      `The warning language alongside ${facts.organizations[0]} in the preview suggests the issue may move from headlines into formal remediation or regulatory action.`
    );
  } else if (financeRelated) {
    if (/\bearnings|quarter|results|guidance\b/i.test(headline) && entity) {
      parts.push(`${entity}'s reported figures can affect how analysts assess its recent performance.`);
    } else if (ctx.themes.includes("rates")) {
      parts.push("Changes in rates and inflation expectations can flow through to borrowing costs and asset prices.");
    } else if (ctx.themes.includes("merger") && entity) {
      parts.push(`The deal news can change expectations for ${entity} and for similar companies in the same industry.`);
    } else if (facts.amounts.some((amount) => /\bbillion|bn|million|m\b/i.test(amount))) {
      parts.push(
        `The ${facts.amounts.find((amount) => /\bbillion|bn|million|m\b/i.test(amount)) ?? facts.amounts[0]} figure cited in the preview is the main reason the story carries financial weight.`
      );
    }
  } else if (parts.length === 0) {
    const civic = extractCivicAffectedParties(headline, excerpt);
    if (civic.length > 0) {
      parts.push(`The development has the most immediate relevance for ${formatSubjectList(civic)}.`);
    } else if (facts.headlineTopic) {
      parts.push(`The update matters because it advances ${facts.headlineTopic} beyond earlier reporting in the preview.`);
    } else if (ctx.limited) {
      parts.push(
        "The headline and excerpt describe a news development whose broader effects depend on details not included in the preview."
      );
    }
  }

  return parts.slice(0, 2).join(" ");
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
  void source;
  void publishedAt;
  const ctx = buildArticlePreviewContext(headline, excerpt, source, publishedAt);
  const entity = extractPrimaryEntity(headline, excerpt);

  if (financeRelated && entity) {
    if (/\bearnings|stock|shares|guidance|quarter|results\b/i.test(`${headline} ${excerpt}`)) {
      return `${entity}, its shareholders, and analysts covering the company are the most directly affected audience for this update.`;
    }
    return `${entity} and parties tied to the development described in the report are the most directly affected.`;
  }

  if (financeRelated && ctx.themes.includes("rates")) {
    return "Borrowers, savers, and businesses sensitive to interest-rate changes may feel effects if the development shifts policy expectations.";
  }

  if (financeRelated && ctx.themes.includes("merger")) {
    return "Employees, customers, and rival firms connected to the companies named in the report may be affected by deal progress or failure.";
  }

  const civic = extractCivicAffectedParties(headline, excerpt);
  if (civic.length > 0) {
    return `Those most directly affected include ${formatSubjectList(civic)}.`;
  }

  const rewritten = ctx.sentences
    .slice(0, 2)
    .map((sentence) => paraphraseExcerptSentence(sentence, "", headline))
    .filter((sentence) => sentence && countWords(sentence) >= 8);

  if (rewritten.length > 0) {
    return rewritten.join(" ");
  }

  return "The people, organizations, or communities named in the headline and excerpt are the primary audience for this update.";
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

  return {
    ...brief,
    summary: buildFinBriefSummary(
      brief.headline,
      brief.excerpt,
      brief.source,
      brief.publishedAt,
      financeRelated
    ),
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
